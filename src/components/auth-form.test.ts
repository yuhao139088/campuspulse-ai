// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ human: vi.fn(), signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ signIn: mocks.signIn }));
vi.mock("@/lib/locale", () => ({ useAppLocale: () => ["zh", vi.fn()] }));
vi.mock("@/lib/captcha-client", () => ({ verifyHuman: mocks.human }));
import AuthForm from "./auth-form";

const features = { passwordLogin: true, phoneLogin: true, smsEnabled: true, smsCountries: ["CN"], emailVerification: true, registrationEnabled: true };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("authentication loading and styled validation", () => {
  it("does not flash an unconfigured provider while configuration is still loading", async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    render(createElement(AuthForm, { mode: "login" }));
    expect(screen.queryByText("手机服务由系统管理员配置后启用。")).toBeNull();
    expect(screen.getByText("正在加载登录方式…")).toBeTruthy();
    finish(new Response(JSON.stringify(features)));
    await waitFor(() => expect(screen.queryByText("正在加载登录方式…")).toBeNull());
    expect(screen.queryByText("手机服务由系统管理员配置后启用。")).toBeNull();
  });
  it("uses inline errors for required fields and never starts CAPTCHA on invalid input", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(features))));
    const { container } = render(createElement(AuthForm, { mode: "login" }));
    const user = userEvent.setup();
    await waitFor(() => expect(screen.queryByText("正在加载登录方式…")).toBeNull());
    await user.click(screen.getByRole("button", { name: /^登录$/ }));
    expect(container.querySelector("form")?.noValidate).toBe(true);
    expect(screen.getByText("请输入邮箱或已绑定手机号")).toBeTruthy();
    expect(screen.getByText("请输入密码")).toBeTruthy();
    expect(mocks.human).not.toHaveBeenCalled();
  });
  it("shows a country choice without +86 in its default label and blocks malformed phones before sending", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(features))); vi.stubGlobal("fetch", fetcher);
    render(createElement(AuthForm, { mode: "login" })); const user = userEvent.setup();
    await waitFor(() => expect(screen.queryByText("正在加载登录方式…")).toBeNull());
    await user.click(screen.getByRole("button", { name: /^手机验证码$/ }));
    expect(screen.getByRole("combobox", { name: "国家或地区" }).textContent).not.toContain("+86");
    await user.type(screen.getByRole("textbox", { name: /^手机号$/ }), "11111");
    await user.click(screen.getByRole("button", { name: /^发送验证码$/ }));
    expect(screen.getByText("请填写所选地区的有效手机号")).toBeTruthy();
    expect(mocks.human).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
