import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
function key() {
  if (!process.env.NEXTAUTH_SECRET) throw new Error("Encryption key is not configured");
  return createHash("sha256").update(process.env.NEXTAUTH_SECRET + ":campuspulse-secrets").digest();
}
export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}
export function decryptSecret(value: string) {
  const [nonce, tag, body] = value.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(nonce, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
}
export function codeHash(value: string) { return createHash("sha256").update((process.env.NEXTAUTH_SECRET ?? "") + ":" + value).digest("hex"); }

export function signStateToken(payload: Record<string, string | number>) {
  const body = Buffer.from(JSON.stringify({ ...payload, issuedAt: Date.now() }), "utf8").toString("base64url");
  return body + "." + createHmac("sha256", key()).update(body).digest("base64url");
}

export function verifyStateToken<T extends Record<string, unknown>>(token: string, maxAgeSeconds: number): (T & { issuedAt: number }) | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(createHmac("sha256", key()).update(body).digest("base64url"));
  const provided = Buffer.from(signature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { issuedAt: number };
    if (typeof payload.issuedAt !== "number" || Date.now() - payload.issuedAt > maxAgeSeconds * 1000 || Date.now() < payload.issuedAt - 60000) return null;
    return payload;
  } catch { return null; }
}
