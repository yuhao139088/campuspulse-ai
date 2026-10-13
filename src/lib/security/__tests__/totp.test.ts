import { describe, expect, it, beforeAll } from "vitest";
import { generateTotpSecret, matchingTotpStep, totpCode } from "../totp";
import { encryptSecret, decryptSecret, codeHash } from "../crypto";
const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
describe("RFC 6238 authentication", () => {
  it.each([[59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"]])("matches the SHA1 reference vector at %i", (seconds, expected) => { expect(totpCode(secret, Number(seconds) * 1000, 8)).toBe(expected); });
  it("accepts only a current six-digit code within one time step", () => { const time = 1234567890000; expect(matchingTotpStep(secret, totpCode(secret, time), time)).toBe(BigInt(Math.floor(time / 30000))); expect(matchingTotpStep(secret, totpCode(secret, time - 90000), time)).toBeNull(); expect(matchingTotpStep(secret, "NaN", time)).toBeNull(); });
  it("creates distinct 160-bit base32 secrets", () => { const first = generateTotpSecret(); expect(first).toMatch(/^[A-Z2-7]{32}$/); expect(generateTotpSecret()).not.toBe(first); });
});
describe("encrypted service secrets", () => {
  beforeAll(() => { process.env.NEXTAUTH_SECRET = "unit-test-key-not-for-production"; });
  it("round-trips secrets and rejects tampered data", () => { const sealed = encryptSecret("private-smtp-credential"); expect(sealed).not.toContain("private-smtp"); expect(decryptSecret(sealed)).toBe("private-smtp-credential"); const parts = sealed.split("."); const body = Buffer.from(parts[2], "base64"); body[0] ^= 1; parts[2] = body.toString("base64"); expect(() => decryptSecret(parts.join("."))).toThrow(); });
  it("hashes challenges with the authentication secret", () => { expect(codeHash("111111")).toHaveLength(64); expect(codeHash("111111")).not.toBe(codeHash("222222")); });
});
