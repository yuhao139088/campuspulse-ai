import { captcha } from "tencentcloud-sdk-nodejs-captcha";
import { isIP } from "node:net";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../prisma";
import { ApiError } from "../errors";
import { codeHash, decryptSecret } from "./crypto";
import { allowRequest } from "../rate-limit";

export type CaptchaConfig = { enabled: boolean; normalAppId: number; invisibleAppId: number; normalSecret?: string; invisibleSecret?: string; secretId?: string; secretKey?: string };
export async function captchaConfig(): Promise<CaptchaConfig> {
  if (process.env.DEMO_AUTH_ENABLED === "true") return { enabled: false, normalAppId: 0, invisibleAppId: 0 };
  const row = await prisma.systemConfig.findUnique({ where: { id: "captcha" } });
  const value = row?.value as Partial<CaptchaConfig> | undefined;
  const secret = (field: "normalSecret" | "invisibleSecret" | "secretId" | "secretKey", variable: string) => value?.[field] ? decryptSecret(value[field]) : process.env[variable];
  return { enabled: value?.enabled ?? process.env.CAPTCHA_ENABLED === "true", normalAppId: value?.normalAppId ?? Number(process.env.CAPTCHA_NORMAL_APP_ID ?? 0), invisibleAppId: value?.invisibleAppId ?? Number(process.env.CAPTCHA_INVISIBLE_APP_ID ?? 0), normalSecret: secret("normalSecret", "CAPTCHA_NORMAL_SECRET"), invisibleSecret: secret("invisibleSecret", "CAPTCHA_INVISIBLE_SECRET"), secretId: secret("secretId", "TENCENT_CAPTCHA_SECRET_ID"), secretKey: secret("secretKey", "TENCENT_CAPTCHA_SECRET_KEY") };
}
export function captchaReady(config: CaptchaConfig) { return !!(config.normalAppId && config.invisibleAppId && config.normalSecret && config.invisibleSecret && config.secretId && config.secretKey); }
export function requestIp(headers: Headers | Record<string, string | string[] | undefined>) {
  const value = headers instanceof Headers ? headers.get("x-forwarded-for") : headers["x-forwarded-for"];
  const ip = String(value ?? "").split(",")[0].trim();
  if (!isIP(ip)) throw new ApiError(400, "Could not verify the request source");
  return ip;
}
export function captchaResultAccepted(result: { CaptchaCode?: number; EvilLevel?: number }, scope: "normal" | "invisible") { return result.CaptchaCode === 1 && (scope === "normal" || result.EvilLevel === 0); }
export async function verifyCaptcha(headers: Headers, input: unknown, scope: "normal" | "invisible") {
  const config = await captchaConfig();
  if (!config.enabled) return false;
  if (!captchaReady(config)) throw new ApiError(503, "Human verification is not configured / 人机验证配置尚未完成");
  const data = z.object({ ticket: z.string().min(1).max(4096), randstr: z.string().min(1).max(500) }).safeParse(input);
  if (!data.success || data.data.ticket.startsWith("trerror")) throw new ApiError(400, "Complete human verification first / 请先完成人机验证");
  const ip = requestIp(headers);
  if (!allowRequest("captcha:" + ip, 30, 60000)) throw new ApiError(429, "Too many human verification attempts");
  const client = new captcha.v20190722.Client({ credential: { secretId: config.secretId!, secretKey: config.secretKey! }, region: "", profile: { httpProfile: { endpoint: "captcha.tencentcloudapi.com", reqTimeout: 15 } } });
  let result;
  try { result = await client.DescribeCaptchaResult({ CaptchaType: 9, Ticket: data.data.ticket, Randstr: data.data.randstr, UserIp: ip, CaptchaAppId: scope === "normal" ? config.normalAppId : config.invisibleAppId, AppSecretKey: scope === "normal" ? config.normalSecret! : config.invisibleSecret! }); }
  catch { throw new ApiError(502, "Tencent verification unavailable; retry or contact the administrator / 腾讯验证服务暂不可用，请重试或联系管理员"); }
  if (!captchaResultAccepted(result, scope)) {
    console.warn("Tencent human verification rejected", { scope, code: result.CaptchaCode, risk: result.EvilLevel, requestId: result.RequestId });
    throw new ApiError(403, "Human verification did not pass; retry / 人机验证未通过，请重新验证");
  }
  await prisma.verificationToken.deleteMany({ where: { expires: { lt: new Date() } } });
  try { await prisma.verificationToken.create({ data: { token: codeHash("captcha-ticket:" + data.data.ticket), identifier: "captcha:" + scope, expires: new Date(Date.now() + 300000) } }); }
  catch { throw new ApiError(400, "Verification has already been used; retry"); }
  return true;
}
function gateIdentifier(scope: string, userId: string, version: number, context: string, ip: string) { return ["captcha-gate", scope, userId, version, codeHash(context), codeHash(ip)].join(":"); }
export type VerificationScope = "login" | "login_factor" | "reset" | "security" | "enrollment";
function gateTtl(scope: VerificationScope) {
  return ["login", "login_factor", "reset"].includes(scope) ? 900000 : 300000;
}
export async function issueCaptchaGate(scope: VerificationScope, userId: string, version: number, context: string, ip: string) {
  const proof = randomBytes(32).toString("base64url");
  await prisma.verificationToken.create({ data: { token: codeHash("captcha-gate:" + proof), identifier: gateIdentifier(scope, userId, version, context, ip), expires: new Date(Date.now() + gateTtl(scope)) } });
  return proof;
}
export async function checkCaptchaGate(scope: VerificationScope, proof: string, userId: string, version: number, context: string, ip: string) {
  const token = codeHash("captcha-gate:" + proof);
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires <= new Date() || record.identifier !== gateIdentifier(scope, userId, version, context, ip)) throw new ApiError(400, "Verification expired; restart this action / 验证已失效，请重新开始");
  if (!allowRequest("captcha-gate:" + token, 5, gateTtl(scope))) throw new ApiError(429, "Too many second-factor attempts; sign in again");
  return token;
}
export async function consumeCaptchaGate(token: string) {
  const result = await prisma.verificationToken.deleteMany({ where: { token, expires: { gt: new Date() } } });
  if (result.count !== 1) throw new ApiError(400, "Verification already used");
}
