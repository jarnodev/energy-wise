import { NextRequest } from "next/server";
import { amsterdamDay, amsterdamDayOffset } from "@/lib/dates";
import { dayStats } from "@/lib/insights";
import { cheapestBlock } from "@/lib/planner";
import { formatEuro, toSlots } from "@/lib/pricing";
import { daysBetween } from "@/lib/price-store";
import { getPricePoints } from "@/lib/prices";
import { errorResponse, parseNumber, parseSettings } from "@/lib/query";

// iCalendar feed with the cheapest block of electricity per day, to subscribe to from any calendar app
export async function GET(req: NextRequest)
{
	try {
		const params = req.nextUrl.searchParams;
		const settings = parseSettings(params);
		const hours = parseNumber(params.get("hours"), 2, 0.25, 12);

		const from = amsterdamDayOffset(-7);
		const till = amsterdamDayOffset(1);
		const slots = toSlots(await getPricePoints("electricity", from, till), "electricity", settings);

		const events: string[] = [];
		for (const day of daysBetween(from, till)) {
			const daySlots = slots.filter((s) => amsterdamDay(s.start) === day);
			const block = cheapestBlock(daySlots, hours * 60);
			const stats = dayStats(daySlots, day);
			if (!block || !stats) continue;
			events.push(
				"BEGIN:VEVENT",
				`UID:cheapest-${hours}h-${day}@energy-wise`,
				`DTSTAMP:${icsDate(Date.now())}`,
				`DTSTART:${icsDate(block.start)}`,
				`DTEND:${icsDate(block.end)}`,
				`SUMMARY:${escape(`⚡ Goedkoopste stroom (${formatEuro(block.average)}/kWh)`)}`,
				`DESCRIPTION:${escape(`Gemiddeld ${formatEuro(block.average)}/kWh in dit blok, daggemiddelde ${formatEuro(stats.average)}/kWh.`)}`,
				"TRANSP:TRANSPARENT",
				"END:VEVENT",
			);
		}

		const calendar = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//Energy Wise//Goedkoopste stroom//NL",
			"CALSCALE:GREGORIAN",
			"METHOD:PUBLISH",
			`X-WR-CALNAME:${escape(`Goedkoopste ${formatHours(hours)} stroom`)}`,
			"X-WR-TIMEZONE:Europe/Amsterdam",
			"REFRESH-INTERVAL;VALUE=DURATION:PT3H",
			"X-PUBLISHED-TTL:PT3H",
			...events,
			"END:VCALENDAR",
		];

		return new Response(calendar.join("\r\n") + "\r\n", {
			headers: {
				"Content-Type": "text/calendar; charset=utf-8",
				"Content-Disposition": 'inline; filename="goedkoopste-stroom.ics"',
				"Cache-Control": "public, max-age=900",
			},
		});
	} catch (error) {
		return errorResponse(error);
	}
}

function icsDate(ms: number)
{
	return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string)
{
	return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatHours(hours: number)
{
	return hours === 1 ? "uur" : `${String(hours).replace(".", ",")} uur`;
}
