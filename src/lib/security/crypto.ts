import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
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
