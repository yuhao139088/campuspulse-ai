import { chromium, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";

const baseURL = "https://cam.yuhaocloud.cn";
const fixture = JSON.parse(readFileSync(process.env.FIXTURE_FILE, "utf8"));
const output = ".deployment-private/canvas-scoping";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, locale: "zh-CN" });
const created = [];
const failures = [];
try {
  const csrf = (await (await context.request.get("/api/auth/csrf")).json()).csrfToken;
  const login = await context.request.post("/api/auth/callback/credentials", { form: { csrfToken: csrf, email: fixture.email, password: fixture.password, callbackUrl: baseURL, json: "true" } });
  if (!login.ok()) throw new Error("fixture login failed: " + login.status());
  const spaces = await (await context.request.get("/api/spaces")).json();
  const personal = spaces.spaces.find((space) => space.type === "PERSONAL") ?? spaces.spaces[0];
  await context.request.patch("/api/spaces", { data: { id: personal.id } });

  const upload = async (name, csv) => {
    const response = await context.request.post("/api/import", { multipart: { file: { name, mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") }, locale: "zh" } });
    if (response.status() !== 201) throw new Error("import " + name + " failed " + response.status() + " " + (await response.text()).slice(0, 200));
    const dataset = (await response.json()).dataset;
    created.push(dataset.id);
    return dataset;
  };
  const datasetA = await upload("scoping-a.csv", "month,checkedIn\n2026-09,40\n2026-10,55\n2026-11,30\n");
  const datasetB = await upload("scoping-b.csv", "班级,人数\n人工智能25-02班,4\n数据技术25-03班,7\n软件技术25-01班,2\n");
  console.log("datasetA", datasetA.id, "rows=" + datasetA.rowCount, "cols=" + datasetA.columnCount);
  console.log("datasetB", datasetB.id, "rows=" + datasetB.rowCount, "cols=" + datasetB.columnCount);

  const charts = [
    { id: "chart-a", title: "甲数据集签到趋势", type: "line", category: "month", metric: "checkedIn", aggregation: "sum", datasetId: datasetA.id },
    { id: "chart-b", title: "乙数据集班级人数", type: "bar", category: "班级", metric: "人数", aggregation: "sum", datasetId: datasetB.id },
  ];
  const saved = await context.request.put("/api/canvas", { data: { datasetId: datasetA.id, chartType: "chart-a", components: charts.map((item) => item.id), charts } });
  if (!saved.ok()) throw new Error("canvas save failed " + saved.status() + " " + (await saved.text()).slice(0, 200));

  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("campuspulse.locale", "zh"));
  page.on("pageerror", (error) => failures.push("pageerror: " + error.message));
  page.on("console", (message) => { if (message.type() === "error") failures.push("console: " + message.text()); });
  const sidebar = page.locator(".canvas-sidebar");
  await page.goto("/canvas");
  await expect(page.getByRole("heading", { name: "真实数据图表画布" })).toBeVisible({ timeout: 30000 });
  await expect(sidebar.getByRole("button", { name: "甲数据集签到趋势", exact: true })).toBeVisible({ timeout: 30000 });
  await expect(sidebar.getByRole("button", { name: "乙数据集班级人数", exact: true })).toHaveCount(0);
  await expect(page.locator(".board-header h3")).toHaveText("甲数据集签到趋势");
  await expect(page.locator(".board-footer")).toContainText("3 源数据行");
  await expect(page.locator(".board-chart canvas")).toBeVisible();
  await expect(page.locator(".canvas-layout")).not.toContainText("[object Object]");
  await page.screenshot({ path: output + "/dataset-a.png", fullPage: true });
  console.log("PASS dataset A shows only its own chart");

  await page.getByRole("combobox", { name: "选择数据集" }).click();
  await page.getByRole("option", { name: "scoping-b.csv", exact: true }).click();
  await expect(sidebar.getByRole("button", { name: "乙数据集班级人数", exact: true })).toBeVisible({ timeout: 30000 });
  await expect(sidebar.getByRole("button", { name: "甲数据集签到趋势", exact: true })).toHaveCount(0);
  await expect(page.locator(".board-header h3")).toHaveText("乙数据集班级人数");
  await expect(page.locator(".board-chart canvas")).toBeVisible();
  await page.screenshot({ path: output + "/dataset-b.png", fullPage: true });
  console.log("PASS dataset B shows only its own chart");

  await expect.poll(async () => {
    const stored = (await (await context.request.get("/api/canvas")).json()).config;
    return JSON.stringify([stored?.datasetId, stored?.chartType, (stored?.charts ?? []).map((item) => item.datasetId).join("+")]);
  }, { timeout: 30000 }).toBe(JSON.stringify([datasetB.id, "chart-b", datasetA.id + "+" + datasetB.id]));
  console.log("PASS stored canvas keeps both charts with their own datasetId");

  await page.reload();
  await expect(sidebar.getByRole("button", { name: "乙数据集班级人数", exact: true })).toBeVisible({ timeout: 30000 });
  await expect(sidebar.getByRole("button", { name: "甲数据集签到趋势", exact: true })).toHaveCount(0);
  console.log("PASS scoping survives reload");
  console.log(failures.length ? "browser errors: " + failures.slice(0, 4).join(" | ") : "no browser errors");
} finally {
  for (const id of created) { const result = await context.request.delete("/api/datasets/" + id); console.log("cleanup dataset " + id + " -> " + result.status()); }
  await browser.close();
}