import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { securityConfig } from "@/lib/security/config";
import { consumeCode, normalizePhone } from "@/lib/security/verification";
import { ApiError, apiFailure } from "@/lib/access";
import { verifyCaptcha } from "@/lib/security/captcha";

export async function POST(request: Request) {
  try {
    if (!allowRequest("register:" + request.headers.get("x-forwarded-for"), 5, 600000)) throw new ApiError(429, "Too many registration attempts");
    const data = z.object({ name: z.string().trim().min(2).max(80), channel: z.enum(["email", "sms"]).default("email"), email: z.string().trim().email().optional(), phone: z.string().optional(), password: z.string().min(8).max(72), code: z.string().regex(/^\d{6}$/).optional(), captcha: z.unknown().optional() }).parse(await request.json());
    if (Buffer.byteLength(data.password) > 72) throw new ApiError(400, "Password must not exceed 72 bytes");
    await verifyCaptcha(request.headers, data.captcha, "invisible");
    const config = await securityConfig();
    if (!config.registrationEnabled) throw new ApiError(403, "Registration is paused / 已暂停注册");
    const target = data.channel === "email" ? data.email?.toLowerCase() : normalizePhone(data.phone ?? "");
    if (!target) throw new ApiError(400, "Email or phone is required");
    if (data.channel === "sms" && (!config.smsEnabled || !config.phoneLogin)) throw new ApiError(403, "Phone registration is unavailable");
    const where = data.channel === "email" ? { email: target } : { phone: target };
    if (await prisma.user.findFirst({ where })) throw new ApiError(409, "Account already exists / 账号已注册");
    if (data.channel === "sms" || config.emailVerification) await consumeCode(data.channel, target, "register", data.code ?? "");
    const user = await prisma.user.create({ data: { name: data.name, ...where, ...(data.channel === "email" ? { emailVerified: config.emailVerification ? new Date() : null } : { phoneVerified: new Date() }), passwordHash: await hash(data.password, 12) }, select: { id: true, name: true, email: true, phone: true } });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) { return apiFailure(error); }
}
