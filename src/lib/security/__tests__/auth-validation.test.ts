import { describe, expect, it } from "vitest";
import { validateAuthFields } from "../../auth-validation";

const fields = { mode: "login", channel: "email", name: "", target: "", password: "", code: "", needsCode: false } as const;
describe("inline authentication validation", () => {
  it("identifies empty required fields before sending any authentication request", () => {
    expect(validateAuthFields(fields, "zh")).toEqual({ target: "请输入邮箱或已绑定手机号", password: "请输入密码" });
  });
  it("validates country-prefixed numbers and six-digit codes without browser popups", () => {
    expect(validateAuthFields({ ...fields, channel: "sms", target: "+8613800138000", code: "012345", needsCode: true }, "en")).toEqual({});
    expect(validateAuthFields({ ...fields, channel: "sms", target: "+86138", code: "12", needsCode: true }, "en")).toHaveProperty("target");
  });
  it("validates registration name, email and password length", () => {
    const errors = validateAuthFields({ ...fields, mode: "register", name: "A", target: "invalid", password: "short" }, "en");
    expect(Object.keys(errors)).toEqual(["name", "target", "password"]);
    expect(validateAuthFields({ ...fields, target: "person@example.com", password: "valid-password" }, "en")).toEqual({});
  });
});
