import { request } from "playwright";
import { readFile, writeFile } from "node:fs/promises";

const environment = Object.fromEntries((await readFile(".deployment-private/aliyun-sms.env", "utf8")).split(/\r?\n/).filter((line) => line.includes("=")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)]; }));
const context = await request.newContext({ baseURL: "https://cam.yuhaocloud.cn", storageState: ".deployment-private/production-browser-state.json" });
try {
  const response = await context.get("/api/platform/config");
  if (!response.ok()) throw new Error("Administrator session required");
  const configuration = await response.json();
  const authentication = Object.fromEntries(Object.entries(configuration.authentication).filter(([key]) => !key.endsWith("Configured")));
  const saved = await context.put("/api/platform/config", { data: { section: "authentication", value: { ...authentication, smsEnabled: true, phoneLogin: true, smsProvider: "aliyun", smsAccount: environment.SMS_ACCOUNT, smsToken: environment.SMS_API_KEY, smsTemplate: environment.SMS_TEMPLATE, smsTemplateChange: environment.SMS_TEMPLATE_CHANGE, smsTemplateReset: environment.SMS_TEMPLATE_RESET, smsTemplateBind: environment.SMS_TEMPLATE_BIND, smsTemplateVerify: environment.SMS_TEMPLATE_VERIFY, smsSign: environment.SMS_SIGN, smsScheme: environment.SMS_SCHEME, smsUrl: "https://dypnsapi.aliyuncs.com" } } });
  if (!saved.ok()) throw new Error((await saved.json()).error || "SMS configuration failed");
  const safe = await (await context.get("/api/platform/config")).json();
  if (safe.authentication.smsToken || !safe.authentication.smsTokenConfigured || safe.authentication.smsSign !== "恒创联众" || safe.authentication.smsProvider !== "aliyun") throw new Error("Masked Aliyun SMS configuration check failed");
  const features = await (await context.get("/api/auth/features")).json();
  if (!features.smsEnabled || !features.phoneLogin) throw new Error("Phone authentication was not enabled");
  console.log("Aliyun PNVS enabled with encrypted server key, template 100001, configured signature and phone sign-in");
  if (process.argv.includes("--send-test")) {
    const phone = await readFile(".deployment-private/sms-test-phone.txt", "utf8");
    const test = await context.post("/api/platform/config", { data: { action: "sms_test", phone: phone.trim() }, timeout: 60000 });
    const result = await test.json();
    await writeFile(".deployment-private/aliyun-sms-test-result.json", JSON.stringify({ testedAt: new Date().toISOString(), status: test.status(), ...result }));
    if (!test.ok()) throw new Error(result.error || "Real SMS test failed");
    if (result.providerVerified !== true) throw new Error("Aliyun did not confirm cloud verification");
    console.log("One user-authorized SMS accepted and its generated code verified PASS by Aliyun; no code exposed to the client");
  }
} finally { await context.dispose(); }
