import { prisma } from "../prisma";
import { decryptSecret } from "./crypto";
export type SecurityConfig = {
  emailVerification: boolean; totpAllowed: boolean; smsEnabled: boolean; registrationEnabled: boolean; passwordLogin: boolean; phoneLogin: boolean;
  smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser: string; smtpPassword?: string; smtpFrom: string;
  smsProvider: "gateway" | "ihuyi" | "aliyun"; smsAccount: string; smsUrl: string; smsToken?: string; smsTemplate: string; smsSign: string; smsScheme: string;
  smsTemplateChange: string; smsTemplateReset: string; smsTemplateBind: string; smsTemplateVerify: string;
  githubEnabled: boolean; githubClientId: string; githubClientSecret?: string;
};

export function githubOAuth(config: SecurityConfig) {
  if (!config.githubEnabled || !config.githubClientId || !config.githubClientSecret) return null;
  return { clientId: config.githubClientId, clientSecret: config.githubClientSecret };
}
export async function securityConfig(): Promise<SecurityConfig> {
  const stored = await prisma.systemConfig.findUnique({ where: { id: "authentication" } });
  const value = stored?.value as Partial<SecurityConfig> | undefined;
  return {
    emailVerification: value?.emailVerification ?? true,
    registrationEnabled: value?.registrationEnabled ?? true,
    passwordLogin: value?.passwordLogin ?? true,
    phoneLogin: value?.phoneLogin ?? true,
    totpAllowed: value?.totpAllowed ?? true,
    smsEnabled: value?.smsEnabled ?? process.env.SMS_ENABLED === "true",
    smtpHost: value?.smtpHost ?? process.env.SMTP_HOST ?? "smtp.163.com",
    smtpPort: value?.smtpPort ?? Number(process.env.SMTP_PORT ?? 465),
    smtpSecure: value?.smtpSecure ?? true,
    smtpUser: value?.smtpUser ?? process.env.SMTP_USER ?? "",
    smtpPassword: value?.smtpPassword ? decryptSecret(value.smtpPassword) : process.env.SMTP_PASSWORD,
    smtpFrom: value?.smtpFrom ?? process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
    smsProvider: value?.smsProvider ?? (process.env.SMS_PROVIDER === "aliyun" ? "aliyun" : process.env.SMS_PROVIDER === "ihuyi" ? "ihuyi" : "gateway"),
    smsAccount: value?.smsAccount ?? process.env.SMS_ACCOUNT ?? "",
    smsUrl: value?.smsUrl ?? process.env.SMS_URL ?? "",
    smsToken: value?.smsToken ? decryptSecret(value.smsToken) : process.env.SMS_API_KEY,
    smsTemplate: value?.smsTemplate ?? process.env.SMS_TEMPLATE ?? "",
    smsSign: value?.smsSign ?? process.env.SMS_SIGN ?? "CampusPulse AI",
    smsScheme: value?.smsScheme ?? process.env.SMS_SCHEME ?? "CampusPulse",
    smsTemplateChange: value?.smsTemplateChange ?? process.env.SMS_TEMPLATE_CHANGE ?? "100002",
    smsTemplateReset: value?.smsTemplateReset ?? process.env.SMS_TEMPLATE_RESET ?? "100003",
    smsTemplateBind: value?.smsTemplateBind ?? process.env.SMS_TEMPLATE_BIND ?? "100004",
    smsTemplateVerify: value?.smsTemplateVerify ?? process.env.SMS_TEMPLATE_VERIFY ?? "100005",
    githubEnabled: value?.githubEnabled ?? Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET),
    githubClientId: value?.githubClientId ?? process.env.GITHUB_ID ?? "",
    githubClientSecret: value?.githubClientSecret ? decryptSecret(value.githubClientSecret) : process.env.GITHUB_SECRET,
  };
}
