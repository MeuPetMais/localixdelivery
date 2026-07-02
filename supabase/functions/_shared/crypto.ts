// AES-GCM encryption for OAuth tokens at rest.
// Chave: MP_TOKEN_ENC_KEY (>=32 chars). Derivada via SHA-256 para 32 bytes.

const enc = new TextEncoder();
const dec = new TextDecoder();

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("MP_TOKEN_ENC_KEY");
  if (!raw) throw new Error("MP_TOKEN_ENC_KEY não configurada");
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64d(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptToken(plain: string): Promise<string> {
  if (!plain) return "";
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plain),
  );
  return `v1:${b64(iv)}:${b64(ct)}`;
}

export async function decryptToken(payload: string | null): Promise<string | null> {
  if (!payload) return null;
  if (!payload.startsWith("v1:")) return payload; // legado / plaintext
  const [, ivB, ctB] = payload.split(":");
  const key = await getKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64d(ivB) },
    key,
    b64d(ctB),
  );
  return dec.decode(pt);
}

export function randomBase64Url(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function pkceChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(verifier));
  return b64(digest).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
