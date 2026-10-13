// Web Push for the Workers runtime using only WebCrypto:
// payload encryption per RFC 8291 (aes128gcm) and VAPID authentication per RFC 8292.

export type PushSubscription = {
	endpoint: string;
	p256dh: string; // Browser public key, base64url
	auth: string; // Browser auth secret, base64url
};

export type VapidKeys = {
	publicKey: string; // Uncompressed P-256 point, base64url
	privateKey: string; // Private scalar d, base64url
	subject: string; // mailto: or https: contact for the push service
};

const encoder = new TextEncoder();

type Bytes = Uint8Array<ArrayBuffer>;

export function base64UrlEncode(bytes: Bytes): string
{
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Bytes
{
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
	const binary = atob(base64);
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Bytes
{
	const result = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
	let offset = 0;
	for (const part of parts) {
		result.set(part, offset);
		offset += part.length;
	}
	return result;
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes>
{
	const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
	return new Uint8Array(bits);
}

// Imports a raw P-256 private scalar together with its public point
async function importPrivateKey(privateKey: Bytes, publicKey: Bytes, usage: "ecdh" | "ecdsa"): Promise<CryptoKey>
{
	const jwk: JsonWebKey = {
		kty: "EC",
		crv: "P-256",
		d: base64UrlEncode(privateKey),
		x: base64UrlEncode(publicKey.slice(1, 33)),
		y: base64UrlEncode(publicKey.slice(33, 65)),
	};
	return usage === "ecdh"
		? crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"])
		: crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

// Optional fixed values, only used to verify against the RFC 8291 test vector
export type EncryptOverrides = {
	senderPrivateKey: Bytes;
	senderPublicKey: Bytes;
	salt: Bytes;
};

export async function encryptPayload(subscription: PushSubscription, payload: string, overrides?: EncryptOverrides): Promise<Bytes>
{
	const receiverPublic = base64UrlDecode(subscription.p256dh);
	const authSecret = base64UrlDecode(subscription.auth);

	let senderPrivate: CryptoKey;
	let senderPublic: Bytes;
	if (overrides) {
		senderPrivate = await importPrivateKey(overrides.senderPrivateKey, overrides.senderPublicKey, "ecdh");
		senderPublic = overrides.senderPublicKey;
	} else {
		const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
		senderPrivate = pair.privateKey;
		senderPublic = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
	}

	const receiverKey = await crypto.subtle.importKey("raw", receiverPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
	const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: receiverKey }, senderPrivate, 256));

	const keyInfo = concat(encoder.encode("WebPush: info\0"), receiverPublic, senderPublic);
	const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);

	const salt = overrides?.salt ?? crypto.getRandomValues(new Uint8Array(16));
	const contentKey = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
	const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

	// Single record: payload followed by the 0x02 last-record delimiter
	const plaintext = concat(encoder.encode(payload), new Uint8Array([2]));
	const aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
	const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext));

	const recordSize = new Uint8Array(4);
	new DataView(recordSize.buffer).setUint32(0, 4096);
	return concat(salt, recordSize, new Uint8Array([senderPublic.length]), senderPublic, ciphertext);
}

export async function vapidAuthorization(endpoint: string, vapid: VapidKeys): Promise<string>
{
	const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
	const claims = base64UrlEncode(encoder.encode(JSON.stringify({
		aud: new URL(endpoint).origin,
		exp: Math.floor(Date.now() / 1000) + 12 * 3600,
		sub: vapid.subject,
	})));

	const key = await importPrivateKey(base64UrlDecode(vapid.privateKey), base64UrlDecode(vapid.publicKey), "ecdsa");
	// WebCrypto ECDSA signatures are already in the raw r||s form that JWS expects
	const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(`${header}.${claims}`)));

	return `vapid t=${header}.${claims}.${base64UrlEncode(signature)}, k=${vapid.publicKey}`;
}

export type PushMessage = {
	title: string;
	body: string;
	url?: string;
	tag?: string;
};

// Sends a notification. Returns the push service status; 404 and 410 mean the subscription is gone.
export async function sendPush(subscription: PushSubscription, message: PushMessage, vapid: VapidKeys): Promise<number>
{
	const body = await encryptPayload(subscription, JSON.stringify(message));
	const response = await fetch(subscription.endpoint, {
		method: "POST",
		headers: {
			Authorization: await vapidAuthorization(subscription.endpoint, vapid),
			"Content-Encoding": "aes128gcm",
			"Content-Type": "application/octet-stream",
			TTL: String(12 * 3600),
			Urgency: "normal",
		},
		body,
	});
	return response.status;
}
