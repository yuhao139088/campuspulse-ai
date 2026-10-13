import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, callbackUrl = "/dashboard") {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.locator('input[autocomplete="username"]').fill("demo@campuspulse.local");
  await page.locator('input[type="password"]').fill("CampusPulse2026!");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${callbackUrl.replaceAll("/", "\\/")}$`));
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

test("unauthenticated workspace access redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard$/);
});

test("public home preserves authenticated state and workspace navigation", async ({ page }) => {
  await login(page);
  for (const path of ["/datasets", "/analysis", "/canvas", "/reports", "/settings", "/admin"]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible();
  }
  await page.goto("/");
  await expect(page.getByRole("link", { name: "已登录 · 打开空间" })).toBeVisible();
  await page.goto("/canvas");
  await page.getByRole("button", { name: "添加图表" }).click();
  await page.getByRole("button", { name: /预算效率/ }).click();
  await page.getByRole("button", { name: /^(保存画布|已保存)$/ }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "删除预算效率" })).toBeVisible();
});

test("english locale carries through workspace pages without duplicate-key errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await login(page);
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.locator(".nav-list .lucide-wand-sparkles")).toBeVisible();
  await page.goto("/canvas");
  await expect(page.getByText("Let the data speak clearly")).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Save canvas|Saved)$/ })).toBeVisible();
  await page.getByRole("button", { name: "Add chart", exact: true }).click();
  await expect(page.getByRole("button", { name: /Budget efficiency/ })).toBeVisible();
  await expect(page.locator(".canvas-layout")).not.toContainText("组件");
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await page.goto("/reports");
  await expect(page.getByText("Generate report")).toBeVisible();
  await expect(page.getByText("Ready to generate this report?")).toBeVisible();
  await expect(page.locator(".report-list")).not.toContainText("刚刚");
  await page.getByRole("button", { name: "New report", exact: true }).click();
  await expect(page.getByLabel("Report name", { exact: true })).toBeVisible();
  await expect(page.locator(".admin-modal option").first()).toHaveText("Custom report");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/admin");
  await expect(page.getByText("Platform overview")).toBeVisible();
  for (const [button, heading] of [["Members & roles", "Members & roles"], ["Data assets", "Data asset management"], ["Audit trail", "Audit trail"], ["Security", "System & security settings"]]) {
    await page.locator(".admin-tabs").getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Invite member", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.route("**/api/ai/analyze", (route) => route.fulfill({ json: {
    answer: "Check conversion against the source records.",
    anomalies: [{ value: 20 }, { description: "Low conversion", value: 12 }, { reason: "Low conversion", value: 9 }],
    tools: ["inspect_dataset", "inspect_dataset"],
    actionPlan: ["Review attendance", "Review attendance"],
    evidence: ["Source dataset"],
    confidence: 0.9,
  } }));
  await page.goto("/analysis");
  await page.getByPlaceholder("e.g. Which event has the lowest budget return?").fill("Check the dataset for anomalies");
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.locator(".analysis-result-wide")).toBeVisible();
  await expect(page.locator(".result-anomalies > span")).toHaveCount(2);
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.locator(".analysis-result-wide")).toHaveCount(2);
  expect(consoleErrors.filter((message) => message.includes("same key") || message.includes("NaN"))).toEqual([]);
});
