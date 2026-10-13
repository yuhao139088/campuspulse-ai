import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function generateTotpSecret() {
  let bits = "";
  for (const byte of randomBytes(20)) bits += byte.toString(2).padStart(8, "0");
  let encoded = "";
  for (let offset = 0; offset < bits.length; offset += 5) encoded += alphabet[parseInt(bits.slice(offset, offset + 5).padEnd(5, "0"), 2)];
  return encoded;
}
function decode(secret: string) {
  let bits = "";
  for (const char of secret.toUpperCase().replace(/=|\s/g, "")) { const index = alphabet.indexOf(char); if (index < 0) throw new Error("Invalid TOTP secret"); bits += index.toString(2).padStart(5,"0"); }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(parseInt(bits.slice(offset,offset+8),2));
  return Buffer.from(bytes);
}
export function totpCode(secret: string, time = Date.now(), digits = 6) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)));
  const digest = createHmac("sha1", decode(secret)).update(counter).digest();
  const offset = digest[digest.length-1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits)).toString().padStart(digits,"0");
}
export function matchingTotpStep(secret: string, input: string, time = Date.now()) {
  if (!/^\d{6}$/.test(input)) return null;
  const step = Math.floor(time / 30000);
  for (const candidate of [step-1,step,step+1]) if (timingSafeEqual(Buffer.from(totpCode(secret,candidate*30000)), Buffer.from(input))) return BigInt(candidate);
  return null;
}
