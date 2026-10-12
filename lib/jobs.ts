import { amsterdamDay, amsterdamDayOffset, amsterdamEndOfDay, amsterdamHour, amsterdamStartOfDay, amsterdamTime } from "@/lib/dates";
import { dayMinutes, EnergyKind, PricePoint } from "@/lib/energyzero";
import { dayStats, describeDay } from "@/lib/insights";
import { average, DEFAULT_PRICE_SETTINGS, effectivePrice, formatEuro, PriceSettings, toSlots } from "@/lib/pricing";
import { daysBetween, fillMissingDays } from "@/lib/price-store";
import { sendPush, VapidKeys } from "@/lib/webpush";

export const SUMMARY_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const HISTORY_DAYS = 400;

async function storedPoints(db: D1Database, kind: EnergyKind, fromDay: string, tillDay: string): Promise<PricePoint[]>
{
	const { results } = await db
		.prepare("SELECT start, end, base, tax FROM prices WHERE kind = ? AND start >= ? AND start <= ? ORDER BY start")
		.bind(kind, amsterdamStartOfDay(fromDay).toISOString(), amsterdamEndOfDay(tillDay).toISOString())
		.all<PricePoint>();
	return results;
}

async function isComplete(db: D1Database, kind: EnergyKind, day: string): Promise<boolean>
{
	const row = await db.prepare("SELECT minutes FROM fetched_days WHERE kind = ? AND day = ?").bind(kind, day).first<{ minutes: number }>();
	return !!row && (kind === "gas" || row.minutes >= dayMinutes(day));
}

// Stores recent prices and backfills a slice of history on every run, so a year of data builds up in hours
export async function ingest(db: D1Database)
{
	const today = amsterdamDayOffset(0);
	const recent = daysBetween(amsterdamDayOffset(-2), amsterdamDayOffset(1));
	const history = daysBetween(amsterdamDayOffset(-HISTORY_DAYS), amsterdamDayOffset(-3));

	const requests = {
		electricity: await fillMissingDays(db, "electricity", recent, 4),
		gas: await fillMissingDays(db, "gas", recent, 4),
		// A month of electricity history per request, gas three days per request
		electricityHistory: await fillMissingDays(db, "electricity", history, 3),
		gasHistory: await fillMissingDays(db, "gas", history, 8),
	};
	return { today, requests };
}

// Writes tomorrow's summary once its prices are published
export async function writeSummary(env: CloudflareEnv)
{
	const tomorrow = amsterdamDayOffset(1);
	if (!(await isComplete(env.DB, "electricity", tomorrow))) return { skipped: "tomorrow not published" };
	if (await env.DB.prepare("SELECT day FROM summaries WHERE day = ?").bind(tomorrow).first()) return { skipped: "already written" };

	const slots = toSlots(await storedPoints(env.DB, "electricity", amsterdamDayOffset(-30), tomorrow), "electricity", DEFAULT_PRICE_SETTINGS);
	const stats = dayStats(slots, tomorrow);
	if (!stats) return { skipped: "no data" };
	const monthAverage = average(slots.filter((s) => amsterdamDay(s.start) <= amsterdamDayOffset(0)).map((s) => s.price));

	const gas = await storedPoints(env.DB, "gas", amsterdamDayOffset(-1), tomorrow);
	const gasPrices = gas.map((p) => effectivePrice(p, "gas", DEFAULT_PRICE_SETTINGS));
	const facts = describeDay(stats, "Morgen", monthAverage) + (gasPrices.length >= 2 ? ` Gas: ${formatEuro(gasPrices[gasPrices.length - 1])}/m³ (vandaag ${formatEuro(gasPrices[gasPrices.length - 2])}).` : "");

	let text = facts;
	let model = "template";
	try {
		const result = (await env.AI.run(SUMMARY_MODEL, {
			messages: [
				{
					role: "system",
					content: "Je bent een behulpzame energie-assistent voor Nederlandse huishoudens met een dynamisch energiecontract. Schrijf in het Nederlands, in maximaal drie korte zinnen, zonder opsomming en zonder aanhef. Noem concrete tijden en geef één praktische tip (bijvoorbeeld wassen, auto laden of koken). Verzin geen cijfers die niet in de feiten staan.",
				},
				{ role: "user", content: `Feiten voor morgen (prijzen all-in incl. btw): ${facts}` },
			],
			max_tokens: 200,
		})) as { response?: string };
		if (result.response?.trim()) {
			text = result.response.trim();
			model = SUMMARY_MODEL;
		}
	} catch (error) {
		console.error("Workers AI summary failed, using template:", error);
	}

	await env.DB.prepare("INSERT OR REPLACE INTO summaries (day, text, model, created_at) VALUES (?, ?, ?, ?)")
		.bind(tomorrow, text, model, new Date().toISOString())
		.run();
	return { day: tomorrow, model };
}

export type PushPreferences = {
	threshold: number | null; // Alert when the price drops below this (EUR/kWh, in the subscriber's price settings)
	negative: boolean; // Alert before negative prices
	digest: boolean; // Daily message once tomorrow's prices are published
	settings: PriceSettings;
};

type SubscriptionRow = {
	endpoint: string;
	p256dh: string;
	auth: string;
	preferences: string;
	last_threshold_alert: string | null;
	last_digest_day: string | null;
};

export async function sendNotifications(env: CloudflareEnv, now = Date.now())
{
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { skipped: "no VAPID keys" };
	const vapid: VapidKeys = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT };

	const { results: subscriptions } = await env.DB.prepare("SELECT * FROM push_subscriptions").all<SubscriptionRow>();
	if (!subscriptions.length) return { sent: 0 };

	const tomorrow = amsterdamDayOffset(1);
	const points = await storedPoints(env.DB, "electricity", amsterdamDayOffset(0), tomorrow);
	const digestDue = amsterdamHour(now) >= 15 && (await isComplete(env.DB, "electricity", tomorrow));

	let sent = 0;
	for (const row of subscriptions) {
		const prefs: PushPreferences = JSON.parse(row.preferences);
		const slots = toSlots(points, "electricity", prefs.settings);
		const messages: Array<{ title: string; body: string; tag: string; kind: "digest" | "alert" }> = [];

		if (prefs.digest && digestDue && row.last_digest_day !== tomorrow) {
			const stats = dayStats(slots, tomorrow);
			if (stats) messages.push({ title: "Stroomprijzen voor morgen", body: describeDay(stats, "Morgen"), tag: `digest-${tomorrow}`, kind: "digest" });
		}

		// Alerts look at the hour starting within the next 15 minutes, and repeat at most every 3 hours
		const recentlyAlerted = row.last_threshold_alert && now - Date.parse(row.last_threshold_alert) < 3 * 3_600_000;
		const upcoming = slots.filter((s) => s.start >= now && s.start < now + 75 * 60_000);
		const limit = prefs.negative ? Math.max(0, prefs.threshold ?? 0) : prefs.threshold;
		if (!recentlyAlerted && limit !== null && upcoming.length) {
			const first = upcoming.find((s) => s.price < limit);
			if (first) {
				// Extend the run of cheap slots as far as it goes
				let end = first.end;
				for (const s of slots) if (s.start === end && s.price < limit) end = s.end;
				const negative = first.price < 0;
				messages.push({
					title: negative ? "Negatieve stroomprijs" : "Stroom is goedkoop",
					body: `Vanaf ${amsterdamTime(first.start)} tot ${amsterdamTime(end)}: ${formatEuro(first.price)}/kWh.${negative ? " Zet zware apparaten aan en overweeg terugleveren te beperken." : ""}`,
					tag: "alert",
					kind: "alert",
				});
			}
		}

		for (const message of messages) {
			const status = await sendPush(row, { ...message, url: "/" }, vapid);
			if (status === 404 || status === 410) {
				await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(row.endpoint).run();
				break;
			}
			if (status >= 200 && status < 300) {
				sent++;
				const column = message.kind === "digest" ? "last_digest_day" : "last_threshold_alert";
				const value = message.kind === "digest" ? tomorrow : new Date(now).toISOString();
				await env.DB.prepare(`UPDATE push_subscriptions SET ${column} = ? WHERE endpoint = ?`).bind(value, row.endpoint).run();
			} else {
				console.error(`Push to ${new URL(row.endpoint).host} failed with ${status}`);
			}
		}
	}
	return { sent };
}

// Entry point for the cron trigger
export async function runScheduled(env: CloudflareEnv)
{
	const ingested = await ingest(env.DB);
	const summary = await writeSummary(env);
	const notifications = await sendNotifications(env);
	return { ingested, summary, notifications };
}
