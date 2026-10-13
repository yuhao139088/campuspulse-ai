import { afterEach, describe, expect, it, vi } from "vitest";
import Client from "@alicloud/dypnsapi20170525";
import { checkAliyunSms, sendAliyunSms } from "../aliyun-sms";
import { smsConfigured } from "../sms";
import type { SecurityConfig } from "../config";

const config = { smsEnabled: true, smsProvider: "aliyun", smsAccount: "test-access-id", smsToken: "test-access-secret", smsTemplate: "100001", smsTemplateChange: "100002", smsTemplateReset: "100003", smsTemplateBind: "100004", smsTemplateVerify: "100005", smsSign: "恒创联众", smsScheme: "CampusPulse" } as SecurityConfig;
const delivery = { provider: "aliyun", scheme: "CampusPulse_login", outId: "request-reference", verified: false } as const;
afterEach(() => vi.restoreAllMocks());

describe("Aliyun PNVS verification", () => {
  it.each([["register", "100001"], ["login", "100001"], ["change_phone", "100002"], ["reset_password", "100003"], ["bind_phone", "100004"], ["verify_phone", "100005"]])("uses the configured template for %s", async (purpose, template) => {
    const send = vi.spyOn(Client.prototype, "sendSmsVerifyCodeWithOptions").mockResolvedValue({ body: { code: "OK", success: true, model: { verifyCode: "012345" } } } as never);
    await sendAliyunSms(config, "+8613800138000", purpose);
    expect(send.mock.calls[0][0].templateCode).toBe(template);
    expect(send.mock.calls[0][0].schemeName!.length).toBeLessThanOrEqual(20);
  });
  it("requests cloud-generated numeric codes with matching validity, signature and template variables", async () => {
    const send = vi.spyOn(Client.prototype, "sendSmsVerifyCodeWithOptions").mockResolvedValue({ body: { code: "OK", success: true, model: { verifyCode: "012345" } } } as never);
    const result = await sendAliyunSms(config, "+8613800138000", "register");
    expect(send.mock.calls[0][0]).toMatchObject({ countryCode: "86", phoneNumber: "13800138000", signName: "恒创联众", templateCode: "100001", templateParam: '{"code":"##code##","min":"10"}', codeLength: 6, codeType: 1, validTime: 600, interval: 60, duplicatePolicy: 1, returnVerifyCode: true, schemeName: "CampusPulse_register" });
    expect(result.code).toBe("012345");
    expect(result.delivery.verified).toBe(false);
    expect(smsConfigured(config)).toBe(true);
  });
  it("requires PASS, not just OK or Success, and binds the verification scene and reference", async () => {
    const check = vi.spyOn(Client.prototype, "checkSmsVerifyCodeWithOptions").mockResolvedValue({ body: { code: "OK", success: true, model: { verifyResult: "UNKNOWN" } } } as never);
    await expect(checkAliyunSms(config, "+8613800138000", "012345", delivery)).rejects.toThrow("Code expired or invalid");
    expect(check.mock.calls[0][0]).toMatchObject({ phoneNumber: "13800138000", schemeName: "CampusPulse_login", outId: "request-reference", verifyCode: "012345" });
    check.mockResolvedValue({ body: { code: "OK", success: true, model: { verifyResult: "PASS", outId: "other" } } } as never);
    await expect(checkAliyunSms(config, "+8613800138000", "012345", delivery)).rejects.toThrow("Code expired or invalid");
    check.mockResolvedValue({ body: { code: "OK", success: true, model: { verifyResult: "PASS", outId: "request-reference" } } } as never);
    await expect(checkAliyunSms(config, "+8613800138000", "012345", delivery)).resolves.toBeUndefined();
  });
  it("reports provider status without leaking SDK messages, access secrets or verification codes", async () => {
    vi.spyOn(Client.prototype, "sendSmsVerifyCodeWithOptions").mockRejectedValue({ code: "Forbidden.RAM", message: "secret=" + config.smsToken });
    await expect(sendAliyunSms(config, "+8613800138000", "login")).rejects.toThrow("Forbidden.RAM");
    await expect(sendAliyunSms(config, "+8613800138000", "login")).rejects.not.toThrow(config.smsToken!);
  });
  it("verifies both actual send and actual cloud check in the administrator diagnostic", async () => {
    vi.spyOn(Client.prototype, "sendSmsVerifyCodeWithOptions").mockResolvedValue({ body: { code: "OK", success: true, model: { verifyCode: "012345" } } } as never);
    const check = vi.spyOn(Client.prototype, "checkSmsVerifyCodeWithOptions").mockResolvedValue({ body: { code: "OK", success: true, model: { verifyResult: "PASS" } } } as never);
    expect((await sendAliyunSms(config, "+8613800138000", "sms_test")).delivery.verified).toBe(true);
    expect(check).toHaveBeenCalledOnce();
  });
});
