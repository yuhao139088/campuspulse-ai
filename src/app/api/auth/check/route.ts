import { NextResponse } from "next/server";
import { z } from "zod";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, apiFailure } from "@/lib/access";
import { allowRequest } from "@/lib/rate-limit";
import { securityConfig } from "@/lib/security/config";
import { normalizePhone, validateCode } from "@/lib/security/verification";
import { verifyCaptcha, issueCaptchaGate, checkCaptchaGate, requestIp } from "@/lib/security/captcha";

export async function POST(request: Request) {
  try {
    const data = z.object({ channel: z.enum(["email", "sms"]), target: z.string().trim().max(254), password: z.string().max(128).default(""), code: z.string().max(6).default(""), captcha: z.unknown().optional(), captchaScope: z.enum(["normal", "invisible"]).default("invisible"), factorStage: z.boolean().default(false), loginProof: z.string().max(128).default("") }).parse(await request.json());
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!allowRequest("login-check-ip:" + ip, 30, 60000) || !allowRequest("login-check:" + data.target.toLowerCase(), 12, 60000)) throw new ApiError(429, "Too many sign-in attempts / 登录尝试过于频繁");
    const verified = await verifyCaptcha(request.headers, data.captcha, data.captchaScope);
    if (process.env.DEMO_AUTH_ENABLED === "true" && data.channel === "email" && data.target.toLowerCase() === (process.env.DEMO_EMAIL ?? "demo@campuspulse.local").toLowerCase() && data.password === (process.env.DEMO_PASSWORD ?? "CampusPulse2026!")) return NextResponse.json({ requires2FA: false });
    const target = data.target.includes("@") ? data.target.toLowerCase() : normalizePhone(data.target);
    const user = await prisma.user.findFirst({ where: target.includes("@") ? { email: target } : { phone: target } });
    if (!user || user.disabled) throw new ApiError(401, "Account or sign-in credentials invalid / 账号或登录凭据无效");
    const config = await securityConfig();
    if (data.channel === "sms") {
      if (!config.smsEnabled || !config.phoneLogin || !user.phone) throw new ApiError(403, "Phone sign-in unavailable");
      await validateCode("sms", user.phone, "login", data.code);
    } else if ((!config.passwordLogin && user.globalRole !== "ADMIN") || !user.passwordHash || !await compare(data.password, user.passwordHash)) throw new ApiError(401, "Account or sign-in credentials invalid / 账号或登录凭据无效");
    if (data.factorStage && verified) await checkCaptchaGate("login", data.loginProof, user.id, user.authVersion, data.channel, requestIp(request.headers));
    const loginProof = verified ? await issueCaptchaGate(data.factorStage ? "login_factor" : "login", user.id, user.authVersion, data.channel, requestIp(request.headers)) : undefined;
    return NextResponse.json({ requires2FA: user.totpEnabled, loginProof });
  } catch (error) { return apiFailure(error); }
}
