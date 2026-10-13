// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ human: vi.fn() }));
vi.mock("@/lib/locale", () => ({ useAppLocale: () => ["zh", vi.fn()] }));
vi.mock("@/lib/captcha-client", () => ({ verifyHumanInDialog: mocks.human, isCaptchaRiskFailure: (problem: unknown) => String(problem).includes("Human verification did not pass") }));
import { IdentityDialog } from "./identity-dialog";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const intent = { action: "password", target: "", newPassword: "NewPassword123!", code: "" } as const;

describe("sensitive action dialog", () => {
  it("only offers linked methods, contains no password input, and keeps its list inside the modal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ methods: [{ id: "email", destination: "ol***@example.com" }, { id: "totp", destination: null }] }))));
    render(createElement(IdentityDialog, { intent, onVerified: vi.fn(), onCancel: vi.fn() }));
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "验证方式" }).textContent).toBe("邮箱验证码"));
    expect(document.querySelector('input[type="password"]')).toBeNull();
    await user.click(screen.getByRole("combobox", { name: "验证方式" }));
    expect(screen.queryByRole("option", { name: "手机验证码" })).toBeNull();
    expect(screen.getByRole("listbox").closest("dialog")).toBeTruthy();
    await user.click(screen.getByRole("option", { name: "Authenticator认证码" }));
    expect(screen.getByText("使用已绑定的Authenticator")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "发送验证码" })).toBeNull();
  });
  it("uses normal CAPTCHA for sending and invisible CAPTCHA for confirmation", async () => {
    const requests: Record<string, unknown>[] = [];
    const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
      if (!options?.body) return new Response(JSON.stringify({ methods: [{ id: "email", destination: "ol***@example.com" }] }));
      const body = JSON.parse(String(options.body)); requests.push(body);
      return new Response(JSON.stringify(body.stage === "send" ? { sent: true, resendAfter: 60 } : { proof: "one-use-proof" }));
    });
    vi.stubGlobal("fetch", fetcher); mocks.human.mockResolvedValue({ ticket: "verified", randstr: "random" });
    const verified = vi.fn().mockResolvedValue(undefined);
    render(createElement(IdentityDialog, { intent, onVerified: verified, onCancel: vi.fn() }));
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: "发送验证码" })).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "发送验证码" }));
    expect(mocks.human.mock.calls[0][1]).toBe("normal");
    await user.type(screen.getByRole("textbox", { name: "验证码" }), "123456");
    await user.click(screen.getByRole("button", { name: "验证并继续" }));
    await waitFor(() => expect(verified).toHaveBeenCalledWith("one-use-proof", "invisible"));
    expect(mocks.human.mock.calls[1][1]).toBe("invisible");
    expect(requests.map((item) => item.stage)).toEqual(["send", "verify"]);
    expect(requests[1]).toMatchObject({ method: "email", code: "123456", intent, captcha: { ticket: "verified", randstr: "random" } });
  });
  it("reports the lack of configured methods instead of falling back to a password", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"methods":[]}')));
    render(createElement(IdentityDialog, { intent, onVerified: vi.fn(), onCancel: vi.fn() }));
    await waitFor(() => expect(screen.getByText("此账号暂无可用的验证方式，请联系系统管理员。")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "验证并继续" })).toBeNull();
  });

  it("uses the normal CAPTCHA when invisible verification is rejected for risk", async () => {
    let verifyCount = 0;
    const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
      if (!options?.body) return new Response(JSON.stringify({ methods: [{ id: "email", destination: "ol***@example.com" }] }));
      const body = JSON.parse(String(options.body));
      if (body.stage === "verify" && verifyCount++ === 0) return new Response(JSON.stringify({ error: "Human verification did not pass; retry" }), { status: 403 });
      return new Response(JSON.stringify({ proof: "fallback-proof" }));
    });
    vi.stubGlobal("fetch", fetcher);
    mocks.human.mockResolvedValueOnce({ ticket: "invisible", randstr: "risk" }).mockResolvedValueOnce({ ticket: "normal", randstr: "passed" });
    const verified = vi.fn().mockResolvedValue(undefined);
    render(createElement(IdentityDialog, { intent, onVerified: verified, onCancel: vi.fn() }));
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "验证码" })).toBeTruthy());
    await user.type(screen.getByRole("textbox", { name: "验证码" }), "123456");
    await user.click(screen.getByRole("button", { name: "验证并继续" }));
    await waitFor(() => expect(verified).toHaveBeenCalledWith("fallback-proof", "normal"));
    expect(mocks.human.mock.calls.map((call) => call[1])).toEqual(["invisible", "normal"]);
  });
});
