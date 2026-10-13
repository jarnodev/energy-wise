// Generates a VAPID key pair for Web Push.
// Put the public key in wrangler.jsonc (vars.VAPID_PUBLIC_KEY) and store the private key as a secret:
//   npx wrangler secret put VAPID_PRIVATE_KEY
// For local development, add both to .dev.vars.
const toBase64Url = (bytes) => Buffer.from(bytes).toString("base64url");

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
const { d } = await crypto.subtle.exportKey("jwk", pair.privateKey);

console.log(`VAPID_PUBLIC_KEY=${toBase64Url(publicKey)}`);
console.log(`VAPID_PRIVATE_KEY=${d}`);
