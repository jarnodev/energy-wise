import { NextRequest, NextResponse } from 'next/server';
import { DataError, getPrices, PriceQuery } from '@/lib/energy-data';

export async function POST(req: NextRequest) {
	try {
		const query = (await req.json()) as PriceQuery;
		return NextResponse.json(await getPrices('energy', query));
	} catch (error) {
		if (error instanceof DataError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		console.error('Error processing request:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
