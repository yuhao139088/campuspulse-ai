import { NextResponse } from "next/server";
import { z } from "zod";
import { allowRequest } from "@/lib/rate-limit";
import { currentUser, ApiError, apiFailure } from "@/lib/access";
import { sendCode, normalizePhone } from "@/lib/security/verification";
import { securityConfig } from "@/lib/security/config";
import { prisma } from "@/lib/prisma";
import { verifyCaptcha } from "@/lib/security/captcha";
export async function POST(request: Request) {
  try {
    const data = z.object({ channel: z.enum(["email", "sms"]), target: z.string().max(254), purpose: z.enum(["register", "login", "bind_phone", "bind_email", "verify_phone", "reset_password"]), captcha: z.unknown().optional() }).parse(await request.json());
    const target = data.channel === "email" ? z.string().email().parse(data.target.trim().toLowerCase()) : normalizePhone(data.target);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!allowRequest("otp-ip:" + ip, 10, 600000) || !allowRequest("otp-target:" + target, 5, 600000)) throw new ApiError(429, "Too many code requests / 发送过于频繁");
    await verifyCaptcha(request.headers, data.captcha, "normal");
    const config = await securityConfig();
    let userId: string | undefined;
    let smsPurpose: "change_phone" | undefined;
    if (data.purpose === "register" && !config.registrationEnabled) throw new ApiError(403, "Registration is paused / 已暂停注册");
    if (data.purpose === "login" && (data.channel !== "sms" || !config.phoneLogin)) throw new ApiError(403, "SMS login is unavailable");
    if (data.purpose === "bind_phone" || data.purpose === "bind_email") {
      const user = await currentUser();
      if (user.demo) throw new ApiError(403, "Unavailable in demo mode");
      if ((data.purpose === "bind_phone") !== (data.channel === "sms")) throw new ApiError(400, "Invalid verification channel");
      userId = user.id;
      if (data.purpose === "bind_phone" && user.phone && user.phone !== target) smsPurpose = "change_phone";
      const owner = await prisma.user.findFirst({ where: data.channel === "sms" ? { phone: target } : { email: target } });
      if (owner && owner.id !== user.id) throw new ApiError(409, "This address is already bound to an account");
    }
    if (data.purpose === "reset_password" || data.purpose === "login") {
      const account = await prisma.user.findFirst({ where: data.channel === "email" ? { email: target, disabled: false } : { phone: target, disabled: false } });
      if (!account) return NextResponse.json({ sent: true, expiresIn: 600, resendAfter: 60 });
    }
    if (data.purpose === "verify_phone") {
      const user = await currentUser();
      if (user.demo || data.channel !== "sms" || !user.phone || user.phone !== target) throw new ApiError(403, "Only your linked phone can be verified / 只能验证自己已绑定的手机号");
      userId = user.id;
    }
    return NextResponse.json(await sendCode(data.channel, target, data.purpose, userId, smsPurpose));
  } catch (error) { return apiFailure(error); }
}
