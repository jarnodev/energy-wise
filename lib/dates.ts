export const TIME_ZONE = "Europe/Amsterdam";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
	timeZone: TIME_ZONE,
	timeZoneName: "longOffset",
});

// Calendar date (YYYY-MM-DD) of the given instant in Amsterdam
export function amsterdamDay(date: Date | string | number = new Date()): string
{
	return dayFormatter.format(new Date(date));
}

// Calendar date (YYYY-MM-DD) in Amsterdam, shifted by a number of days from today
export function amsterdamDayOffset(days: number, from: Date = new Date()): string
{
	const [y, m, d] = amsterdamDay(from).split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split("T")[0];
}

// Offset of Amsterdam from UTC at the given instant, in milliseconds (e.g. +2h in summer)
function offsetMs(instant: number): number
{
	const name = offsetFormatter.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
	const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
	if (!match) return 0;
	const sign = match[1] === "-" ? -1 : 1;
	return sign * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
}

// UTC instant of local midnight in Amsterdam at the start of the given YYYY-MM-DD, DST-aware
export function amsterdamStartOfDay(day: string): Date
{
	const [y, m, d] = day.split("-").map(Number);
	const utcMidnight = Date.UTC(y, m - 1, d);
	// Two passes: the offset at the guessed instant is the offset at local midnight,
	// because DST transitions in Amsterdam happen at 02:00/03:00, never around midnight.
	const guess = utcMidnight - offsetMs(utcMidnight);
	return new Date(utcMidnight - offsetMs(guess));
}

// UTC instant of the last millisecond of the given YYYY-MM-DD in Amsterdam
export function amsterdamEndOfDay(day: string): Date
{
	return new Date(amsterdamStartOfDay(amsterdamDayOffset(1, amsterdamStartOfDay(day))).getTime() - 1);
}
