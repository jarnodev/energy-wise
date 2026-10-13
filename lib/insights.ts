import { amsterdamDay, amsterdamTime } from "@/lib/dates";
import { cheapestBlock } from "@/lib/planner";
import { average, formatEuro, Slot } from "@/lib/pricing";

export type DayStats = {
	day: string;
	average: number;
	min: Slot;
	max: Slot;
	negativeQuarters: number;
	cheapest2h: { start: number; end: number; average: number } | null;
};

export function dayStats(slots: Slot[], day: string): DayStats | null
{
	const daySlots = slots.filter((s) => amsterdamDay(s.start) === day);
	if (!daySlots.length) return null;

	return {
		day,
		average: average(daySlots.map((s) => s.price)),
		min: daySlots.reduce((a, b) => (b.price < a.price ? b : a)),
		max: daySlots.reduce((a, b) => (b.price > a.price ? b : a)),
		negativeQuarters: daySlots.filter((s) => s.price < 0).length,
		cheapest2h: cheapestBlock(daySlots, 120),
	};
}

export function formatRange(start: number, end: number): string
{
	return `${amsterdamTime(start)}–${amsterdamTime(end)}`;
}

// Plain-language summary without AI, used for notifications and as fallback
export function describeDay(stats: DayStats, label: string, monthAverage?: number): string
{
	const parts = [`${label} kost stroom gemiddeld ${formatEuro(stats.average)}/kWh`];
	if (monthAverage) {
		const diff = (stats.average - monthAverage) / monthAverage;
		if (Math.abs(diff) >= 0.05) parts[0] += ` (${Math.round(Math.abs(diff) * 100)}% ${diff < 0 ? "onder" : "boven"} het 30-daags gemiddelde)`;
	}
	if (stats.cheapest2h) {
		parts.push(`het goedkoopst is ${formatRange(stats.cheapest2h.start, stats.cheapest2h.end)} (${formatEuro(stats.cheapest2h.average)})`);
	}
	parts.push(`het duurst rond ${amsterdamTime(stats.max.start)} (${formatEuro(stats.max.price)})`);
	let text = parts.join(", ") + ".";
	if (stats.negativeQuarters > 0) {
		text += ` Let op: ${stats.negativeQuarters / 4} uur met een negatieve prijs.`;
	}
	return text;
}
