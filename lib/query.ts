import { DEFAULT_PRICE_SETTINGS, PriceSettings } from "@/lib/pricing";

export class BadRequest extends Error {}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(value: string | null, fallback: string): string
{
	if (value === null) return fallback;
	if (!DAY_PATTERN.test(value) || Number.isNaN(Date.parse(value))) throw new BadRequest("Dates must be YYYY-MM-DD");
	return value;
}

export function parseNumber(value: string | null, fallback: number, min: number, max: number): number
{
	if (value === null || value === "") return fallback;
	const number = Number(value);
	if (!Number.isFinite(number) || number < min || number > max) throw new BadRequest(`Expected a number between ${min} and ${max}`);
	return number;
}

// Price settings from query parameters: mode=allin|market, vat=true|false, markup (electricity), markup_gas
export function parseSettings(params: URLSearchParams): PriceSettings
{
	const mode = params.get("mode") ?? DEFAULT_PRICE_SETTINGS.mode;
	if (mode !== "allin" && mode !== "market") throw new BadRequest("mode must be allin or market");
	return {
		mode,
		vat: params.get("vat") !== "false",
		markupElectricity: parseNumber(params.get("markup"), DEFAULT_PRICE_SETTINGS.markupElectricity, -1, 1),
		markupGas: parseNumber(params.get("markup_gas"), DEFAULT_PRICE_SETTINGS.markupGas, -1, 5),
	};
}

export function errorResponse(error: unknown): Response
{
	if (error instanceof BadRequest) {
		return Response.json({ error: error.message }, { status: 400 });
	}
	console.error(error);
	return Response.json({ error: "Internal server error" }, { status: 500 });
}

// Lets other sites, Home Assistant and calendar apps use the public API
export const PUBLIC_API_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Cache-Control": "public, max-age=300",
};
