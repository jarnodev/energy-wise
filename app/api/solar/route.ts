import { NextRequest } from "next/server";
import { errorResponse, parseNumber, PUBLIC_API_HEADERS } from "@/lib/query";
import { DEFAULT_LOCATION, getSolarForecast } from "@/lib/solar";

// Hourly irradiance on tilted panels for yesterday, today and the next two days
export async function GET(req: NextRequest)
{
	try {
		const params = req.nextUrl.searchParams;
		const forecast = await getSolarForecast({
			latitude: parseNumber(params.get("lat"), DEFAULT_LOCATION.latitude, 50.5, 54),
			longitude: parseNumber(params.get("lon"), DEFAULT_LOCATION.longitude, 3, 7.5),
			tilt: parseNumber(params.get("tilt"), 35, 0, 90),
			azimuth: parseNumber(params.get("azimuth"), 0, -180, 180),
		});
		return Response.json({ unit: "W/m2", hours: forecast }, { headers: { ...PUBLIC_API_HEADERS, "Cache-Control": "public, max-age=1800" } });
	} catch (error) {
		return errorResponse(error);
	}
}
