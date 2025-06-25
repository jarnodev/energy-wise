import { NextResponse } from 'next/server';

export const runtime = 'edge';

interface SunshineDuration {
	readingDate: string;
	duration: number;
}

export async function GET() {
	const pastHours = 30 * 24; // 30 days in hours

	try {
		const url = `https://api.open-meteo.com/v1/forecast?latitude=52.14137&longitude=5.16828&hourly=sunshine_duration&timezone=Europe%2FBerlin&past_hours=${pastHours}&forecast_days=1&forecast_hours=24`;

		const response = await fetch(url, {
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			return NextResponse.json({ error: 'Failed to fetch data from sunshine API' }, { status: response.status });
		}

		const data: {
			hourly: {
				time: string[];
				sunshine_duration: number[];
			};
		} = await response.json();

		// SunshineDuration map
		const sunshineDurations: SunshineDuration[] = data.hourly.time.map((time, index) => ({
			readingDate: time,
			duration: data.hourly.sunshine_duration[index],
		}));

		return NextResponse.json(
			{
				sunshineDurations: sunshineDurations,
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
