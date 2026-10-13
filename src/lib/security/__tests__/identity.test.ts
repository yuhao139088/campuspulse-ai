import { describe, expect, it } from "vitest";
import { identityMethods, requireIdentityMethod, validateSecurityAction } from "../identity";
import { normalizeSecurityIntent, securityIntentContext } from "../intent";
import type { SecurityConfig } from "../config";

const user = { email: "owner@example.com", phone: null, totpEnabled: false, totpSecret: null, recoveryCodes: [] };
const config = { smtpUser: "sender", smtpPassword: "secret", totpAllowed: true, smsEnabled: true, smsProvider: "aliyun", smsAccount: "test", smsToken: "secret", smsTemplate: "100001", smsScheme: "CampusPulse", smsSign: "test" } as SecurityConfig;
describe("linked identity methods and intent boundaries", () => {
  it("only offers previously linked methods with configured delivery", () => {
    expect(identityMethods(user, config)).toEqual(["email"]);
    expect(identityMethods({ ...user, email: null }, config)).toEqual([]);
    expect(identityMethods({ ...user, phone: "+8613800138000", totpEnabled: true, totpSecret: "encrypted", recoveryCodes: ["hash"] }, config)).toEqual(["email", "sms", "totp", "recovery"]);
    expect(identityMethods({ ...user, phone: "+14155550123" }, config)).toEqual(["email"]);
    expect(identityMethods(user, { ...config, smtpPassword: undefined })).toEqual([]);
  });
  it.each(["sms", "totp", "recovery"] as const)("rejects unlinked %s even if a caller requests it", (method) => {
    expect(() => requireIdentityMethod(user, config, method)).toThrow("not linked");
  });
  it("binds authorization to the action and contact while authorizing password entry only after verification", () => {
    const intent = normalizeSecurityIntent({ action: "bind_email", target: " NEW@Example.COM ", code: "123456" });
    expect(intent.target).toBe("new@example.com");
    const context = securityIntentContext(intent);
    expect(securityIntentContext({ ...intent, target: "other@example.com" })).not.toBe(context);
    expect(securityIntentContext({ ...intent, action: "bind_phone" })).not.toBe(context);
    expect(securityIntentContext({ ...intent, code: "654321" })).toBe(context);
    expect(normalizeSecurityIntent({ action: "password" }).newPassword).toBe("");
    expect(securityIntentContext(normalizeSecurityIntent({ action: "password", newPassword: "IgnoredPassword1" }))).toBe(JSON.stringify(["password", "", ""]));
  });
  it("requires the current bound phone and a new contact verification code", () => {
    expect(() => validateSecurityAction(user, config, normalizeSecurityIntent({ action: "verify_phone", target: "13800138000", code: "123456" }))).toThrow("linked phone");
    expect(() => validateSecurityAction(user, config, normalizeSecurityIntent({ action: "bind_email", target: "new@example.com" }))).toThrow("contact verification code");
    expect(() => validateSecurityAction(user, config, normalizeSecurityIntent({ action: "disable" }))).toThrow("not enabled");
  });
});
