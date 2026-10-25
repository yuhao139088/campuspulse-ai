import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const baseURL = "https://cam.yuhaocloud.cn";
const out = process.env.SHOT_DIR;
const judge = JSON.parse(readFileSync(process.env.JUDGE_FILE, "utf8"));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL, viewport: { width: 1600, height: 1000 }, locale: "zh-CN" });
try {
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("campuspulse.locale", "zh"));
  const csrf = (await (await context.request.get("/api/auth/csrf")).json()).csrfToken;
  const login = await context.request.post("/api/auth/callback/credentials", { form: { csrfToken: csrf, email: judge.email, password: judge.password, callbackUrl: baseURL + "/dashboard", json: "true" } });
  if (!login.ok()) throw new Error("login failed " + login.status());
  const spaces = await (await context.request.get("/api/spaces")).json();
  const personal = spaces.spaces.find((space) => space.type === "PERSONAL") ?? spaces.spaces[0];
  await context.request.patch("/api/spaces", { data: { id: personal.id } });
  await page.goto("/analysis");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /为什么 11 月签到下降/ }).first().click();
  await page.locator(".analysis-result").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.locator(".analysis-result").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + "/06-analysis.png" });
  console.log("re-shot 06-analysis");
} finally { await browser.close(); }