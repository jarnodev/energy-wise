import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper to fetch data from local endpoints
async function fetchLocalApi(
	path: string,
	method: 'GET' | 'POST',
	body?: { fromDate?: string; tillDate?: string; interval?: number; vat?: boolean }
) {
	const url = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}${path}` : `http://localhost:3000${path}`;
	const options: RequestInit = {
		method,
		headers: { 'Content-Type': 'application/json' },
	};
	if (body) options.body = JSON.stringify(body);
	const res = await fetch(url, options);
	return res.json();
}

export async function POST(req: NextRequest) {
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

	// Fetch data from your own endpoints
	const [energy, gas, sun] = await Promise.all([
		fetchLocalApi('/api/energy', 'POST', { fromDate, tillDate, interval, vat }),
		fetchLocalApi('/api/gas', 'POST', { fromDate, tillDate, interval, vat }),
		fetchLocalApi('/api/sun', 'GET'),
	]);

	// Compose a prompt for OpenAI
	const prompt = `Summarize the following home data in plain language, highlight trends and give actionable insights.\n\nEnergy: ${JSON.stringify(
		energy
	)}\nGas: ${JSON.stringify(gas)}\nSun: ${JSON.stringify(sun)}`;

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
