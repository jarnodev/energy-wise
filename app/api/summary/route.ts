import { getLatestSummary } from "@/lib/prices";
import { errorResponse, PUBLIC_API_HEADERS } from "@/lib/query";

export async function GET()
{
	try {
		return Response.json(await getLatestSummary(), { headers: PUBLIC_API_HEADERS });
	} catch (error) {
		return errorResponse(error);
	}
}
