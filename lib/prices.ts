import { getCloudflareContext } from "@opennextjs/cloudflare";
import { amsterdamDayOffset, amsterdamEndOfDay, amsterdamStartOfDay } from "@/lib/dates";
import { EnergyKind, fetchEnergyZero, fetchEnergyZeroHourly, PricePoint } from "@/lib/energyzero";
import { daysBetween, fillMissingDays } from "@/lib/price-store";

// Cloudflare bindings, or null when running outside the Workers runtime (e.g. during `next build`)
export async function getEnv(): Promise<CloudflareEnv | null>
{
	try {
		const { env } = await getCloudflareContext({ async: true });
		return env.DB ? env : null;
	} catch {
		return null;
	}
}

// Price points between two local calendar days (inclusive), from D1 when available, otherwise live
export async function getPricePoints(kind: EnergyKind, fromDay: string, tillDay: string): Promise<PricePoint[]>
{
	const from = amsterdamStartOfDay(fromDay).toISOString();
	const till = amsterdamEndOfDay(tillDay).toISOString();
	const env = await getEnv();

	if (env) {
		try {
			await fillMissingDays(env.DB, kind, daysBetween(fromDay, tillDay));
			const { results } = await env.DB
				.prepare("SELECT start, end, base, tax FROM prices WHERE kind = ? AND start >= ? AND start <= ? ORDER BY start")
				.bind(kind, from, till)
				.all<PricePoint>();
			return results;
		} catch (error) {
			// E.g. migrations not applied yet in local development
			console.error("Reading prices from D1 failed, fetching live:", error);
		}
	}

	// No database: fetch live. Electricity hourly per month, plus quarter hours for recent days; gas three days per request.
	const recentFrom = amsterdamDayOffset(-1);
	const requests: Array<Promise<PricePoint[]>> = [];
	if (kind === "electricity") {
		const days = daysBetween(fromDay, tillDay);
		for (let i = 0; i < days.length; i += 31) {
			const chunk = days.slice(i, i + 31);
			requests.push(fetchEnergyZeroHourly(chunk[0], chunk[chunk.length - 1]));
		}
		if (tillDay >= recentFrom) requests.push(fetchEnergyZero(kind, amsterdamDayOffset(0)));
	} else {
		const centers = daysBetween(fromDay, tillDay).filter((_, i) => i % 3 === 1);
		requests.push(...centers.map((day) => fetchEnergyZero(kind, day)));
	}

	const responses = await Promise.all(requests.map((r) => r.catch((error) => (console.error(error), []))));
	// Quarter hours replace the hourly prices of the same period
	const quarters = responses.flat().filter((p) => Date.parse(p.end) - Date.parse(p.start) < 3_600_000);
	const quarterHours = new Set(quarters.map((p) => p.start.slice(0, 13)));
	const unique = new Map<string, PricePoint>();
	for (const p of responses.flat()) {
		const isHourly = Date.parse(p.end) - Date.parse(p.start) >= 3_600_000;
		if (kind === "electricity" && isHourly && quarterHours.has(p.start.slice(0, 13))) continue;
		unique.set(p.start, p);
	}
	return [...unique.values()].filter((p) => p.start >= from && p.start <= till).sort((a, b) => a.start.localeCompare(b.start));
}

export type Summary = { day: string; text: string; model: string; created_at: string };

// The most recent daily summary (normally about tomorrow, otherwise about today)
export async function getLatestSummary(): Promise<Summary | null>
{
	const env = await getEnv();
	if (!env) return null;
	try {
		return await env.DB
			.prepare("SELECT day, text, model, created_at FROM summaries WHERE day >= ? ORDER BY day DESC LIMIT 1")
			.bind(amsterdamDayOffset(0))
			.first<Summary>();
	} catch {
		return null;
	}
}
