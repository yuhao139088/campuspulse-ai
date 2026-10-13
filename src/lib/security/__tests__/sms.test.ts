import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverSms, smsConfigured } from "../sms";
import type { SecurityConfig } from "../config";

const config = { smsEnabled: true, smsProvider: "ihuyi", smsAccount: "test-account", smsToken: "test-secret", smsTemplate: "1", smsUrl: "https://unused.example", smsSign: "CampusPulse AI" } as SecurityConfig;
afterEach(() => vi.unstubAllGlobals());

describe("Ihuyi SMS delivery", () => {
  it("submits template variables as a POST form with mainland mobile normalization", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 2, smsid: "accepted" }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await deliverSms(config, "+8613800138000", "123456", "register");
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.ihuyi.com/sms/Submit.json");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(options.body)).toEqual({ account: "test-account", password: "test-secret", mobile: "13800138000", content: "123456", templateid: "1" });
    expect(url).not.toContain("test-secret");
  });
  it("does not mistake HTTP 200, provider errors or arbitrary ok:true for successful sending", async () => {
    for (const payload of [{ code: 405 }, { code: 4051 }, { ok: true }, { code: 4071, msg: "sensitive provider details" }]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
      await expect(deliverSms(config, "+8613800138000", "123456", "login")).rejects.toThrow("SMS provider declined");
    }
  });
  it("rejects unsupported countries and missing credentials before sending", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(deliverSms(config, "+14155550123", "123456", "login")).rejects.toThrow("mainland China");
    expect(smsConfigured({ ...config, smsToken: "" })).toBe(false);
    expect(smsConfigured({ ...config, smsTemplate: "" })).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("retains generic gateways with explicit provider acceptance", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"ok":true}')); vi.stubGlobal("fetch", fetcher);
    await deliverSms({ ...config, smsProvider: "gateway" }, "+14155550123", "123456", "bind_phone");
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer test-secret");
  });
});
