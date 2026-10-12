import { NextRequest } from "next/server";
import type { PushPreferences } from "@/lib/jobs";
import { DEFAULT_PRICE_SETTINGS } from "@/lib/pricing";
import { getEnv } from "@/lib/prices";
import { BadRequest, errorResponse } from "@/lib/query";

// The cron job POSTs to subscription endpoints, so only accept the browsers' own push services
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/];
const MAX_SUBSCRIPTIONS = 10_000;

type SubscribeBody = {
	subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
	preferences?: Partial<PushPreferences>;
};

function validEndpoint(endpoint: unknown): endpoint is string
{
	if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
	try {
		const url = new URL(endpoint);
		return url.protocol === "https:" && PUSH_HOSTS.some((host) => host.test(url.hostname));
	} catch {
		return false;
	}
}

function validKey(value: unknown, min: number, max: number): value is string
{
	return typeof value === "string" && /^[A-Za-z0-9_-]+=*$/.test(value) && value.length >= min && value.length <= max;
}

function parsePreferences(input: Partial<PushPreferences> | undefined): PushPreferences
{
	const threshold = input?.threshold;
	if (threshold !== null && threshold !== undefined && (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < -1 || threshold > 2)) {
		throw new BadRequest("threshold must be a number between -1 and 2");
	}
	const s = input?.settings;
	const settings = {
		mode: s?.mode === "market" ? "market" as const : "allin" as const,
		vat: s?.vat !== false,
		markupElectricity: clamp(s?.markupElectricity, DEFAULT_PRICE_SETTINGS.markupElectricity, -1, 1),
		markupGas: clamp(s?.markupGas, DEFAULT_PRICE_SETTINGS.markupGas, -1, 5),
	};
	return { threshold: threshold ?? null, negative: input?.negative === true, digest: input?.digest === true, settings };
}

function clamp(value: unknown, fallback: number, min: number, max: number): number
{
	return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

// Public key the browser needs to subscribe
export async function GET()
{
	const env = await getEnv();
	if (!env?.VAPID_PUBLIC_KEY) return Response.json({ error: "Notifications are not configured" }, { status: 503 });
	return Response.json({ publicKey: env.VAPID_PUBLIC_KEY });
}

// Subscribe or update preferences
export async function POST(req: NextRequest)
{
	try {
		const env = await getEnv();
		if (!env?.VAPID_PUBLIC_KEY) return Response.json({ error: "Notifications are not configured" }, { status: 503 });

		const body = (await req.json()) as SubscribeBody;
		const endpoint = body.subscription?.endpoint;
		const keys = body.subscription?.keys;
		if (!validEndpoint(endpoint)) throw new BadRequest("Unsupported push endpoint");
		if (!validKey(keys?.p256dh, 80, 100) || !validKey(keys?.auth, 16, 30)) throw new BadRequest("Invalid subscription keys");
		const preferences = parsePreferences(body.preferences);

		const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").first<{ n: number }>();
		const existing = await env.DB.prepare("SELECT 1 FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).first();
		if (!existing && (count?.n ?? 0) >= MAX_SUBSCRIPTIONS) {
			return Response.json({ error: "Too many subscriptions" }, { status: 503 });
		}

		await env.DB.prepare(
			`INSERT INTO push_subscriptions (endpoint, p256dh, auth, preferences, created_at) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, preferences = excluded.preferences`,
		)
			.bind(endpoint, keys.p256dh, keys.auth, JSON.stringify(preferences), new Date().toISOString())
			.run();

		return Response.json({ ok: true, preferences });
	} catch (error) {
		if (error instanceof SyntaxError) return errorResponse(new BadRequest("Invalid JSON"));
		return errorResponse(error);
	}
}

export async function DELETE(req: NextRequest)
{
	try {
		const env = await getEnv();
		if (!env) return Response.json({ ok: true });
		const { endpoint } = (await req.json()) as { endpoint?: string };
		if (!validEndpoint(endpoint)) throw new BadRequest("Unsupported push endpoint");
		await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
		return Response.json({ ok: true });
	} catch (error) {
		return errorResponse(error);
	}
}
