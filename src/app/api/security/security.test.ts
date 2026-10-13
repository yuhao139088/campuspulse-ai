import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ user: vi.fn(), config: vi.fn(), captcha: vi.fn(), issue: vi.fn(), check: vi.fn(), consumeGate: vi.fn(), send: vi.fn(), consumeCode: vi.fn(), validateCode: vi.fn(), factor: vi.fn(), update: vi.fn(), owner: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/access", async () => ({ currentUser: mocks.user, audit: mocks.audit, ApiError: (await import("@/lib/errors")).ApiError, apiFailure: (error: { status?: number; message: string }) => NextResponse.json({ error: error.message }, { status: error.status ?? 400 }) }));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: () => true }));
vi.mock("@/lib/workspace", () => ({ getPersonalSpace: async () => ({ id: "space" }) }));
vi.mock("@/lib/security/config", () => ({ securityConfig: mocks.config }));
vi.mock("@/lib/security/captcha", () => ({ verifyCaptcha: mocks.captcha, issueCaptchaGate: mocks.issue, checkCaptchaGate: mocks.check, consumeCaptchaGate: mocks.consumeGate, requestIp: () => "192.0.2.50" }));
vi.mock("@/lib/security/verification", () => ({ sendCode: mocks.send, consumeCode: mocks.consumeCode, validateCode: mocks.validateCode }));
vi.mock("@/lib/security/factor", () => ({ verifyFactor: mocks.factor }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { updateMany: mocks.update, findFirst: mocks.owner } } }));
import { GET as methods, POST as verify } from "./verify/route";
import { POST as perform } from "./route";

const intent = { action: "password", newPassword: "NewPassword123!" };
const passwordUpdate = { action: "password", newPassword: "NewPassword123!", proof: "issued-proof", captcha: { ticket: "invisible" } };
const request = (body: unknown) => new Request("https://example.com/api/security", { method: "POST", headers: { "x-forwarded-for": "192.0.2.50" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks(); process.env.NEXTAUTH_SECRET = "security-proof-test-secret";
  mocks.user.mockResolvedValue({ id: "owner", demo: false, authVersion: 3, email: "old@example.com", phone: null, totpEnabled: false, totpSecret: null, recoveryCodes: [] });
  mocks.config.mockResolvedValue({ smtpUser: "sender", smtpPassword: "secret", totpAllowed: true, smsEnabled: false });
  mocks.captcha.mockResolvedValue(true); mocks.issue.mockResolvedValue("issued-proof"); mocks.check.mockResolvedValue("proof-hash"); mocks.consumeGate.mockResolvedValue(undefined);
  mocks.send.mockResolvedValue({ sent: true, resendAfter: 60 }); mocks.consumeCode.mockResolvedValue(undefined); mocks.validateCode.mockResolvedValue({}); mocks.factor.mockResolvedValue(true);
  mocks.update.mockResolvedValue({ count: 1 }); mocks.owner.mockResolvedValue(null);
});

describe("account security verification protocol", () => {
  it("returns only a masked linked email for an account without phone or 2FA", async () => {
    expect(await (await methods()).json()).toEqual({ methods: [{ id: "email", destination: "ol***@example.com" }] });
  });
  it("delivers to the existing contact rather than the new address in the intent, with normal CAPTCHA", async () => {
    const response = await verify(request({ stage: "send", method: "email", intent: { action: "bind_email", target: "new@example.com", code: "123456" }, captcha: { ticket: "normal" } }));
    expect(response.status).toBe(200);
    expect(mocks.send.mock.calls[0][1]).toBe("old@example.com");
    expect(mocks.send.mock.calls[0][3]).toBe("owner");
    expect(mocks.captcha.mock.calls[0][2]).toBe("normal");
  });
  it("refuses unlinked methods before consuming codes or granting anything", async () => {
    const response = await verify(request({ stage: "verify", method: "totp", code: "123456", intent }));
    expect(response.status).toBe(403); expect(mocks.factor).not.toHaveBeenCalled(); expect(mocks.issue).not.toHaveBeenCalled();
  });
  it("requires invisible CAPTCHA and one-use verification before issuing an action-bound proof", async () => {
    const response = await verify(request({ stage: "verify", method: "email", code: "123456", intent, captcha: { ticket: "invisible" } }));
    expect(await response.json()).toEqual({ proof: "issued-proof", expiresIn: 300 });
    expect(mocks.captcha.mock.calls[0][2]).toBe("invisible");
    expect(mocks.consumeCode.mock.calls[0][1]).toBe("old@example.com");
    expect(mocks.issue).toHaveBeenCalledWith("security", "owner", 3, JSON.stringify(["password", "", ""]), "192.0.2.50");
  });
  it("does not issue a grant or consume identity codes after CAPTCHA failure", async () => {
    mocks.captcha.mockRejectedValue(new Error("captcha rejected"));
    expect((await verify(request({ stage: "verify", method: "email", code: "123456", intent }))).status).toBe(400);
    expect(mocks.consumeCode).not.toHaveBeenCalled(); expect(mocks.issue).not.toHaveBeenCalled();
  });
  it("rejects the old password-only endpoint contract and missing proofs", async () => {
    expect((await perform(request({ action: "password", password: "old", newPassword: "NewPassword123!" }))).status).toBe(400);
    expect((await perform(request({ intent }))).status).toBe(400); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("checks and atomically consumes a proof before a version-guarded credential change", async () => {
    const response = await perform(request(passwordUpdate));
    expect(response.status).toBe(200); expect(mocks.check.mock.calls[0][0]).toBe("security"); expect(mocks.consumeGate).toHaveBeenCalledWith("proof-hash");
    expect(mocks.update.mock.calls[0][0].where).toEqual({ id: "owner", authVersion: 3 });
    expect(mocks.update.mock.calls[0][0].data.authVersion).toEqual({ increment: 1 });
    expect(mocks.captcha.mock.calls[0][2]).toBe("invisible");
  });
  it("does not mutate on a wrong, expired or reused proof", async () => {
    mocks.check.mockRejectedValue(new Error("invalid proof"));
    expect((await perform(request({ ...passwordUpdate, proof: "bad" }))).status).toBe(400); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("detects concurrent account changes without overwriting them", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect((await perform(request(passwordUpdate))).status).toBe(409);
  });
  it("requires fresh invisible verification when submitting a new password even after identity authorization", async () => {
    mocks.captcha.mockRejectedValue(new Error("human verification missing"));
    expect((await perform(request(passwordUpdate))).status).toBe(400);
    expect(mocks.consumeGate).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects the previous one-step password action and passwords above the bcrypt byte limit", async () => {
    expect((await perform(request({ intent, proof: "issued-proof" }))).status).toBe(400);
    expect((await perform(request({ ...passwordUpdate, newPassword: "密".repeat(25) }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
