// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoundedSelect } from "./rounded-select";

beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(cleanup);

function selector(onChange = vi.fn()) {
  return createElement(RoundedSelect, { "aria-label": "Channel", defaultValue: "email", onChange }, [
    createElement("option", { key: "email", value: "email" }, "Email"),
    createElement("option", { key: "phone", value: "sms" }, "Phone"),
    createElement("option", { key: "disabled", value: "disabled", disabled: true }, "Unavailable"),
  ]);
}

describe("rounded dropdown", () => {
  it("opens a portal, selects an option and updates the native change handler", async () => {
    const changed = vi.fn(); render(selector(changed));
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Channel" }));
    expect(screen.getByRole("listbox")).toBeTruthy();
    await user.click(screen.getByRole("option", { name: "Phone" }));
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0][0].target.value).toBe("sms");
    expect(screen.getByRole("combobox").textContent).toBe("Phone");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("supports keyboard selection, skips disabled options and restores focus", async () => {
    render(selector()); const user = userEvent.setup();
    screen.getByRole("combobox").focus();
    await user.keyboard("{ArrowDown}{End}{Enter}");
    expect(screen.getByRole("combobox").textContent).toBe("Phone");
    expect(document.activeElement).toBe(screen.getByRole("combobox"));
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("does not allow a disabled choice", async () => {
    const changed = vi.fn(); render(selector(changed)); const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Unavailable" }));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeTruthy();
  });
});
