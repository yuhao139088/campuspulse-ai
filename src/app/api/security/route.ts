import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import { currentUser, audit, ApiError, apiFailure } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getPersonalSpace } from "@/lib/workspace";
import { allowRequest } from "@/lib/rate-limit";
import { securityConfig } from "@/lib/security/config";
import { smsConfigured } from "@/lib/security/sms";
import { codeHash, encryptSecret, decryptSecret } from "@/lib/security/crypto";
import { generateTotpSecret, matchingTotpStep } from "@/lib/security/totp";
import { consumeCode, validateCode } from "@/lib/security/verification";
import { identityMethods, validateSecurityAction } from "@/lib/security/identity";
import { normalizeSecurityIntent, securityIntentContext } from "@/lib/security/intent";
import { checkCaptchaGate, consumeCaptchaGate, issueCaptchaGate, requestIp, verifyCaptcha } from "@/lib/security/captcha";

export async function GET() {
  try {
    const user = await currentUser();
    if (user.demo) throw new ApiError(403, "Use a real account");
    const config = await securityConfig();
    return NextResponse.json({ email: user.email, emailVerified: !!user.emailVerified, phone: user.phone, phoneVerified: !!user.phoneVerified, totpEnabled: user.totpEnabled, totpAllowed: config.totpAllowed, smsEnabled: smsConfigured(config), smsCountries: config.smsProvider === "gateway" ? ["CN", "HK", "MO", "TW", "US", "GB", "AU", "SG", "JP", "KR"] : ["CN"], methods: identityMethods(user, config), recoveryRemaining: Array.isArray(user.recoveryCodes) ? user.recoveryCodes.length : 0 });
  } catch (error) { return apiFailure(error); }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (user.demo) throw new ApiError(403, "Use a real account");
    if (!allowRequest("account-security:" + user.id, 12, 600000)) throw new ApiError(429, "Too many security attempts");
    const body = z.record(z.string(), z.unknown()).parse(await request.json());
    const config = await securityConfig();
    const ip = requestIp(request.headers);
    if (body.action === "password") {
      const data = z.object({ action: z.literal("password"), newPassword: z.string().min(8).max(72), proof: z.string().min(1).max(128), captcha: z.unknown().optional(), captchaScope: z.enum(["normal", "invisible"]).default("invisible") }).strict().parse(body);
      if (Buffer.byteLength(data.newPassword) > 72) throw new ApiError(400, "Use an 8–72 byte password");
      await verifyCaptcha(request.headers, data.captcha, data.captchaScope);
      const gate = await checkCaptchaGate("security", data.proof, user.id, user.authVersion, securityIntentContext(normalizeSecurityIntent({ action: "password" })), ip);
      const passwordHash = await hash(data.newPassword, 12);
      await consumeCaptchaGate(gate);
      const updated = await prisma.user.updateMany({ where: { id: user.id, authVersion: user.authVersion }, data: { passwordHash, authVersion: { increment: 1 } } });
      if (!updated.count) throw new ApiError(409, "Account security has changed; verify again");
      await audit(user.id, (await getPersonalSpace(user.id)).id, "account.password");
      return NextResponse.json({ ok: true, signInAgain: true });
    }
    if (body.action === "enable") {
      const data = z.object({ action: z.literal("enable"), code: z.string().regex(/^\d{6}$/), enrollmentProof: z.string().min(1).max(128), captcha: z.unknown().optional(), captchaScope: z.enum(["normal", "invisible"]).default("invisible") }).strict().parse(body);
      if (!config.totpAllowed || user.totpEnabled || !user.totpPendingSecret || !user.totpPendingExpires || user.totpPendingExpires < new Date()) throw new ApiError(400, "Authenticator setup has expired or is unavailable");
      await verifyCaptcha(request.headers, data.captcha, data.captchaScope);
      const gate = await checkCaptchaGate("enrollment", data.enrollmentProof, user.id, user.authVersion, user.totpPendingSecret, ip);
      const step = matchingTotpStep(decryptSecret(user.totpPendingSecret), data.code);
      if (step === null) throw new ApiError(400, "Authenticator code invalid; check your phone clock");
      const recovery = Array.from({ length: 10 }, () => randomBytes(6).toString("hex").toUpperCase());
      await consumeCaptchaGate(gate);
      const activated = await prisma.user.updateMany({ where: { id: user.id, authVersion: user.authVersion, totpEnabled: false, totpPendingSecret: user.totpPendingSecret }, data: { totpSecret: user.totpPendingSecret, totpEnabled: true, totpLastStep: step, totpPendingSecret: null, totpPendingExpires: null, recoveryCodes: recovery.map((value) => codeHash("recovery:" + user.id + ":" + value)), authVersion: { increment: 1 } } });
      if (!activated.count) throw new ApiError(409, "Setup has changed; start again");
      await audit(user.id, (await getPersonalSpace(user.id)).id, "account.2fa.enabled");
      return NextResponse.json({ ok: true, recoveryCodes: recovery, signInAgain: true });
    }
    const data = z.object({ intent: z.unknown(), proof: z.string().min(1).max(128) }).strict().parse(body);
    const intent = normalizeSecurityIntent(data.intent);
    if (intent.action === "password") throw new ApiError(400, "Verify your identity, then confirm the new password with human verification");
    validateSecurityAction(user, config, intent);
    const gate = await checkCaptchaGate("security", data.proof, user.id, user.authVersion, securityIntentContext(intent), ip);
    if (["bind_phone", "bind_email", "verify_phone"].includes(intent.action)) {
      const channel = intent.action === "bind_email" ? "email" : "sms";
      await validateCode(channel, intent.target, intent.action, intent.code, user.id);
      if (intent.action !== "verify_phone") {
        const owner = await prisma.user.findFirst({ where: channel === "email" ? { email: intent.target } : { phone: intent.target } });
        if (owner && owner.id !== user.id) throw new ApiError(409, "This address is already bound");
      }
    }
    await consumeCaptchaGate(gate);
    if (intent.action === "setup") {
      const secret = generateTotpSecret();
      const encrypted = encryptSecret(secret);
      const updated = await prisma.user.updateMany({ where: { id: user.id, authVersion: user.authVersion, totpEnabled: false }, data: { totpPendingSecret: encrypted, totpPendingExpires: new Date(Date.now() + 300000) } });
      if (!updated.count) throw new ApiError(409, "Account security has changed; start again");
      const enrollmentProof = await issueCaptchaGate("enrollment", user.id, user.authVersion, encrypted, ip);
      const uri = "otpauth://totp/" + encodeURIComponent("CampusPulse AI:" + (user.email ?? user.phone ?? user.id)) + "?secret=" + secret + "&issuer=CampusPulse%20AI&algorithm=SHA1&digits=6&period=30";
      await audit(user.id, (await getPersonalSpace(user.id)).id, "account.2fa.setup");
      return NextResponse.json({ qr: await QRCode.toDataURL(uri), secret, enrollmentProof, expiresIn: 300 });
    }
    let changes: Parameters<typeof prisma.user.updateMany>[0]["data"];
    let recovery: string[] | undefined;
    if (intent.action === "disable") changes = { totpEnabled: false, totpSecret: null, totpLastStep: null, totpPendingSecret: null, totpPendingExpires: null, recoveryCodes: [], authVersion: { increment: 1 } };
    else if (intent.action === "recovery") {
      recovery = Array.from({ length: 10 }, () => randomBytes(6).toString("hex").toUpperCase());
      changes = { recoveryCodes: recovery.map((value) => codeHash("recovery:" + user.id + ":" + value)), authVersion: { increment: 1 } };
    } else {
      const channel = intent.action === "bind_email" ? "email" : "sms";
      await consumeCode(channel, intent.target, intent.action, intent.code, user.id);
      changes = intent.action === "verify_phone" ? { phoneVerified: new Date() } : channel === "email" ? { email: intent.target, emailVerified: new Date(), authVersion: { increment: 1 } } : { phone: intent.target, phoneVerified: new Date(), authVersion: { increment: 1 } };
    }
    const updated = await prisma.user.updateMany({ where: { id: user.id, authVersion: user.authVersion }, data: changes });
    if (!updated.count) throw new ApiError(409, "Account security has changed; verify again");
    await audit(user.id, (await getPersonalSpace(user.id)).id, "account." + intent.action);
    return NextResponse.json({ ok: true, ...(recovery ? { recoveryCodes: recovery } : {}), signInAgain: intent.action !== "verify_phone" });
  } catch (error) { return apiFailure(error); }
}
