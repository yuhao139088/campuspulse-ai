import { describe, expect, it, vi, afterEach } from "vitest";

const secret = "test-secret-for-github-oauth";
process.env.NEXTAUTH_SECRET = secret;

const { signStateToken, verifyStateToken } = await import("../crypto");
const { githubOAuth } = await import("../config");
type Config = import("../config").SecurityConfig;
const { validateSecurityAction } = await import("../identity");
const { normalizeSecurityIntent, securityIntentContext } = await import("../intent");

const baseConfig = { githubEnabled: true, githubClientId: "client-id", githubClientSecret: "client-secret", totpAllowed: true, smsEnabled: false, smsProvider: "gateway" } as Config;

afterEach(() => { vi.useRealTimers(); });

describe("GitHub OAuth configuration and link state", () => {
  it("only reports OAuth ready when enabled with both credentials", () => {
    expect(githubOAuth(baseConfig)).toEqual({ clientId: "client-id", clientSecret: "client-secret" });
    expect(githubOAuth({ ...baseConfig, githubEnabled: false })).toBeNull();
    expect(githubOAuth({ ...baseConfig, githubClientSecret: "" })).toBeNull();
    expect(githubOAuth({ ...baseConfig, githubClientId: "" })).toBeNull();
  });
  it("signs link state tokens that expire and reject tampering", () => {
    const token = signStateToken({ purpose: "github-bind", userId: "user-1" });
    expect(verifyStateToken<{ purpose: string; userId: string }>(token, 600)).toMatchObject({ purpose: "github-bind", userId: "user-1" });
    expect(verifyStateToken(token, 600)).not.toBeNull();
    expect(verifyStateToken(token.split(".")[0] + ".aaaa", 600)).toBeNull();
    expect(verifyStateToken(token.slice(0, -2), 600)).toBeNull();
    expect(verifyStateToken("", 600)).toBeNull();
    vi.useFakeTimers().setSystemTime(Date.now() + 601000);
    expect(verifyStateToken(token, 600)).toBeNull();
  });
  it("requires configured OAuth for the bind_github intent and keeps the context stable", () => {
    const intent = normalizeSecurityIntent({ action: "bind_github", target: "ignored", code: "123456" });
    expect(intent).toEqual({ action: "bind_github", target: "", newPassword: "", code: "" });
    expect(securityIntentContext(intent)).toBe(JSON.stringify(["bind_github", "", ""]));
    expect(() => validateSecurityAction({ phone: null, totpEnabled: false }, baseConfig, intent)).not.toThrow();
    expect(() => validateSecurityAction({ phone: null, totpEnabled: false }, { ...baseConfig, githubEnabled: false }, intent)).toThrowError(/not configured/);
  });
});