import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "production.spec.ts",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:3390", trace: "on-first-retry" },
  webServer: { env: { CARBON_AI_API_KEY: "", CARBON_AI_BASE_URL: "https://api.deepseek.com", CARBON_AI_MODEL: "deepseek-flash", NEXTAUTH_URL: "http://127.0.0.1:3390", NEXTAUTH_SECRET: "playwright-test-secret", DEMO_AUTH_ENABLED: "true", DEMO_EMAIL: "demo@campuspulse.local", DEMO_PASSWORD: "CampusPulse2026!" }, command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3390", url: "http://127.0.0.1:3390/api/health", reuseExistingServer: false, timeout: 120_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});








