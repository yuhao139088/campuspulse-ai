import { prisma } from "./prisma";
import { decryptSecret } from "./security/crypto";

export type SiteConfig = { name: string; description: string; announcement: string; supportEmail: string; defaultLocale: "zh" | "en"; registrationEnabled?: boolean };
export const defaultSite: SiteConfig = { name: "CampusPulse AI", description: "AI-powered campus data analysis and decision workspace", announcement: "", supportEmail: "", defaultLocale: "zh" };
export type AiConfig = { baseUrl: string; model: string; visionModel: string; apiKey?: string; enabled: boolean; timeout: number };
export type UploadConfig = { maxMb: number; maxRows: number; maxColumns: number; imagesEnabled: boolean };
export async function systemValue<T>(id: string, defaults: T): Promise<T> {
  if (process.env.DEMO_AUTH_ENABLED === "true") return defaults;
  const record = await prisma.systemConfig.findUnique({ where: { id } });
  return { ...defaults, ...(record?.value as object ?? {}) };
}
export const siteConfig = () => systemValue("site", defaultSite);
export const uploadConfig = () => systemValue<UploadConfig>("uploads", { maxMb: 20, maxRows: 20000, maxColumns: 150, imagesEnabled: true });
export async function aiConfig(): Promise<AiConfig> {
  const value = await systemValue<AiConfig>("ai", { baseUrl: process.env.CARBON_AI_BASE_URL ?? "", model: process.env.CARBON_AI_MODEL ?? "", visionModel: process.env.CARBON_AI_VISION_MODEL ?? process.env.CARBON_AI_MODEL ?? "", enabled: true, timeout: 90 });
  return { ...value, apiKey: value.apiKey ? decryptSecret(value.apiKey) : process.env.CARBON_AI_API_KEY };
}
