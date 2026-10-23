import { NextResponse } from "next/server";
import { z } from "zod";
import { platformAccess, audit, ApiError, apiFailure } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getPersonalSpace } from "@/lib/workspace";
import { githubOAuth, securityConfig } from "@/lib/security/config";
import { githubRedirectUri } from "@/lib/security/github";
import { encryptSecret } from "@/lib/security/crypto";
import { aiConfig, siteConfig, uploadConfig } from "@/lib/system-config";
import { sendCode, normalizePhone } from "@/lib/security/verification";
import { smsConfigured } from "@/lib/security/sms";
import { callAI } from "@/lib/ai/provider";
import { captchaConfig } from "@/lib/security/captcha";

const serviceUrl = z.string().url().refine((value) => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(url.hostname); }, "Use a public HTTPS service URL");
const schemas = {
  site: z.object({ name: z.string().trim().min(2).max(60), description: z.string().max(300), announcement: z.string().max(500), supportEmail: z.union([z.string().email(), z.literal("")]), defaultLocale: z.enum(["zh", "en"]) }).strict(),
  authentication: z.object({ registrationEnabled: z.boolean(), passwordLogin: z.boolean(), phoneLogin: z.boolean(), emailVerification: z.boolean(), totpAllowed: z.boolean(), smsEnabled: z.boolean(), smtpHost: z.string().regex(/^[a-zA-Z0-9.-]+$/).min(3).max(253), smtpPort: z.number().int().min(1).max(65535), smtpSecure: z.boolean(), smtpUser: z.string().max(254), smtpFrom: z.string().email(), smtpPassword: z.string().max(300).optional(), smsProvider: z.enum(["gateway", "ihuyi", "aliyun"]).default("gateway"), smsAccount: z.string().max(100).default(""), smsUrl: z.union([serviceUrl, z.literal("")]), smsToken: z.string().max(500).optional(), smsTemplate: z.string().max(120), smsSign: z.string().max(80), smsScheme: z.string().regex(/^[A-Za-z0-9_-]{1,11}$/).default("CampusPulse"), smsTemplateChange: z.string().regex(/^\d+$/).max(120).default("100002"), smsTemplateReset: z.string().regex(/^\d+$/).max(120).default("100003"), smsTemplateBind: z.string().regex(/^\d+$/).max(120).default("100004"), smsTemplateVerify: z.string().regex(/^\d+$/).max(120).default("100005"), githubEnabled: z.boolean(), githubClientId: z.string().max(100).default(""), githubClientSecret: z.string().max(300).optional() }).strict(),
  ai: z.object({ enabled: z.boolean(), baseUrl: serviceUrl, model: z.string().min(1).max(150), visionModel: z.string().min(1).max(150), apiKey: z.string().max(500).optional(), timeout: z.number().int().min(15).max(180) }).strict(),
  uploads: z.object({ maxMb: z.number().int().min(1).max(20), maxRows: z.number().int().min(10).max(20000), maxColumns: z.number().int().min(1).max(150), imagesEnabled: z.boolean() }).strict(),
  captcha: z.object({ enabled: z.boolean(), normalAppId: z.number().int().positive().max(2147483647), invisibleAppId: z.number().int().positive().max(2147483647), normalSecret: z.string().max(300).optional(), invisibleSecret: z.string().max(300).optional(), secretId: z.string().max(300).optional(), secretKey: z.string().max(300).optional() }).strict(),
};
export async function GET() {
  try {
    await platformAccess();
    const [authentication, ai, site, uploads, captcha, logs] = await Promise.all([securityConfig(), aiConfig(), siteConfig(), uploadConfig(), captchaConfig(), prisma.auditLog.findMany({ where: { action: { startsWith: "platform." } }, take: 50, orderBy: { createdAt: "desc" } })]);
    const { smtpPassword, smsToken, githubClientSecret, ...safeAuth } = authentication;
    const { apiKey, ...safeAi } = ai;
    return NextResponse.json({ authentication: { ...safeAuth, smtpPasswordConfigured: !!smtpPassword, smsTokenConfigured: !!smsToken, githubClientSecretConfigured: !!githubClientSecret }, ai: { ...safeAi, apiKeyConfigured: !!apiKey }, captcha: { enabled: captcha.enabled, normalAppId: captcha.normalAppId, invisibleAppId: captcha.invisibleAppId, normalSecretConfigured: !!captcha.normalSecret, invisibleSecretConfigured: !!captcha.invisibleSecret, secretIdConfigured: !!captcha.secretId, secretKeyConfigured: !!captcha.secretKey }, site, uploads, logs, infrastructure: { database: "PostgreSQL", storage: "S3 compatible, private", storageEndpoint: process.env.S3_ENDPOINT, bucket: process.env.S3_BUCKET, secretStorage: "AES-256-GCM", oauth: githubOAuth(authentication) ? "GitHub OAuth ready" : "GitHub OAuth pending credentials", oauthCallback: githubRedirectUri() } });
  } catch (error) { return apiFailure(error); }
}
export async function PUT(request: Request) {
  try {
    const user = await platformAccess();
    const body = z.object({ section: z.enum(["site", "authentication", "ai", "uploads", "captcha"]), value: z.unknown() }).parse(await request.json());
    const value = schemas[body.section].parse(body.value) as Record<string, string | number | boolean | undefined>;
    const existing = await prisma.systemConfig.findUnique({ where: { id: body.section } });
    const saved = { ...(existing?.value as object ?? {}), ...value };
    const secretFields = ["smtpPassword", "smsToken", "apiKey", "normalSecret", "invisibleSecret", "secretId", "secretKey", "githubClientSecret"];
    for (const field of secretFields) {
      if (typeof value[field] === "string" && value[field]) saved[field as keyof typeof saved] = encryptSecret(value[field]) as never;
      else if (field in value) {
        if (existing?.value && typeof existing.value === "object" && !Array.isArray(existing.value) && field in existing.value) saved[field as keyof typeof saved] = existing.value[field] as never;
        else delete saved[field as keyof typeof saved];
      }
    }
    if (body.section === "authentication") {
      const current = await securityConfig();
      const configured = smsConfigured({ ...current, ...value, smsToken: String(value.smsToken || current.smsToken || "") } as typeof current);
      if (value.smsEnabled && !configured) throw new ApiError(400, "Complete SMS provider credentials and template before enabling / 启用前请填写短信凭据与模板");
      if (!value.passwordLogin && !(value.phoneLogin && configured)) throw new ApiError(400, "Keep at least one configured login method enabled");
      const githubId = String(value.githubClientId ?? current.githubClientId ?? "");
      const githubSecret = typeof value.githubClientSecret === "string" && value.githubClientSecret ? value.githubClientSecret : current.githubClientSecret;
      if (value.githubEnabled && !(githubId && githubSecret)) throw new ApiError(400, "Fill in the GitHub OAuth App client ID and secret before enabling / 启用前请填写 GitHub OAuth 应用的 Client ID 与 Client Secret");
    }
    await prisma.systemConfig.upsert({ where: { id: body.section }, update: { value: saved }, create: { id: body.section, value: saved } });
    await audit(user.id, (await getPersonalSpace(user.id)).id, "platform.config." + body.section, { fields: Object.keys(value).filter((field) => !secretFields.includes(field)) });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
export async function POST(request: Request) {
  try {
    const user = await platformAccess();
    const data = z.object({ action: z.enum(["smtp_test", "sms_test", "ai_test"]), email: z.string().email().optional(), phone: z.string().max(30).optional() }).parse(await request.json());
    if (data.action === "sms_test") {
      if (!data.phone) throw new ApiError(400, "Test phone number required");
      const phone = normalizePhone(data.phone);
      const result = await sendCode("sms", phone, "sms_test", user.id);
      await audit(user.id, (await getPersonalSpace(user.id)).id, "platform.sms.test", { recipient: phone.replace(/\d(?=\d{4})/g, "*") });
      return NextResponse.json(result);
    }
    if (data.action === "smtp_test") {
      if (!data.email) throw new ApiError(400, "Test recipient required");
      const result = await sendCode("email", data.email.toLowerCase(), "smtp_test", user.id);
      await audit(user.id, (await getPersonalSpace(user.id)).id, "platform.smtp.test", { recipient: data.email });
      return NextResponse.json(result);
    }
    const result = await callAI([{ role: "user", content: "Reply with exactly: CampusPulse AI connection ready" }], { timeout: 30000 });
    await audit(user.id, (await getPersonalSpace(user.id)).id, "platform.ai.test");
    return NextResponse.json({ ok: true, reply: result.content });
  } catch (error) { return apiFailure(error); }
}
