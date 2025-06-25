import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface RequestBody {
	fromDate: string;
	tillDate: string;
	interval?: number; // Optional, default is 4
	vat?: boolean; // Optional, default is true
	priceType?: number; // Optional, default is '1'
}

interface GasPrice {
	readingDate: string;
	price: number;
}

export async function POST(req: NextRequest) {
	try {
		const { fromDate, tillDate, interval, vat } = (await req.json()) as RequestBody;

		if (!fromDate || !tillDate) {
			return NextResponse.json({ error: 'fromDate and tillDate are required' }, { status: 400 });
		}

		const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${fromDate}T22%3A00%3A00.000Z&tillDate=${tillDate}T21%3A59%3A59.999Z&interval=${interval}&usageType=3&inclBtw=${vat}`;

		const response = await fetch(url, {
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			return NextResponse.json({ error: 'Failed to fetch data from gas API' }, { status: response.status });
		}

		const data: {
			Prices: GasPrice[];
		} = await response.json();

		// GasPrices map
		const gasPrices = data.Prices.map((item: GasPrice) => ({
			date: item.readingDate,
			value: item.price,
		}));

		return NextResponse.json(
			{
				prices: gasPrices,
			},
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
				},
			}
		);
	} catch (error) {
		console.error('Error processing request:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
