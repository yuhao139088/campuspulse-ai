import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
const lines = (await readFile(".deployment-private/initial-account.txt", "utf8")).split(/\r?\n/);
const email = lines[0].split(": ")[1];
const password = lines[1].split(": ")[1];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://cam.yuhaocloud.cn/login");
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  try { await page.waitForURL(/\/dashboard$/, { timeout: 45000 }); await context.storageState({ path: ".deployment-private/production-browser-state.json" }); console.log("Real browser sign-in, Tencent invisible server verification and administrator session succeeded"); }
  catch { console.log("Browser sign-in requires inspection; URL path=" + new URL(page.url()).pathname); console.log("VISIBLE ERROR:", await page.locator(".auth-error").allTextContents()); await page.screenshot({ path: ".deployment-private/public-login-check.png", fullPage: true }); process.exitCode = 1; }
} finally { await browser.close(); }
