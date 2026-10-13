import { amsterdamDay, amsterdamEndOfDay, amsterdamStartOfDay } from "@/lib/dates";

export type EnergyKind = "electricity" | "gas";

// One stored price: market price and energy tax, both in EUR excl. VAT per kWh or m3
export type PricePoint = {
	start: string;
	end: string;
	base: number;
	tax: number;
};

type ApiPrice = { start: string; end: string; price: { value: string } };

type ApiResponse = {
	base?: ApiPrice[];
	all_in?: ApiPrice[];
};

const API_TYPE: Record<EnergyKind, { energyType: string; interval: string }> = {
	electricity: { energyType: "ENERGY_TYPE_ELECTRICITY", interval: "INTERVAL_QUARTER" },
	gas: { energyType: "ENERGY_TYPE_GAS", interval: "INTERVAL_DAY" },
};

function requestOptions(): RequestInit
{
	return {
		headers: { "User-Agent": "EnergyWise/1.0 (+https://github.com/jarnodev)" },
		// A slow upstream must not stall page renders or the cron job
		signal: AbortSignal.timeout(10_000),
	};
}

// Energy tax per unit excl. VAT, for sources that don't include it. Taken from EnergyZero's all-in prices.
const ENERGY_TAX: Record<number, Record<EnergyKind, number>> = {
	2025: { electricity: 0.10154, gas: 0.57816 },
	2026: { electricity: 0.09161, gas: 0.60066 },
};

export function energyTax(kind: EnergyKind, start: string): number
{
	const year = Number(amsterdamDay(start).slice(0, 4));
	const known = Object.keys(ENERGY_TAX).map(Number);
	const nearest = known.reduce((a, b) => (Math.abs(b - year) < Math.abs(a - year) ? b : a));
	return ENERGY_TAX[nearest][kind];
}

// Fetches prices around a calendar day. EnergyZero returns the day before, the day itself and the day after.
export async function fetchEnergyZero(kind: EnergyKind, day: string): Promise<PricePoint[]>
{
	const [y, m, d] = day.split("-");
	const params = new URLSearchParams({
		date: `${d}-${m}-${y}`,
		interval: API_TYPE[kind].interval,
		energyType: API_TYPE[kind].energyType,
		inclVat: "false",
	});

	const response = await fetch(`https://public.api.energyzero.nl/public/v1/prices?${params}`, requestOptions());
	if (!response.ok) {
		throw new Error(`EnergyZero returned ${response.status} for ${kind} on ${day}`);
	}

	const data: ApiResponse = await response.json();
	// all_in = base + energy tax, so the difference is the tax for that period
	const allIn = new Map((data.all_in ?? []).map((p) => [p.start, Number(p.price.value)]));

	return (data.base ?? []).map((p) =>
	{
		const base = Number(p.price.value);
		return {
			start: new Date(p.start).toISOString(),
			end: new Date(p.end).toISOString(),
			base,
			tax: Math.round(((allIn.get(p.start) ?? base) - base) * 1e6) / 1e6,
		};
	});
}

// Length of a local day in minutes (1380 or 1500 on DST changes)
export function dayMinutes(day: string): number
{
	return Math.round((amsterdamEndOfDay(day).getTime() + 1 - amsterdamStartOfDay(day).getTime()) / 60_000);
}

// Minutes a price point covers
export function pointMinutes(point: PricePoint): number
{
	return Math.round((Date.parse(point.end) - Date.parse(point.start)) / 60_000);
}

// Local calendar day a price point belongs to
export function dayOfPoint(point: PricePoint): string
{
	return amsterdamDay(point.start);
}

// Hourly electricity prices for a range of up to a month from EnergyZero's older API, in one request.
// Used for history and as fallback; it has no tax, so that comes from the table above.
export async function fetchEnergyZeroHourly(fromDay: string, tillDay: string): Promise<PricePoint[]>
{
	const params = new URLSearchParams({
		fromDate: amsterdamStartOfDay(fromDay).toISOString(),
		tillDate: amsterdamEndOfDay(tillDay).toISOString(),
		interval: "4",
		usageType: "1",
		inclBtw: "false",
	});

	const response = await fetch(`https://api.energyzero.nl/v1/energyprices?${params}`, requestOptions());
	if (!response.ok) {
		throw new Error(`EnergyZero returned ${response.status} for ${fromDay} to ${tillDay}`);
	}

	const data: { Prices?: Array<{ readingDate: string; price: number }> } = await response.json();
	return (data.Prices ?? []).map((p) =>
	{
		const start = new Date(p.readingDate);
		return {
			start: start.toISOString(),
			end: new Date(start.getTime() + 3_600_000).toISOString(),
			base: p.price,
			tax: energyTax("electricity", p.readingDate),
		};
	});
}
