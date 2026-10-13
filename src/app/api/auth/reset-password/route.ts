import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { consumeCode, normalizePhone, validateCode } from "@/lib/security/verification";
import { verifyFactor } from "@/lib/security/factor";
import { ApiError, apiFailure } from "@/lib/access";
import { captchaConfig, verifyCaptcha, issueCaptchaGate, checkCaptchaGate, consumeCaptchaGate, requestIp } from "@/lib/security/captcha";
export async function POST(request: Request) {
  try {
    if (!allowRequest("reset:" + request.headers.get("x-forwarded-for"), 6, 600000)) throw new ApiError(429, "Too many attempts");
    const data = z.object({ channel: z.enum(["email", "sms"]), target: z.string(), code: z.string().regex(/^\d{6}$/), password: z.string().min(8).max(72), totp: z.string().default(""), captcha: z.unknown().optional(), captchaScope: z.enum(["normal", "invisible"]).default("invisible"), captchaProof: z.string().max(128).default("") }).parse(await request.json());
    if (Buffer.byteLength(data.password) > 72) throw new ApiError(400, "Password exceeds 72 bytes");
    const target = data.channel === "email" ? z.string().email().parse(data.target.toLowerCase().trim()) : normalizePhone(data.target);
    const user = await prisma.user.findFirst({ where: data.channel === "email" ? { email: target, disabled: false } : { phone: target, disabled: false } });
    if (!user) throw new ApiError(400, "Account or verification code invalid");
    const context = JSON.stringify([data.channel, target, data.password, data.code]);
    let gate: string | undefined;
    if ((await captchaConfig()).enabled) {
      if (data.captchaProof) gate = await checkCaptchaGate("reset", data.captchaProof, user.id, user.authVersion, context, requestIp(request.headers));
      await verifyCaptcha(request.headers, data.captcha, data.captchaScope);
    }
    await validateCode(data.channel, target, "reset_password", data.code);
    if (user.totpEnabled && !data.totp) {
      const captchaProof = data.captchaProof || ((await captchaConfig()).enabled ? await issueCaptchaGate("reset", user.id, user.authVersion, context, requestIp(request.headers)) : undefined);
      return NextResponse.json({ requires2FA: true, captchaProof }, { status: 202 });
    }
    if (!await verifyFactor(user, data.totp)) throw new ApiError(400, "Authenticator or recovery code invalid; use a new code");
    if (gate) await consumeCaptchaGate(gate);
    await consumeCode(data.channel, target, "reset_password", data.code);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hash(data.password, 12), authVersion: { increment: 1 } } });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
