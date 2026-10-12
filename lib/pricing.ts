import type { EnergyKind, PricePoint } from "@/lib/energyzero";

export const VAT_RATE = 0.21;

// How prices are shown. "allin" is what a household on a dynamic contract pays per unit.
export type PriceSettings = {
	mode: "allin" | "market";
	vat: boolean;
	markupElectricity: number; // Supplier markup in EUR/kWh excl. VAT
	markupGas: number; // Supplier markup in EUR/m3 excl. VAT
};

export const DEFAULT_PRICE_SETTINGS: PriceSettings = {
	mode: "allin",
	vat: true,
	markupElectricity: 0.02,
	markupGas: 0.05,
};

// A price point with its effective price and times as epoch milliseconds, ready for calculations
export type Slot = {
	start: number;
	end: number;
	price: number;
};

export function effectivePrice(point: Pick<PricePoint, "base" | "tax">, kind: EnergyKind, settings: PriceSettings): number
{
	const markup = kind === "electricity" ? settings.markupElectricity : settings.markupGas;
	const net = settings.mode === "allin" ? point.base + point.tax + markup : point.base;
	return settings.vat ? net * (1 + VAT_RATE) : net;
}

export function toSlots(points: PricePoint[], kind: EnergyKind, settings: PriceSettings): Slot[]
{
	return points.map((p) => ({
		start: Date.parse(p.start),
		end: Date.parse(p.end),
		price: effectivePrice(p, kind, settings),
	}));
}

// Averages quarter-hour slots into hourly slots
export function toHourly(slots: Slot[]): Slot[]
{
	const hours = new Map<number, { start: number; end: number; total: number; count: number }>();
	for (const slot of slots) {
		const hour = Math.floor(slot.start / 3_600_000) * 3_600_000;
		const entry = hours.get(hour) ?? { start: hour, end: hour, total: 0, count: 0 };
		entry.end = Math.max(entry.end, slot.end);
		entry.total += slot.price;
		entry.count += 1;
		hours.set(hour, entry);
	}
	return [...hours.values()].map((h) => ({ start: h.start, end: h.end, price: h.total / h.count }));
}

export type PriceLevel = "negative" | "cheap" | "normal" | "expensive";

// Classifies a price against the other prices of the same period: lowest third is cheap, highest third expensive
export function priceLevel(price: number, reference: number[]): PriceLevel
{
	if (price < 0) return "negative";
	if (!reference.length) return "normal";
	const sorted = [...reference].sort((a, b) => a - b);
	const low = sorted[Math.floor(sorted.length / 3)];
	const high = sorted[Math.floor((sorted.length * 2) / 3)];
	if (price <= low) return "cheap";
	if (price >= high) return "expensive";
	return "normal";
}

export function average(values: number[]): number
{
	return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

const euroFormatters = new Map<number, Intl.NumberFormat>();

export function formatEuro(value: number, digits = 3): string
{
	let formatter = euroFormatters.get(digits);
	if (!formatter) {
		formatter = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });
		euroFormatters.set(digits, formatter);
	}
	return formatter.format(value);
}
