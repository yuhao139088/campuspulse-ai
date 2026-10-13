import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = "https://cam.yuhaocloud.cn";
const output = ".deployment-private/auth-ui-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ baseURL, viewport: { width: 1092, height: 871 } });
  const page = await context.newPage();
  let sentRequests = 0;
  page.on("request", (request) => { if (request.method() === "POST" && /\/api\/auth\/(code|check|register|reset-password)$/.test(new URL(request.url()).pathname)) sentRequests++; });
  await page.addInitScript(() => {
    window.providerWarningSeen = false;
    new MutationObserver(() => { if (document.querySelector(".auth-provider-disabled")) window.providerWarningSeen = true; }).observe(document, { childList: true, subtree: true });
  });
  await page.route("**/api/auth/features", async (route) => {
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ response });
  });
  for (const route of ["login", "register", "reset-password"]) {
    await page.goto("/" + route);
    const action = route === "login" ? "登录" : route === "register" ? "创建账号" : "更新密码";
    await expect(page.getByRole("button", { name: action, exact: true })).toBeEnabled();
    expect(await page.evaluate(() => window.providerWarningSeen)).toBe(false);
    await page.getByRole("button", { name: action, exact: true }).click();
    expect(await page.locator(".field-error").count()).toBeGreaterThan(0);
    expect(await page.locator("form").evaluate((form) => form.noValidate)).toBe(true);
    await page.getByRole("button", { name: "手机验证码", exact: true }).click();
    const country = page.getByRole("combobox", { name: "国家或地区", exact: true });
    await expect(country).toBeVisible();
    expect(await country.textContent()).not.toContain("+86");
    const phone = page.getByRole("textbox", { name: "手机号", exact: true });
    await phone.fill("11111111111");
    await page.getByRole("button", { name: "发送验证码", exact: true }).click();
    await expect(page.getByText("请填写所选地区的有效手机号", { exact: true })).toBeVisible();
    await country.click();
    await expect(page.getByRole("listbox", { name: "国家或地区", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: /中国大陆.*\+86/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /美国.*\+1/ })).toBeDisabled();
    await page.screenshot({ path: output + "/" + route + "-country-inline-errors.png", fullPage: true });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    await page.screenshot({ path: output + "/" + route + "-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1092, height: 871 });
  }
  expect(sentRequests).toBe(0);
  const invalid = await context.request.post("/api/auth/code", { data: { channel: "sms", target: "+8611111111111", purpose: "register" } });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error).toContain("有效手机号");
  console.log("Login/register/reset: no provider-warning flash, themed inline validation, country picker and malformed-phone rejection passed; zero verification-send requests");
  await context.close();
} finally { await browser.close(); }
