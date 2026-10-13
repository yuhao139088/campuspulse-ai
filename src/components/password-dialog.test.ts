// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const human = vi.hoisted(() => vi.fn());
vi.mock("@/lib/locale", () => ({ useAppLocale: () => ["zh", vi.fn()] }));
vi.mock("@/lib/captcha-client", () => ({ verifyHumanInDialog: human, isCaptchaRiskFailure: (problem: unknown) => String(problem).includes("Verification expired") }));
import { PasswordDialog } from "./password-dialog";
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("password confirmation after identity verification", () => {
  it("validates the two new password fields before launching human verification", async () => {
    const save = vi.fn();
    render(createElement(PasswordDialog, { onSave: save, onCancel: vi.fn() }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("新密码", { exact: true }), "NewPassword123!");
    await user.type(screen.getByLabelText("确认新密码", { exact: true }), "Mismatch123!");
    await user.click(screen.getByRole("button", { name: "确认更新密码" }));
    expect(screen.getByRole("alert").textContent).toContain("不一致");
    expect(human).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
  it("uses a fresh invisible ticket and retains the dialog on server rejection", async () => {
    human.mockResolvedValue({ ticket: "fresh", randstr: "random" });
    const save = vi.fn().mockRejectedValue(new Error("Verification expired"));
    render(createElement(PasswordDialog, { onSave: save, onCancel: vi.fn() }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("新密码", { exact: true }), "NewPassword123!");
    await user.type(screen.getByLabelText("确认新密码", { exact: true }), "NewPassword123!");
    await user.click(screen.getByRole("button", { name: "确认更新密码" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("NewPassword123!", { ticket: "fresh", randstr: "random" }, "invisible"));
    expect(human.mock.calls[0][1]).toBe("invisible");
    expect(screen.getByRole("dialog", { name: "设置新密码" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("expired");
  });
});
