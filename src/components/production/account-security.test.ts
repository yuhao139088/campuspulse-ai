// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const human = vi.hoisted(() => vi.fn());
vi.mock("@/lib/locale", () => ({ useAppLocale: () => ["zh", vi.fn()] }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/captcha-client", () => ({ verifyHumanInDialog: human, verifyHuman: vi.fn() }));
import AccountSecurity from "./account-security";
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("two-stage account password update", () => {
  it("offers only an update button until identity verification and requires a second CAPTCHA to save", async () => {
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
      if (!options?.body) return new Response(JSON.stringify(url.endsWith("/verify") ? { methods: [{ id: "email", destination: "ol***@example.com" }] } : { email: "old@example.com", phone: null, totpEnabled: false, totpAllowed: true, smsEnabled: false, recoveryRemaining: 0 }));
      const body = JSON.parse(String(options.body)); requests.push(body);
      return new Response(JSON.stringify(url.endsWith("/verify") ? { proof: "verified-action-proof" } : { ok: true, signInAgain: true }));
    }));
    human.mockResolvedValueOnce({ ticket: "identity", randstr: "first" }).mockResolvedValueOnce({ ticket: "password", randstr: "second" });
    render(createElement(AccountSecurity));
    const user = userEvent.setup();
    await waitFor(() => expect(screen.queryByText("正在加载…")).toBeNull());
    expect(document.querySelector('input[type="password"]')).toBeNull();
    await user.click(screen.getByRole("button", { name: /^更新密码$/ }));
    await waitFor(() => expect(within(screen.getByRole("dialog", { name: "验证当前身份" })).getByRole("button", { name: "发送验证码" })).toBeTruthy());
    expect(screen.queryByLabelText("新密码", { exact: true })).toBeNull();
    await user.type(screen.getByRole("textbox", { name: /^验证码$/ }), "123456");
    await user.click(screen.getByRole("button", { name: "验证并继续" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "设置新密码" })).toBeTruthy());
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ intent: { action: "password", newPassword: "" }, captcha: { ticket: "identity" } });
    await user.type(screen.getByLabelText("新密码", { exact: true }), "NewPassword123!");
    await user.type(screen.getByLabelText("确认新密码", { exact: true }), "NewPassword123!");
    await user.click(screen.getByRole("button", { name: "确认更新密码" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "重新登录" })).toBeTruthy());
    expect(requests[1]).toMatchObject({ action: "password", newPassword: "NewPassword123!", proof: "verified-action-proof", captcha: { ticket: "password", randstr: "second" } });
    expect(human.mock.calls.map((call) => call[1])).toEqual(["invisible", "invisible"]);
  });
});
