import { NextResponse } from 'next/server';
import { DataError, getSunshine } from '@/lib/energy-data';

export async function GET() {
	try {
		return NextResponse.json(await getSunshine());
	} catch (error) {
		if (error instanceof DataError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		console.error('Error processing request:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
