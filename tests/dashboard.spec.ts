import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login?callbackUrl=%2Fdashboard");
  await page.locator('input[autocomplete="username"]').fill("demo@campuspulse.local");
  await page.locator('input[type="password"]').fill("CampusPulse2026!");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("dashboard exposes bilingual Agent and import entry points", async ({ page }) => {
  await login(page);
  await expect(page.getByText("AI DECISION AGENT")).toBeVisible();
  await expect(page.getByText("快速导入")).toBeVisible();
  await page.getByPlaceholder("例如：为什么十月到场率下降了？").fill("为什么十月到场率下降了？");
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.locator(".agent-result .result-answer")).toBeVisible();
  await expect(page.locator(".agent-result .result-tags span").first()).toBeVisible();
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.getByText("AI DECISION AGENT")).toBeVisible();
});

test("public home gates dashboard and keeps session after return", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("都有数据依据")).toBeVisible();
  await page.getByRole("link", { name: "登录进入工作台" }).click();
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard$/);
  await login(page);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "已登录 · 打开空间" })).toBeVisible();
});
