import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ user: vi.fn(), send: vi.fn(), owner: vi.fn() }));
vi.mock("@/lib/access", () => ({ currentUser: mocks.user, ApiError: class extends Error { constructor(public status: number, message: string) { super(message); } }, apiFailure: (error: { status?: number; message: string }) => NextResponse.json({ error: error.message }, { status: error.status ?? 500 }) }));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: () => true }));
vi.mock("@/lib/security/captcha", () => ({ verifyCaptcha: async () => undefined }));
vi.mock("@/lib/security/config", () => ({ securityConfig: async () => ({ registrationEnabled: true, phoneLogin: true }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst: mocks.owner } } }));
vi.mock("@/lib/security/verification", () => ({ sendCode: mocks.send, normalizePhone: (phone: string) => phone.startsWith("+") ? phone : "+86" + phone }));
import { POST } from "@/app/api/auth/code/route";

beforeEach(() => { vi.clearAllMocks(); mocks.owner.mockResolvedValue(null); mocks.send.mockResolvedValue({ sent: true }); });
const request = (purpose: string, target = "13800138000") => new Request("http://localhost/api/auth/code", { method: "POST", body: JSON.stringify({ channel: "sms", purpose, target }) });

describe("trusted phone template routing", () => {
  it("uses the change template only when the authenticated account already has another phone", async () => {
    mocks.user.mockResolvedValue({ id: "owner", demo: false, phone: "+8613900139000" });
    expect((await POST(request("bind_phone"))).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith("sms", "+8613800138000", "bind_phone", "owner", "change_phone");
  });
  it("uses the new linking template for accounts without a phone", async () => {
    mocks.user.mockResolvedValue({ id: "owner", demo: false, phone: null });
    expect((await POST(request("bind_phone"))).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith("sms", "+8613800138000", "bind_phone", "owner", undefined);
  });
  it("restricts existing-phone verification to the authenticated user's linked number", async () => {
    mocks.user.mockResolvedValue({ id: "owner", demo: false, phone: "+8613900139000" });
    expect((await POST(request("verify_phone"))).status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
    expect((await POST(request("verify_phone", "13900139000"))).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith("sms", "+8613900139000", "verify_phone", "owner", undefined);
  });
});
