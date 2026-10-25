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
  await page.goto("/admin");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "平台管理" }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "登录与注册" }).first().click().catch(() => undefined);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out + "/09-admin.png" });
  console.log("re-shot 09-admin on platform config");
} finally { await browser.close(); }