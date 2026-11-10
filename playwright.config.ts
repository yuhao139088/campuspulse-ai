import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "production.spec.ts",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:3390", trace: "on-first-retry" },
  webServer: { env: { CARBON_AI_API_KEY: "", CARBON_AI_BASE_URL: "https://api.deepseek.com", CARBON_AI_MODEL: "deepseek-flash", NEXTAUTH_URL: "http://127.0.0.1:3390", NEXTAUTH_SECRET: "playwright-test-secret", DEMO_AUTH_ENABLED: "true", DEMO_EMAIL: "demo@campuspulse.local", DEMO_PASSWORD: "playwright-only-secret", HOSTNAME: "127.0.0.1", PORT: "3390" }, command: "npm run build && node -e \"const fs=require('node:fs');for(const item of ['public','.next/static']){if(fs.existsSync(item))fs.cpSync(item,'.next/standalone/'+item,{recursive:true})}\" && node .next/standalone/server.js", url: "http://127.0.0.1:3390/api/health", reuseExistingServer: false, timeout: 120_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});








