import { chromium, expect, devices } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { totpCode } from "../src/lib/security/totp.ts";

const fixture = JSON.parse(await readFile(".deployment-private/action-fixture.json", "utf8"));
const output = ".deployment-private/action-dialog-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: process.env.REVIEW_HEADED !== "true" });
const context = await browser.newContext({ ...(process.env.REVIEW_MOBILE === "true" ? devices["iPhone 13"] : {}), baseURL: "https://cam.yuhaocloud.cn" });
const page = await context.newPage();
let recovery;
const checkpoints = [];
const check = (message) => { checkpoints.push(message); console.log("PASS " + message); };
let sends = 0;
page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/api/security/verify") && request.postDataJSON().stage === "send") sends++; });
async function login(password, email, factor) {
  await page.goto("/login");
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  if (factor) {
    await expect(page.getByRole("dialog", { name: "二次身份验证" })).toBeVisible({ timeout: 45000 });
    expect((await (await page.request.get("/api/auth/session")).json()).user?.id).toBeFalsy();
    await page.getByRole("button", { name: "使用恢复码", exact: true }).click();
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.getByLabel("恢复码", { exact: true }).fill(factor);
      const checked = page.waitForResponse((response) => response.url().endsWith("/api/auth/check") && response.request().postDataJSON()?.factorStage);
      await page.getByRole("button", { name: "验证并继续", exact: true }).click();
      const response = await checked;
      if (response.ok()) break;
      const result = await response.json();
      if (!/Human verification did not pass/.test(result.error) || attempt === 2) throw new Error(result.error);
      console.log("Tencent rejected a factor challenge; retrying through the real SDK");
      await page.waitForTimeout(2500);
    }
  }
  await page.waitForURL(/\/dashboard$/, { timeout: 45000 });
}
async function chooseMethod(label) {
  await page.getByRole("combobox", { name: "验证方式", exact: true }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}
async function authorize(code, method, passwordEntry = false) {
  await expect(page.getByRole("dialog", { name: "验证当前身份" })).toBeVisible();
  if (method) await chooseMethod(method);
  const response = page.waitForResponse((item) => item.url().endsWith(passwordEntry ? "/api/security/verify" : "/api/security") && item.request().method() === "POST", { timeout: 45000 });
  await page.getByRole("dialog").getByRole("textbox", { name: method === "2FA恢复码" ? "恢复码" : "验证码", exact: true }).fill(code);
  await page.getByRole("button", { name: "验证并继续", exact: true }).click();
  const result = await response;
  if (!result.ok()) throw new Error((await result.json()).error);
  return result.json();
}

try {
  await login(fixture.password, fixture.email);
  await page.goto("/settings");
  await expect(page.locator('.account-security input[autocomplete="current-password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "绑定 Authenticator", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "验证当前身份" })).toBeVisible();
  await page.getByRole("combobox", { name: "验证方式", exact: true }).click();
  await expect(page.getByRole("option", { name: "邮箱验证码", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "手机验证码", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Authenticator认证码", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  check("No current-password field and only linked methods offered");
  const setup = await authorize(fixture.setupCode);
  expect(setup.enrollmentProof).toBeTruthy();
  check("Real invisible CAPTCHA, seeded fixture email ownership and action authorization create QR setup");
  await page.getByRole("button", { name: "确认开启2FA", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "确认绑定Authenticator" })).toBeVisible();
  const enabledResponse = page.waitForResponse((item) => item.url().endsWith("/api/security") && item.request().method() === "POST", { timeout: 45000 });
  await page.getByLabel("6位认证码", { exact: true }).fill(totpCode(setup.secret));
  await page.getByRole("button", { name: "验证并继续", exact: true }).click();
  const enabled = await (await enabledResponse).json();
  expect(enabled.recoveryCodes).toHaveLength(10); recovery = enabled.recoveryCodes;
  await page.getByLabel("我已将恢复码保存到安全位置", { exact: true }).check();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  check("Authenticator enrollment requires fresh invisible verification, bound enrollment proof and a valid new code");
  await login(fixture.password, fixture.email, recovery[0]);
  await page.goto("/settings");
  await expect(page.locator('.account-security input[type="password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "更新密码", exact: true }).click();
  await authorize(recovery[1], "2FA恢复码", true);
  await expect(page.getByRole("dialog", { name: "设置新密码" })).toBeVisible();
  await page.getByLabel("新密码", { exact: true }).fill(fixture.newPassword);
  await page.getByLabel("确认新密码", { exact: true }).fill(fixture.newPassword);
  const passwordResponse = page.waitForResponse((response) => response.url().endsWith("/api/security") && response.request().method() === "POST");
  await page.getByRole("button", { name: "确认更新密码", exact: true }).click();
  const passwordResult = await passwordResponse;
  if (!passwordResult.ok()) throw new Error((await passwordResult.json()).error);
  expect((await page.request.get("/api/security")).status()).toBe(401);
  check("Password entry follows linked identity verification, requires another real invisible check and revokes old sessions");
  await login(fixture.newPassword, fixture.email, recovery[2]);
  await page.goto("/settings");
  await page.getByRole("button", { name: "重新生成恢复码", exact: true }).click();
  const regenerated = await authorize(recovery[3], "2FA恢复码");
  expect(regenerated.recoveryCodes).toHaveLength(10); recovery = regenerated.recoveryCodes;
  await page.getByLabel("我已将恢复码保存到安全位置", { exact: true }).check();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  check("Recovery regeneration uses linked identity verification and replaces the previous list");
  await login(fixture.newPassword, fixture.email, recovery[0]);
  execFileSync("ssh", ["-i", "C:/Users/yuhao/Downloads/101.35.250.178_id_ed25519", "-o", "BatchMode=yes", "root@101.35.250.178", "cd /opt/campuspulse/app && set -a && . /etc/campuspulse/app.env && set +a && node tools/security-action-fixture.mjs contact"], { stdio: "pipe" });
  await page.goto("/settings");
  await page.getByLabel("新邮箱地址", { exact: true }).fill(fixture.newEmail);
  await page.getByRole("textbox", { name: "绑定验证码", exact: true }).fill(fixture.contactCode);
  await page.getByRole("button", { name: "确认绑定", exact: true }).click();
  await authorize(recovery[1], "2FA恢复码");
  check("Contact change requires both the new-contact code and existing linked identity proof");
  await login(fixture.newPassword, fixture.newEmail, recovery[2]);
  await page.goto("/settings");
  await page.getByRole("button", { name: "关闭2FA", exact: true }).click();
  await authorize(recovery[3], "2FA恢复码");
  check("Disabling 2FA uses the same styled selection dialog and revokes sessions");
  await login(fixture.newPassword, fixture.newEmail);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  check("Only the isolated fixture returns to single-factor sign-in");
  expect(sends).toBe(0);
  await writeFile(output + "/results.json", JSON.stringify({ checkpoints, captcha: "real invisible SDK and Tencent server verification", contactCodes: "isolated seeded test-only email challenges", actualDeliveries: 0 }));
  console.log("Completed " + checkpoints.length + " real security workflow checkpoints without sending user messages or altering the administrator");
} catch (error) {
  await page.screenshot({ path: output + "/failure.png", fullPage: true });
  console.error(error.message); process.exitCode = 1;
} finally {
  await context.close(); await browser.close();
  execFileSync("ssh", ["-i", "C:/Users/yuhao/Downloads/101.35.250.178_id_ed25519", "-o", "BatchMode=yes", "root@101.35.250.178", "cd /opt/campuspulse/app && set -a && . /etc/campuspulse/app.env && set +a && node tools/security-action-fixture.mjs disable"], { stdio: "pipe" });
}
