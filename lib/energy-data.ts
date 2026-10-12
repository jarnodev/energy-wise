import { amsterdamEndOfDay, amsterdamStartOfDay } from "@/lib/dates";

export type PricePoint = {
	date: string;
	value: number;
};

export type SunshineDuration = {
	readingDate: string;
	duration: number;
};

export interface PriceQuery
{
	fromDate: string; // Inclusive calendar day (YYYY-MM-DD) in Dutch local time
	tillDate: string; // Inclusive calendar day (YYYY-MM-DD) in Dutch local time
	interval?: number; // EnergyZero interval, default is 4 (hourly)
	vat?: boolean; // Include VAT, default is true
}

// Error with an HTTP status, so API routes can pass it on to the client
export class DataError extends Error
{
	constructor(message: string, public status: number)
	{
		super(message);
	}
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// EnergyZero usage types
const USAGE_TYPE = { energy: 1, gas: 3 } as const;

export async function getPrices(kind: keyof typeof USAGE_TYPE, { fromDate, tillDate, interval = 4, vat = true }: PriceQuery): Promise<{ prices: PricePoint[] }>
{
	if (!fromDate || !tillDate) {
		throw new DataError("fromDate and tillDate are required", 400);
	}
	if (!DAY_PATTERN.test(fromDate) || !DAY_PATTERN.test(tillDate)) {
		throw new DataError("fromDate and tillDate must be YYYY-MM-DD", 400);
	}
	if (!Number.isInteger(interval) || typeof vat !== "boolean") {
		throw new DataError("interval must be an integer and vat a boolean", 400);
	}

	const params = new URLSearchParams({
		fromDate: amsterdamStartOfDay(fromDate).toISOString(),
		tillDate: amsterdamEndOfDay(tillDate).toISOString(),
		interval: String(interval),
		usageType: String(USAGE_TYPE[kind]),
		inclBtw: String(vat),
	});

	const response = await fetch(`https://api.energyzero.nl/v1/energyprices?${params}`, {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		throw new DataError(`Failed to fetch data from ${kind} API`, response.status);
	}

	const data: { Prices?: Array<{ readingDate: string; price: number }> } = await response.json();

	return {
		prices: (data.Prices ?? []).map((item) => ({
			date: item.readingDate,
			value: item.price,
		})),
	};
}

export async function getSunshine(): Promise<{ sunshineDurations: SunshineDuration[] }>
{
	const pastHours = 30 * 24; // 30 days in hours
	const url = `https://api.open-meteo.com/v1/forecast?latitude=52.14137&longitude=5.16828&hourly=sunshine_duration&timezone=GMT&timeformat=unixtime&past_hours=${pastHours}&forecast_days=1&forecast_hours=24`;

	const response = await fetch(url, {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		throw new DataError("Failed to fetch data from sunshine API", response.status);
	}

	const data: {
		hourly: {
			time: number[];
			sunshine_duration: number[];
		};
	} = await response.json();

	// Unix timestamps to absolute ISO strings, so clients render them in the right zone
	return {
		sunshineDurations: data.hourly.time.map((time, index) => ({
			readingDate: new Date(time * 1000).toISOString(),
			duration: data.hourly.sunshine_duration[index],
		})),
	};
}
