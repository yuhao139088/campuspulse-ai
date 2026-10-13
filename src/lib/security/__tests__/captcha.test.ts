import { beforeEach, describe, expect, it, vi } from "vitest";
const fixtures = vi.hoisted(() => ({ result: vi.fn(), create: vi.fn(), lookup: vi.fn(), remove: vi.fn() }));
vi.mock("tencentcloud-sdk-nodejs-captcha", () => ({ captcha: { v20190722: { Client: class { DescribeCaptchaResult = fixtures.result; } } } }));
vi.mock("@/lib/prisma", () => ({ prisma: { systemConfig: { findUnique: vi.fn().mockResolvedValue(null) }, verificationToken: { findUnique: fixtures.lookup, create: fixtures.create, deleteMany: fixtures.remove } } }));
import { captchaResultAccepted, verifyCaptcha, issueCaptchaGate, checkCaptchaGate, consumeCaptchaGate } from "../captcha";
beforeEach(() => {
  vi.clearAllMocks(); process.env.DEMO_AUTH_ENABLED = "false"; process.env.NEXTAUTH_SECRET = "captcha-unit-secret";
  Object.assign(process.env, { CAPTCHA_ENABLED: "true", CAPTCHA_NORMAL_APP_ID: "1", CAPTCHA_INVISIBLE_APP_ID: "2", CAPTCHA_NORMAL_SECRET: "normal-unit-secret", CAPTCHA_INVISIBLE_SECRET: "invisible-unit-secret", TENCENT_CAPTCHA_SECRET_ID: "unit-id", TENCENT_CAPTCHA_SECRET_KEY: "unit-key" });
  fixtures.create.mockResolvedValue({}); fixtures.remove.mockResolvedValue({ count: 1 });
});
describe("Tencent risk validation", () => {
  it("requires a successful ticket and zero evil level for invisible mode", () => { expect(captchaResultAccepted({ CaptchaCode: 1 }, "normal")).toBe(true); expect(captchaResultAccepted({ CaptchaCode: 1, EvilLevel: 0 }, "invisible")).toBe(true); expect(captchaResultAccepted({ CaptchaCode: 1, EvilLevel: 100 }, "invisible")).toBe(false); expect(captchaResultAccepted({ CaptchaCode: 1 }, "invisible")).toBe(false); expect(captchaResultAccepted({ CaptchaCode: 15, EvilLevel: 0 }, "invisible")).toBe(false); });
  it("does not accept absent tickets or frontend disaster fallback tickets", async () => { const headers = new Headers({ "x-forwarded-for": "192.0.2.1" }); await expect(verifyCaptcha(headers, undefined, "normal")).rejects.toThrow(); await expect(verifyCaptcha(headers, { ticket: "trerror-fallback", randstr: "random" }, "normal")).rejects.toThrow(); expect(fixtures.result).not.toHaveBeenCalled(); });
  it("checks the correct app, trusted caller IP and risk result", async () => { fixtures.result.mockResolvedValue({ CaptchaCode: 1, EvilLevel: 0 }); await verifyCaptcha(new Headers({ "x-forwarded-for": "192.0.2.2" }), { ticket: "test-ticket", randstr: "random" }, "invisible"); expect(fixtures.result).toHaveBeenCalledWith(expect.objectContaining({ CaptchaAppId: 2, UserIp: "192.0.2.2", CaptchaType: 9 })); });
  it("rejects a malicious request even when Tencent returns a ticket", async () => { fixtures.result.mockResolvedValue({ CaptchaCode: 1, EvilLevel: 100 }); await expect(verifyCaptcha(new Headers({ "x-forwarded-for": "192.0.2.3" }), { ticket: "malicious-ticket", randstr: "random" }, "invisible")).rejects.toThrow("did not pass"); });
});
describe("first-step grants", () => {
  it("separates action authorization, enrollment and second-factor login from primary login", async () => {
    const proof = await issueCaptchaGate("security", "person", 3, '["password","","new-password"]', "192.0.2.9");
    fixtures.lookup.mockResolvedValue(fixtures.create.mock.calls[0][0].data);
    await expect(checkCaptchaGate("security", proof, "person", 3, '["password","","other-password"]', "192.0.2.9")).rejects.toThrow();
    await expect(checkCaptchaGate("enrollment", proof, "person", 3, '["password","","new-password"]', "192.0.2.9")).rejects.toThrow();
    await expect(checkCaptchaGate("login_factor", proof, "person", 3, '["password","","new-password"]', "192.0.2.9")).rejects.toThrow();
  });
  it("binds the proof to the user, auth version, operation and IP", async () => { const proof = await issueCaptchaGate("login", "person", 3, "email", "192.0.2.5"); const saved = fixtures.create.mock.calls[0][0].data; fixtures.lookup.mockResolvedValue(saved); expect(proof).toHaveLength(43); expect(saved.token).not.toBe(proof); await expect(checkCaptchaGate("login", proof, "person", 3, "email", "192.0.2.5")).resolves.toBe(saved.token); await expect(checkCaptchaGate("login", proof, "other", 3, "email", "192.0.2.5")).rejects.toThrow(); await expect(checkCaptchaGate("login", proof, "person", 4, "email", "192.0.2.5")).rejects.toThrow(); await expect(checkCaptchaGate("reset", proof, "person", 3, "email", "192.0.2.5")).rejects.toThrow(); await expect(checkCaptchaGate("login", proof, "person", 3, "email", "192.0.2.6")).rejects.toThrow(); });
  it("keeps the primary login and second-factor window usable while switching to an authenticator", async () => { const before = Date.now(); await issueCaptchaGate("login_factor", "person", 3, "email", "192.0.2.5"); const saved = fixtures.create.mock.calls[fixtures.create.mock.calls.length - 1][0].data; expect(saved.expires.getTime() - before).toBeGreaterThanOrEqual(899000); expect(saved.expires.getTime() - before).toBeLessThanOrEqual(901000); });
  it("rejects expired proofs and concurrent consumption", async () => { fixtures.lookup.mockResolvedValue({ identifier: "wrong", expires: new Date(0) }); await expect(checkCaptchaGate("login", "expired", "person", 0, "email", "192.0.2.7")).rejects.toThrow(); fixtures.remove.mockResolvedValue({ count: 0 }); await expect(consumeCaptchaGate("token")).rejects.toThrow("already used"); });
});
