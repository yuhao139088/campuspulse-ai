import { chromium, expect } from "@playwright/test";

const baseURL = "https://cam.yuhaocloud.cn";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
const failures = [];
try {
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push("pageerror: " + error.message));
  page.on("console", (message) => { if (message.type() === "error") failures.push("console: " + message.text()); });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "使用 GitHub 登录", exact: true })).toBeVisible({ timeout: 30000 });
  const [request] = await Promise.all([
    page.waitForRequest((item) => item.url().includes("/api/auth/signin/github"), { timeout: 30000 }),
    page.getByRole("button", { name: "使用 GitHub 登录", exact: true }).click(),
  ]);
  console.log("PASS login page exposes GitHub sign-in and posts to " + new URL(request.url()).pathname);
  await page.waitForURL(/github\.com\/login/, { timeout: 45000 });
  const url = new URL(page.url());
  expect(url.searchParams.get("client_id")).toBeTruthy();
  console.log("PASS redirected to GitHub authorize with client_id " + url.searchParams.get("client_id") + " and return_to " + decodeURIComponent(url.searchParams.get("return_to") ?? "").slice(0, 120));
  await page.goto("/register");
  await expect(page.getByRole("button", { name: "使用 GitHub 注册", exact: true })).toBeVisible({ timeout: 30000 });
  console.log("PASS register page exposes GitHub sign-up");
  const unauthenticated = await context.request.get("/api/account/github");
  expect(unauthenticated.status()).toBe(401);
  console.log("PASS linking status endpoint requires a session (401)");
  console.log(failures.length ? "browser errors: " + failures.slice(0, 4).join(" | ") : "no browser errors");
} finally {
  await browser.close();
}