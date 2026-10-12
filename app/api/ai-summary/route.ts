import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getPrices, getSunshine } from '@/lib/energy-data';

export async function POST(req: NextRequest) {
	// Disable this endpoint for now
	return NextResponse.json(
		{ error: 'This endpoint is temporarily disabled.' },
		{
			status: 503,
			headers: { 'Content-Type': 'application/json' },
		}
	);

	const {
		fromDate,
		tillDate,
		interval = 4,
		vat = true,
	} = (await req.json()) as {
		fromDate: string;
		tillDate: string;
		interval?: number;
		vat?: boolean;
	};

	const [energy, gas, sun] = await Promise.all([
		getPrices('energy', { fromDate, tillDate, interval, vat }),
		getPrices('gas', { fromDate, tillDate, interval, vat }),
		getSunshine(),
	]);

	// Compose a prompt for OpenAI
	const prompt = `Summarize the following home data in plain language, highlight trends and give actionable insights.\n\nEnergy: ${JSON.stringify(
		energy
	)}\nGas: ${JSON.stringify(gas)}\nSun: ${JSON.stringify(sun)}`;

	// Created per request, so builds don't require OPENAI_API_KEY
	const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	const completion = await openai.chat.completions.create({
		model: 'gpt-4o-mini',
		messages: [
			{ role: 'system', content: 'You are an expert energy assistant.' },
			{ role: 'user', content: prompt },
		],
		max_tokens: 1024,
	});

	const summary = completion.choices[0]?.message?.content || 'No summary available.';
	return NextResponse.json(
		{
			summary,
			prompt,
		},
		{
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		}
	);
}
