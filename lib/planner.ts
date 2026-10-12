import { amsterdamDay, amsterdamHour } from "@/lib/dates";
import { average, Slot } from "@/lib/pricing";

export type Block = {
	start: number;
	end: number;
	average: number;
};

// Cheapest contiguous block of the given duration within [from, till). Slots must be sorted by start.
export function cheapestBlock(slots: Slot[], durationMinutes: number, from = -Infinity, till = Infinity): Block | null
{
	const window = slots.filter((s) => s.start >= from && s.end <= till);
	let best: Block | null = null;

	for (let i = 0; i < window.length; i++) {
		let total = 0;
		let weighted = 0;
		let end = window[i].start;
		for (let j = i; j < window.length; j++) {
			// Stop at gaps in the data, a block must be contiguous
			if (window[j].start !== end) break;
			const minutes = (window[j].end - window[j].start) / 60_000;
			weighted += window[j].price * minutes;
			total += minutes;
			end = window[j].end;
			if (total >= durationMinutes) {
				const avg = weighted / total;
				if (!best || avg < best.average) best = { start: window[i].start, end, average: avg };
				break;
			}
		}
	}

	return best;
}

export type ChargePlan = {
	slots: Array<Slot & { energy: number }>;
	energy: number;
	cost: number;
	costNow: number; // Cost when charging immediately, for comparison
};

// Cheapest (not necessarily contiguous) slots to charge the given energy before the deadline
export function planCharging(slots: Slot[], energyKWh: number, powerKW: number, from: number, deadline: number): ChargePlan | null
{
	const window = slots.filter((s) => s.start >= from && s.end <= deadline);
	if (!window.length || energyKWh <= 0 || powerKW <= 0) return null;

	const allocate = (ordered: Slot[]) =>
	{
		let remaining = energyKWh;
		const chosen: Array<Slot & { energy: number }> = [];
		for (const slot of ordered) {
			if (remaining <= 0) break;
			const energy = Math.min(remaining, (powerKW * (slot.end - slot.start)) / 3_600_000);
			chosen.push({ ...slot, energy });
			remaining -= energy;
		}
		return { chosen, remaining, cost: chosen.reduce((sum, s) => sum + s.energy * s.price, 0) };
	};

	const cheapest = allocate([...window].sort((a, b) => a.price - b.price));
	const now = allocate(window);

	return {
		slots: cheapest.chosen.sort((a, b) => a.start - b.start),
		energy: energyKWh - Math.max(0, cheapest.remaining),
		cost: cheapest.cost,
		costNow: now.cost,
	};
}

export type BatteryResult = {
	savings: number;
	cycles: number;
	days: number;
};

// Best possible charge/discharge schedule over past prices (dynamic programming over state of charge).
// The battery is assumed to supply the household, so discharging saves the full price.
export function simulateBattery(slots: Slot[], capacityKWh: number, powerKW: number, roundTripEfficiency: number): BatteryResult
{
	if (!slots.length || capacityKWh <= 0 || powerKW <= 0) return { savings: 0, cycles: 0, days: 0 };

	const hours = (slots[0].end - slots[0].start) / 3_600_000;
	const step = powerKW * hours; // Energy moved per slot at full power
	const levels = Math.max(1, Math.min(400, Math.floor(capacityKWh / step)));
	const oneWay = Math.sqrt(roundTripEfficiency);

	// best[level] = maximum savings so far ending with that state of charge
	let best = new Array<number>(levels + 1).fill(-Infinity);
	best[0] = 0;
	let discharges = new Array<number>(levels + 1).fill(0);

	for (const slot of slots) {
		const next = new Array<number>(levels + 1).fill(-Infinity);
		const nextDischarges = new Array<number>(levels + 1).fill(0);
		const consider = (level: number, value: number, count: number) =>
		{
			if (value > next[level]) {
				next[level] = value;
				nextDischarges[level] = count;
			}
		};

		for (let level = 0; level <= levels; level++) {
			if (best[level] === -Infinity) continue;
			consider(level, best[level], discharges[level]);
			if (level < levels) consider(level + 1, best[level] - (slot.price * step) / oneWay, discharges[level]);
			if (level > 0) consider(level - 1, best[level] + slot.price * step * oneWay, discharges[level] + 1);
		}
		best = next;
		discharges = nextDischarges;
	}

	const finalLevel = best.indexOf(Math.max(...best));
	const days = (slots[slots.length - 1].end - slots[0].start) / 86_400_000;
	return {
		savings: best[finalLevel],
		cycles: (discharges[finalLevel] * step) / capacityKWh,
		days,
	};
}

// Relative household electricity use per hour of the day, roughly following the Dutch standard profile
const HOURLY_PROFILE = [0.55, 0.5, 0.48, 0.47, 0.48, 0.55, 0.75, 1.0, 1.05, 0.95, 0.9, 0.9, 0.92, 0.88, 0.85, 0.9, 1.05, 1.4, 1.65, 1.6, 1.45, 1.25, 1.0, 0.75];
// Relative use per month (January first): more light and heating in winter
const MONTHLY_PROFILE = [1.25, 1.15, 1.05, 0.95, 0.88, 0.82, 0.82, 0.85, 0.92, 1.02, 1.13, 1.26];
// Relative gas use per month, dominated by heating
const MONTHLY_GAS_PROFILE = [1.85, 1.65, 1.4, 0.95, 0.55, 0.3, 0.25, 0.25, 0.4, 0.85, 1.35, 1.75];

const monthFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", month: "numeric" });

function weightOf(slot: Slot, kind: "electricity" | "gas"): number
{
	const month = Number(monthFormatter.format(slot.start)) - 1;
	if (kind === "gas") return MONTHLY_GAS_PROFILE[month];
	return HOURLY_PROFILE[amsterdamHour(slot.start)] * MONTHLY_PROFILE[month] * ((slot.end - slot.start) / 3_600_000);
}

export type ContractComparison = {
	averagePrice: number; // Usage-weighted average dynamic price
	dynamicCost: number;
	fixedCost: number;
	days: number;
};

// Estimates the yearly cost on a dynamic contract from past prices, weighted by a typical usage profile.
// flexibleShare moves that part of electricity use to the cheapest quarter hours of each day.
export function compareContract(slots: Slot[], kind: "electricity" | "gas", yearlyUsage: number, fixedPrice: number, flexibleShare = 0): ContractComparison | null
{
	if (!slots.length) return null;

	let weighted = 0;
	let totalWeight = 0;
	for (const slot of slots) {
		const w = weightOf(slot, kind);
		weighted += slot.price * w;
		totalWeight += w;
	}
	let averagePrice = weighted / totalWeight;

	if (kind === "electricity" && flexibleShare > 0) {
		// Average of the cheapest 4 hours per day, for usage that can be shifted (dishwasher, car, heat pump boiler)
		const perDay = new Map<string, number[]>();
		for (const slot of slots) {
			const day = amsterdamDay(slot.start);
			perDay.set(day, [...(perDay.get(day) ?? []), slot.price]);
		}
		const cheapest = average([...perDay.values()].map((prices) => average([...prices].sort((a, b) => a - b).slice(0, Math.max(1, Math.round(prices.length / 6))))));
		averagePrice = averagePrice * (1 - flexibleShare) + cheapest * flexibleShare;
	}

	return {
		averagePrice,
		dynamicCost: averagePrice * yearlyUsage,
		fixedCost: fixedPrice * yearlyUsage,
		days: Math.round((slots[slots.length - 1].end - slots[0].start) / 86_400_000),
	};
}
