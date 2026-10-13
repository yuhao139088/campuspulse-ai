import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const baseURL = "https://cam.yuhaocloud.cn";
const output = ".deployment-private/layout-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL, storageState: ".deployment-private/production-browser-state.json", viewport: { width: 1440, height: 1000 } });
let original;
let page;
try {
  const session = await (await context.request.get("/api/auth/session")).json();
  if (!session.user) throw new Error("Administrator browser session needs renewal");
  const spaces = await (await context.request.get("/api/spaces")).json();
  const team = spaces.spaces.find((space) => space.slug === "campuspulse-team");
  if (!team) throw new Error("Team acceptance workspace not found");
  await context.request.patch("/api/spaces", { data: { id: team.id } });
  original = (await (await context.request.get("/api/canvas")).json()).config;
  await writeFile(output + "/canvas-original.json", JSON.stringify(original));
  const datasets = (await (await context.request.get("/api/datasets")).json()).datasets;
  const dataset = datasets.find((item) => item.name === "上线验收数据.csv");
  if (!dataset) throw new Error("Acceptance dataset not found");
  const reset = await context.request.put("/api/canvas", { data: { datasetId: dataset.id, charts: [], components: [], chartType: "" } });
  expect(reset.ok()).toBe(true);
  page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("campuspulse.locale", "en"));
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("/canvas");
  await expect(page.getByRole("heading", { name: "Your data chart canvas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI chart advice", exact: true })).toBeEnabled();
  const response = page.waitForResponse((item) => item.url().endsWith("/api/ai/analyze") && item.request().method() === "POST", { timeout: 420000 });
  await page.getByRole("button", { name: "AI chart advice", exact: true }).click();
  const resultResponse = await response;
  const result = await resultResponse.json();
  if (!resultResponse.ok()) throw new Error(result.error ?? "AI recommendation request failed");
  expect(result.datasetId).toBe(dataset.id);
  expect(result.chartRecommendations.length).toBeGreaterThan(0);
  await writeFile(output + "/recommendations.json", JSON.stringify(result));
  const cards = page.locator(".chart-recommendation-card");
  await expect(cards).toHaveCount(result.chartRecommendations.length);
  expect(await page.locator(".chart-advice-markdown h2, .chart-advice-markdown h3, .chart-advice-markdown li").count()).toBeGreaterThan(0);
  await cards.first().getByRole("button").click();
  await expect(cards.first().getByRole("button")).toBeDisabled();
  await expect.poll(async () => ((await (await context.request.get("/api/canvas")).json()).config?.charts?.length ?? 0)).toBe(1);
  const countBefore = await page.locator(".canvas-item-row").count();
  await cards.first().getByRole("button").evaluate((button) => button.click());
  expect(await page.locator(".canvas-item-row").count()).toBe(countBefore);
  if (result.chartRecommendations.length > 1) await page.getByRole("button", { name: "Add all to canvas", exact: true }).click();
  await expect.poll(async () => ((await (await context.request.get("/api/canvas")).json()).config?.charts?.length ?? 0)).toBe(result.chartRecommendations.length);
  await page.screenshot({ path: output + "/canvas-recommendations.png", fullPage: true });
  await page.reload();
  await expect(page.locator(".canvas-item-row")).toHaveCount(result.chartRecommendations.length);
  await expect(page.locator(".board-chart canvas")).toBeVisible();
  console.log("Real AI configurations, single/bulk import, duplicate prevention and cloud reload passed");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Account & sign-in security", exact: true })).toBeVisible();
  await expect(page.locator(".notice-card").filter({ hasText: /^Loading/ })).toHaveCount(0);
  await expect(page.locator(".security-identity").first()).toContainText(session.user.email);
  const channel = page.getByRole("combobox", { name: "Contact type", exact: true });
  await channel.click();
  const menu = page.getByRole("listbox", { name: "Contact type", exact: true });
  await expect(menu).toBeVisible();
  expect(await menu.evaluate((element) => parseFloat(getComputedStyle(element).borderRadius))).toBeGreaterThan(0);
  await page.screenshot({ path: output + "/security-rounded-menu.png", fullPage: true });
  await page.getByRole("option", { name: "Phone", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Phone number", exact: true })).toBeVisible();
  console.log("Custom rounded phone menu and reorganized security sections passed");
  for (const width of [1920, 1092, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["dashboard", "datasets", "analysis", "canvas", "reports", "settings", "admin"]) {
      await page.goto("/" + route);
      await expect(page.locator(".production-workspace")).toBeVisible();
      await expect(page.locator(".workspace-controls button[role=combobox]")).toBeVisible();
      await expect(page.locator(".workspace-controls button[role=combobox]")).toContainText(team.name);
      await expect(page.locator(".notice-card").filter({ hasText: /^Loading/ })).toHaveCount(0);
      await expect(page.locator(".auth-error")).toHaveCount(0);
      const overflow = await page.evaluate(() => {
        const viewport = window.innerWidth;
        return Array.from(document.querySelectorAll(".production-workspace h1, .production-workspace h2, .production-workspace h3, .panel, .auth-input:not(.rounded-select-native), .top-actions"))
          .filter((element) => { const bounds = element.getBoundingClientRect(); return bounds.width > 0 && (bounds.right > viewport + 2 || bounds.left < -2); })
          .map((element) => ({ tag: element.tagName, className: element.className }));
      });
      expect(overflow, route + " overflow at width " + width).toEqual([]);
      if (route === "settings" || width === 1092 || width === 1920 && route === "canvas") await page.screenshot({ path: output + `/${route}-${width}.png`, fullPage: true });
    }
  }
  expect(failures).toEqual([]);
  console.log("All seven production pages passed overflow checks at 1920, 1092, 768 and 390px");
} finally {
  if (page) await page.close();
  if (original) {
    const restore = await context.request.put("/api/canvas", { data: original });
    if (!restore.ok()) throw new Error("Could not restore the team acceptance canvas");
    console.log("Original team canvas restored; personal user canvas was never modified");
  }
  await context.close();
  await browser.close();
}
