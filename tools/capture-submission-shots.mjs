import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

const baseURL = "https://cam.yuhaocloud.cn";
const out = process.env.SHOT_DIR;
mkdirSync(out, { recursive: true });
const judge = JSON.parse(readFileSync(process.env.JUDGE_FILE, "utf8"));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL, viewport: { width: 1600, height: 1000 }, locale: "zh-CN" });
const shot = async (page, name) => { await page.screenshot({ path: out + "/" + name + ".png", fullPage: false }); console.log("shot " + name); };
try {
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("campuspulse.locale", "zh"));
  await page.goto("/");
  await page.waitForTimeout(1200);
  await shot(page, "01-landing");
  await page.goto("/login");
  await page.waitForTimeout(1500);
  await shot(page, "02-login");

  const csrf = (await (await context.request.get("/api/auth/csrf")).json()).csrfToken;
  const login = await context.request.post("/api/auth/callback/credentials", { form: { csrfToken: csrf, email: judge.email, password: judge.password, callbackUrl: baseURL + "/dashboard", json: "true" } });
  if (!login.ok()) throw new Error("judge login failed " + login.status());
  const spaces = await (await context.request.get("/api/spaces")).json();
  const personal = spaces.spaces.find((space) => space.type === "PERSONAL") ?? spaces.spaces[0];
  await context.request.patch("/api/spaces", { data: { id: personal.id } });

  await page.goto("/dashboard");
  await page.waitForTimeout(1800);
  await shot(page, "03-dashboard");
  await page.goto("/datasets");
  await page.waitForTimeout(1800);
  await shot(page, "04-datasets");
  const datasets = (await (await context.request.get("/api/datasets")).json()).datasets;
  const target = datasets.find((item) => item.name.includes("01-campus-operations")) ?? datasets[0];
  await page.goto("/datasets/" + target.id);
  await page.waitForTimeout(1800);
  await shot(page, "05-dataset-detail");

  await page.goto("/analysis?dataset=" + target.id);
  await page.waitForTimeout(1500);
  await page.locator("textarea").fill("为什么 11 月签到下降？请给出证据和行动建议。");
  await page.getByRole("button", { name: "开始分析" }).click();
  await page.locator(".analysis-result").first().waitFor({ timeout: 240000 });
  await page.waitForTimeout(1500);
  await shot(page, "06-analysis");

  await page.goto("/canvas?dataset=" + target.id);
  await page.waitForTimeout(2500);
  await shot(page, "07-canvas");
  await page.goto("/reports");
  await page.waitForTimeout(1800);
  const reportButton = page.getByRole("button", { name: /月报/ }).first();
  if (await reportButton.count()) { await reportButton.click(); await page.waitForTimeout(2000); }
  await shot(page, "08-reports");
  await page.goto("/admin");
  await page.waitForTimeout(2000);
  await shot(page, "09-admin");
  await page.goto("/settings");
  await page.waitForTimeout(2000);
  await shot(page, "10-settings-security");
  console.log("capture complete");
} finally {
  await browser.close();
}