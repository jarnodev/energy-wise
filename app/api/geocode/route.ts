import { NextRequest } from "next/server";
import { BadRequest, errorResponse } from "@/lib/query";
import { geocode } from "@/lib/solar";

export async function GET(req: NextRequest)
{
	try {
		const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
		if (query.length < 2 || query.length > 100) throw new BadRequest("Enter a postcode or place name");

		const result = await geocode(query);
		if (!result) return Response.json({ error: "Location not found" }, { status: 404 });
		return Response.json(result, { headers: { "Cache-Control": "public, max-age=86400" } });
	} catch (error) {
		return errorResponse(error);
	}
}
