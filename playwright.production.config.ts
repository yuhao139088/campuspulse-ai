import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "production.spec.ts",
  outputDir: "test-results-production",
  timeout: 120000,
  use: { baseURL: "https://cam.yuhaocloud.cn", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "production-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1092, height: 871 } } }, { name: "production-mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } }],
});
