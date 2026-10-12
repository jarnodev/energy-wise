import { NextRequest } from "next/server";
import { amsterdamDay, amsterdamDayOffset } from "@/lib/dates";
import { cheapestBlock } from "@/lib/planner";
import { average, priceLevel, toSlots } from "@/lib/pricing";
import { getPricePoints } from "@/lib/prices";
import { errorResponse, parseNumber, parseSettings, PUBLIC_API_HEADERS } from "@/lib/query";

// Current electricity price, today's range and the next cheapest block. Built for Home Assistant REST sensors.
export async function GET(req: NextRequest)
{
	try {
		const params = req.nextUrl.searchParams;
		const settings = parseSettings(params);
		const hours = parseNumber(params.get("hours"), 2, 0.25, 12);

		const today = amsterdamDayOffset(0);
		const tomorrow = amsterdamDayOffset(1);
		const slots = toSlots(await getPricePoints("electricity", today, tomorrow), "electricity", settings);
		const now = Date.now();
		const current = slots.find((s) => s.start <= now && now < s.end);
		const remaining = slots.filter((s) => s.end > now);
		const block = cheapestBlock(remaining, hours * 60, Math.floor(now / 900_000) * 900_000);
		const prices = slots.filter((s) => amsterdamDay(s.start) === today).map((s) => s.price);

		return Response.json(
			{
				time: new Date(now).toISOString(),
				unit: "EUR/kWh",
				price: current ? round(current.price) : null,
				level: current ? priceLevel(current.price, prices) : null,
				today: prices.length ? { average: round(average(prices)), min: round(Math.min(...prices)), max: round(Math.max(...prices)) } : null,
				cheapest: block ? { hours, start: new Date(block.start).toISOString(), end: new Date(block.end).toISOString(), average: round(block.average) } : null,
				tomorrow_available: slots.some((s) => amsterdamDay(s.start) === tomorrow),
				settings,
			},
			{ headers: { ...PUBLIC_API_HEADERS, "Cache-Control": "public, max-age=60" } },
		);
	} catch (error) {
		return errorResponse(error);
	}
}

function round(value: number)
{
	return Math.round(value * 100000) / 100000;
}
