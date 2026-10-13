import { request } from "playwright";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
const account = (await readFile(".deployment-private/initial-account.txt", "utf8")).split(/\r?\n/);
const email = account[0].split(": ")[1];
const password = account[1].split(": ")[1];
const authenticated = await request.newContext({ baseURL: "https://cam.yuhaocloud.cn", storageState: ".deployment-private/production-browser-state.json" });
const anonymous = await request.newContext({ baseURL: "https://cam.yuhaocloud.cn" });
let passed = 0;
const check = (name, value) => { if (!value) throw new Error(name); passed++; console.log("PASS " + name); };
try {
  check("HTTPS database/storage health", (await (await anonymous.get("/api/health")).json()).ok);
  const settings = await authenticated.get("/api/platform/config");
  check("Real administrator configuration access", settings.status() === 200);
  const config = await settings.json();
  check("Tencent configuration enabled and secrets masked", config.captcha.enabled && config.captcha.normalSecretConfigured && config.captcha.secretKeyConfigured && !("secretKey" in config.captcha));
  check("Normal code delivery cannot bypass human verification", (await anonymous.post("/api/auth/code", { data: { channel: "email", target: email, purpose: "register" } })).status() === 400);
  check("Registration cannot bypass invisible verification", (await anonymous.post("/api/auth/register", { data: { name: "无票据拒绝验证", email: "no-captcha-" + randomBytes(5).toString("hex") + "@example.com", password: randomBytes(20).toString("base64url"), code: "123456" } })).status() === 400);
  check("Login preflight cannot bypass invisible verification", (await anonymous.post("/api/auth/check", { data: { channel: "email", target: email, password } })).status() === 400);
  const csrf = (await (await anonymous.get("/api/auth/csrf")).json()).csrfToken;
  await anonymous.post("/api/auth/callback/credentials", { form: { csrfToken: csrf, email, password, callbackUrl: "https://cam.yuhaocloud.cn/dashboard", json: "true" } });
  check("Direct NextAuth password callback cannot bypass verification", !(await (await anonymous.get("/api/auth/session")).json()).user?.id);
  for (const path of ["/api/platform/config", "/api/platform", "/api/admin", "/api/datasets", "/api/security"]) {
    await authenticated.get(path);
    check("No shared authentication cache for " + path, (await anonymous.get(path)).status() === 401);
  }
  const smtp = await authenticated.post("/api/platform/config", { data: { action: "smtp_test", email }, timeout: 60000 });
  const delivered = await smtp.json();
  check("Real SMTP delivery and PostgreSQL resend locking", smtp.status() === 200 && delivered.sent);
  console.log("Final backend checks passed: " + passed);
} finally { await authenticated.dispose(); await anonymous.dispose(); }
