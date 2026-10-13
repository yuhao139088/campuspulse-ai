import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));
  page.on("requestfailed", (request) => console.log("REQUEST FAILED:", new URL(request.url()).pathname, request.failure()?.errorText));
  page.on("response", (response) => { if (response.status() >= 400) console.log("HTTP", response.status(), new URL(response.url()).pathname); });
  await page.goto("https://cam.yuhaocloud.cn/login", { waitUntil: "networkidle" });
  console.log("URL:", page.url());
  console.log("BODY:", (await page.locator("body").innerText()).slice(0, 2000));
  console.log("INPUTS:", await page.locator("input").evaluateAll((inputs) => inputs.map((input) => ({ type: input.type, autocomplete: input.autocomplete }))));
  await page.screenshot({ path: ".deployment-private/login-inspection.png", fullPage: true });
} finally { await browser.close(); }
