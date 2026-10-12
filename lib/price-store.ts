import { amsterdamDayOffset, amsterdamHour, amsterdamStartOfDay } from "@/lib/dates";
import { dayMinutes, dayOfPoint, EnergyKind, fetchEnergyZero, fetchEnergyZeroHourly, PricePoint, pointMinutes } from "@/lib/energyzero";

// All calendar days from fromDay up to and including tillDay
export function daysBetween(fromDay: string, tillDay: string): string[]
{
	const days: string[] = [];
	for (let day = fromDay; day <= tillDay; day = nextDay(day)) {
		days.push(day);
	}
	return days;
}

function nextDay(day: string, offset = 1): string
{
	return amsterdamDayOffset(offset, amsterdamStartOfDay(day));
}

// Stores points. Days whose minutes are fully covered are marked as fetched, unless markComplete is false
// (fallback data that should be replaced by better data on a later run).
export async function storePoints(db: D1Database, kind: EnergyKind, points: PricePoint[], markComplete = true)
{
	if (!points.length) return;

	const insert = db.prepare("INSERT OR REPLACE INTO prices (kind, start, end, base, tax) VALUES (?, ?, ?, ?, ?)");
	const statements = points.map((p) => insert.bind(kind, p.start, p.end, p.base, p.tax));

	if (markComplete) {
		const minutes = new Map<string, number>();
		for (const p of points) minutes.set(dayOfPoint(p), (minutes.get(dayOfPoint(p)) ?? 0) + pointMinutes(p));
		const markDay = db.prepare("INSERT OR REPLACE INTO fetched_days (kind, day, minutes, fetched_at) VALUES (?, ?, ?, ?)");
		const now = new Date().toISOString();
		for (const [day, covered] of minutes) {
			// Gas has one price per gas day, so a single point completes it
			if (kind === "gas" || covered >= dayMinutes(day)) statements.push(markDay.bind(kind, day, covered, now));
		}
	}

	await db.batch(statements);
}

// Splits days sorted newest first into runs of consecutive days, each at most maxLength long
function consecutiveRuns(newestFirst: string[], maxLength: number): Array<{ from: string; till: string }>
{
	const runs: Array<{ from: string; till: string }> = [];
	for (const day of newestFirst) {
		const last = runs[runs.length - 1];
		if (last && nextDay(day) === last.from && daysBetween(day, last.till).length <= maxLength) {
			last.from = day;
		} else {
			runs.push({ from: day, till: day });
		}
	}
	return runs;
}

// Fetches missing days and stores them, most recent first. Returns the number of upstream requests made.
//  - Recent electricity (yesterday and later): quarter-hour prices, three days per request, hourly fallback
//  - Older electricity: hourly prices, up to a month per request
//  - Gas: daily prices, three days per request
export async function fillMissingDays(db: D1Database, kind: EnergyKind, days: string[], maxRequests = 20): Promise<number>
{
	// Prices for tomorrow are published around 13:00, nothing further ahead exists yet
	const tomorrow = amsterdamDayOffset(1);
	days = days.filter((day) => day < tomorrow || (day === tomorrow && amsterdamHour() >= 12));
	if (!days.length) return 0;

	const sorted = [...days].sort();
	const { results } = await db
		.prepare("SELECT day FROM fetched_days WHERE kind = ? AND day >= ? AND day <= ?")
		.bind(kind, sorted[0], sorted[sorted.length - 1])
		.all<{ day: string }>();
	const fetched = new Set(results.map((r) => r.day));
	const missing = sorted.filter((day) => !fetched.has(day)).reverse();
	if (!missing.length) return 0;

	const yesterday = amsterdamDayOffset(-1);
	const jobs: Array<() => Promise<void>> = [];

	// Each request for day D returns D-1, D and D+1. Walking from newest to oldest, ask for the day before.
	const covered = new Set<string>();
	for (const day of kind === "gas" ? missing : missing.filter((d) => d >= yesterday)) {
		if (covered.has(day)) continue;
		const center = nextDay(day, -1);
		covered.add(day).add(center).add(nextDay(center, -1));
		jobs.push(async () =>
		{
			try {
				await storePoints(db, kind, await fetchEnergyZero(kind, center));
			} catch (error) {
				if (kind !== "electricity") throw error;
				// Quarter-hour API unavailable: store hourly prices for now, retried on the next run
				console.error(error);
				await storePoints(db, kind, await fetchEnergyZeroHourly(nextDay(center, -1), day), false);
			}
		});
	}

	if (kind === "electricity") {
		for (const run of consecutiveRuns(missing.filter((d) => d < yesterday), 31)) {
			jobs.push(async () => storePoints(db, kind, await fetchEnergyZeroHourly(run.from, run.till)));
		}
	}

	// Small parallel batches to be gentle on the upstream
	const selected = jobs.slice(0, maxRequests);
	for (let i = 0; i < selected.length; i += 4) {
		const batch = await Promise.allSettled(selected.slice(i, i + 4).map((job) => job()));
		for (const result of batch) {
			if (result.status === "rejected") console.error(result.reason);
		}
	}

	return selected.length;
}
