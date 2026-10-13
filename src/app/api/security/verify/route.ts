import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, apiFailure, ApiError } from "@/lib/access";
import { allowRequest } from "@/lib/rate-limit";
import { securityConfig } from "@/lib/security/config";
import { identityMethods, requireIdentityMethod, validateSecurityAction } from "@/lib/security/identity";
import { normalizeSecurityIntent, securityIntentContext } from "@/lib/security/intent";
import { consumeCode, sendCode } from "@/lib/security/verification";
import { verifyFactor } from "@/lib/security/factor";
import { issueCaptchaGate, verifyCaptcha, requestIp } from "@/lib/security/captcha";
import { codeHash } from "@/lib/security/crypto";

export async function GET() {
  try {
    const user = await currentUser();
    if (user.demo) throw new ApiError(403, "Use a real account");
    const config = await securityConfig();
    const mask = (value: string | null) => value?.includes("@") ? value.replace(/^(.{1,2})[^@]*(@.*)$/, "$1***$2") : value?.replace(/\d(?=\d{4})/g, "*");
    return NextResponse.json({ methods: identityMethods(user, config).map((id) => ({ id, destination: id === "email" ? mask(user.email) : id === "sms" ? mask(user.phone) : null })) });
  } catch (error) { return apiFailure(error); }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (user.demo) throw new ApiError(403, "Use a real account");
    if (!allowRequest("security-verification:" + user.id, 20, 600000)) throw new ApiError(429, "Too many verification attempts");
    const data = z.object({ stage: z.enum(["send", "verify"]), method: z.enum(["email", "sms", "totp", "recovery"]), intent: z.unknown(), code: z.string().max(32).default(""), captcha: z.unknown().optional(), captchaScope: z.enum(["normal", "invisible"]).default("invisible") }).strict().parse(await request.json());
    const intent = normalizeSecurityIntent(data.intent);
    const config = await securityConfig();
    requireIdentityMethod(user, config, data.method);
    validateSecurityAction(user, config, intent);
    const context = securityIntentContext(intent);
    const purpose = "security:" + codeHash(context);
    if (data.stage === "send") {
      if (data.method !== "email" && data.method !== "sms") throw new ApiError(400, "Authenticator and recovery codes are not delivered");
      if (!allowRequest("security-code:" + user.id, 5, 600000)) throw new ApiError(429, "Too many code requests");
      await verifyCaptcha(request.headers, data.captcha, "normal");
      return NextResponse.json(await sendCode(data.method, data.method === "email" ? user.email! : user.phone!, purpose, user.id, data.method === "sms" ? "verify_phone" : undefined));
    }
    if (data.method !== "recovery" && !/^\d{6}$/.test(data.code)) throw new ApiError(400, "Enter the six-digit verification code");
    if (data.method === "recovery" && !/^[a-fA-F0-9]{12}$/.test(data.code.trim())) throw new ApiError(400, "Enter a valid recovery code");
    await verifyCaptcha(request.headers, data.captcha, data.captchaScope);
    if (data.method === "email" || data.method === "sms") await consumeCode(data.method, data.method === "email" ? user.email! : user.phone!, purpose, data.code, user.id);
    else if (!await verifyFactor(user, data.code)) throw new ApiError(400, "Authenticator or recovery code invalid or already used");
    const proof = await issueCaptchaGate("security", user.id, user.authVersion, context, requestIp(request.headers));
    return NextResponse.json({ proof, expiresIn: 300 });
  } catch (error) { return apiFailure(error); }
}
