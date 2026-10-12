import { NextRequest } from "next/server";
import { amsterdamDayOffset, amsterdamStartOfDay } from "@/lib/dates";
import { BadRequest, errorResponse, parseDay, parseSettings, PUBLIC_API_HEADERS } from "@/lib/query";
import { effectivePrice, toHourly, toSlots } from "@/lib/pricing";
import { getPricePoints } from "@/lib/prices";

export async function GET(req: NextRequest)
{
	try {
		const params = req.nextUrl.searchParams;
		const kind = params.get("kind") ?? "electricity";
		if (kind !== "electricity" && kind !== "gas") throw new BadRequest("kind must be electricity or gas");

		const from = parseDay(params.get("from"), amsterdamDayOffset(0));
		const till = parseDay(params.get("till"), amsterdamDayOffset(1));
		if (till < from) throw new BadRequest("till must not be before from");
		if (amsterdamStartOfDay(till).getTime() - amsterdamStartOfDay(from).getTime() > 400 * 86_400_000) {
			throw new BadRequest("At most 400 days per request");
		}

		const interval = params.get("interval") ?? "quarter";
		if (interval !== "quarter" && interval !== "hour") throw new BadRequest("interval must be quarter or hour");

		const settings = parseSettings(params);
		const points = await getPricePoints(kind, from, till);

		const prices = interval === "hour" && kind === "electricity"
			? toHourly(toSlots(points, kind, settings)).map((s) => ({ start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString(), price: round(s.price) }))
			: points.map((p) => ({ start: p.start, end: p.end, price: round(effectivePrice(p, kind, settings)), market: p.base, tax: p.tax }));

		return Response.json(
			{ kind, unit: kind === "electricity" ? "EUR/kWh" : "EUR/m3", from, till, interval, settings, prices },
			{ headers: PUBLIC_API_HEADERS },
		);
	} catch (error) {
		return errorResponse(error);
	}
}

function round(value: number)
{
	return Math.round(value * 100000) / 100000;
}
