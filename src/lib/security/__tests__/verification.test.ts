import { beforeEach, describe, expect, it, vi } from "vitest";
const fixtures = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), consume: vi.fn(), config: vi.fn(), cloud: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { verificationCode: { findFirst: fixtures.find, update: fixtures.update, updateMany: fixtures.consume } } }));
vi.mock("../config", () => ({ securityConfig: fixtures.config }));
vi.mock("../aliyun-sms", () => ({ checkAliyunSms: fixtures.cloud, sendAliyunSms: vi.fn() }));
import { consumeCode, normalizePhone } from "../verification";
import { codeHash } from "../crypto";
beforeEach(() => { vi.clearAllMocks(); process.env.NEXTAUTH_SECRET = "verification-unit-secret"; fixtures.update.mockResolvedValue({}); fixtures.consume.mockResolvedValue({ count: 1 }); });
describe("verification challenge consumption", () => {
  const challenge = () => ({ id: "challenge", usedAt: null, attempts: 0, expiresAt: new Date(Date.now() + 60000), hash: codeHash("email:person@example.com:register:543210") });
  it("consumes a correct unused code atomically", async () => { fixtures.find.mockResolvedValue(challenge()); await consumeCode("email", "person@example.com", "register", "543210"); expect(fixtures.consume).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "challenge", usedAt: null }) })); });
  it.each(["used", "expired", "attempts"])("rejects a %s challenge", async (reason) => { fixtures.find.mockResolvedValue({ ...challenge(), ...(reason === "used" ? { usedAt: new Date() } : reason === "expired" ? { expiresAt: new Date(0) } : { attempts: 5 }) }); await expect(consumeCode("email", "person@example.com", "register", "543210")).rejects.toThrow(); expect(fixtures.consume).not.toHaveBeenCalled(); });
  it("records a wrong attempt without consuming the challenge", async () => { fixtures.find.mockResolvedValue(challenge()); await expect(consumeCode("email", "person@example.com", "register", "111111")).rejects.toThrow(); expect(fixtures.update).toHaveBeenCalled(); expect(fixtures.consume).not.toHaveBeenCalled(); });
  it("rejects a code consumed by a concurrent request", async () => { fixtures.find.mockResolvedValue(challenge()); fixtures.consume.mockResolvedValue({ count: 0 }); await expect(consumeCode("email", "person@example.com", "register", "543210")).rejects.toThrow("already used"); });
  it("binds the lookup to the authenticated user", async () => { fixtures.find.mockResolvedValue(null); await expect(consumeCode("sms", "+8613800138000", "bind_phone", "543210", "owner")).rejects.toThrow(); expect(fixtures.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "owner", purpose: "bind_phone" }) })); });
});
describe("phone identity", () => {
  it("normalizes Chinese and international numbers", () => { expect(normalizePhone("13800138000")).toBe("+8613800138000"); expect(normalizePhone("+1 (415) 555-0123")).toBe("+14155550123"); });
  it("rejects unsupported or malformed identity strings", () => { expect(() => normalizePhone("person@example.com")).toThrow(); expect(() => normalizePhone("123")).toThrow(); });
  it.each(["11111111111", "+8611111111111", "+8613800", "+8600000000000", "+9991234567890"])("rejects arbitrary digits or invalid mobile prefixes: %s", (phone) => { expect(() => normalizePhone(phone)).toThrow(); });
});

describe("cloud SMS validation before local one-use consumption", () => {
  const delivery = { provider: "aliyun", scheme: "CampusPulse_login", outId: "request", verified: false };
  const challenge = () => ({ id: "sms", usedAt: null, attempts: 0, expiresAt: new Date(Date.now() + 60000), hash: codeHash("sms:+8613800138000:login:012345"), delivery });
  it("requires cloud verification before consuming, then records the precheck for the 2FA stage", async () => {
    fixtures.config.mockResolvedValue({ smsEnabled: true, smsProvider: "aliyun", smsAccount: "test", smsToken: "test", smsTemplate: "100001", smsSign: "test", smsScheme: "CampusPulse" });
    fixtures.find.mockResolvedValue(challenge()); fixtures.cloud.mockResolvedValue(undefined);
    await consumeCode("sms", "+8613800138000", "login", "012345");
    expect(fixtures.cloud).toHaveBeenCalledOnce();
    expect(fixtures.update).toHaveBeenCalledWith({ where: { id: "sms" }, data: { delivery: { ...delivery, verified: true } } });
    expect(fixtures.consume).toHaveBeenCalledOnce();
  });
  it("never consumes a locally matched code when the cloud rejects it", async () => {
    fixtures.config.mockResolvedValue({ smsEnabled: true, smsProvider: "aliyun", smsAccount: "test", smsToken: "test", smsTemplate: "100001", smsSign: "test", smsScheme: "CampusPulse" });
    fixtures.find.mockResolvedValue(challenge()); fixtures.cloud.mockRejectedValue(new Error("cloud rejected"));
    await expect(consumeCode("sms", "+8613800138000", "login", "012345")).rejects.toThrow("cloud rejected");
    expect(fixtures.consume).not.toHaveBeenCalled();
  });
  it("does not reconsume a cloud-verified code while finishing primary sign-in after 2FA", async () => {
    fixtures.find.mockResolvedValue({ ...challenge(), delivery: { ...delivery, verified: true } });
    await consumeCode("sms", "+8613800138000", "login", "012345");
    expect(fixtures.cloud).not.toHaveBeenCalled();
    expect(fixtures.consume).toHaveBeenCalledOnce();
  });
});
