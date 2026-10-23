import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { currentUser, audit, ApiError, apiFailure } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getPersonalSpace } from "@/lib/workspace";
import { allowRequest } from "@/lib/rate-limit";
import { githubOAuth, securityConfig } from "@/lib/security/config";
import { signStateToken } from "@/lib/security/crypto";
import { githubBindCookie, githubLoginById, githubRedirectUri } from "@/lib/security/github";
import { normalizeSecurityIntent, securityIntentContext } from "@/lib/security/intent";
import { checkCaptchaGate, consumeCaptchaGate, requestIp, verifyCaptcha } from "@/lib/security/captcha";

async function verifiedUser(request: Request) {
  const user = await currentUser();
  if (user.demo) throw new ApiError(403, "Use a real account");
  if (!allowRequest("github-link:" + user.id, 8, 600000)) throw new ApiError(429, "Too many attempts; try again later / 操作过于频繁，请稍后再试");
  if (!githubOAuth(await securityConfig())) throw new ApiError(403, "GitHub sign-in is not configured by the administrator / 管理员尚未配置 GitHub 授权登录");
  const body = z.object({ proof: z.string().min(1).max(128), captcha: z.unknown().optional(), captchaScope: z.enum(["normal", "invisible"]).default("invisible") }).strict().parse(await request.json());
  await verifyCaptcha(request.headers, body.captcha, body.captchaScope);
  const gate = await checkCaptchaGate("security", body.proof, user.id, user.authVersion, securityIntentContext(normalizeSecurityIntent({ action: "bind_github" })), requestIp(request.headers));
  await consumeCaptchaGate(gate);
  return user;
}

export async function GET() {
  try {
    const user = await currentUser();
    const configured = Boolean(githubOAuth(await securityConfig()));
    const account = user.demo ? null : await prisma.account.findFirst({ where: { userId: user.id, provider: "github" } });
    return NextResponse.json({ configured, linked: Boolean(account), login: account ? await githubLoginById(account.providerAccountId) : null, blockedBy2fa: user.demo ? false : user.totpEnabled, redirectUri: githubRedirectUri() });
  } catch (error) { return apiFailure(error); }
}

export async function POST(request: Request) {
  try {
    const user = await verifiedUser(request);
    if (user.totpEnabled) throw new ApiError(403, "GitHub sign-in would bypass the second factor; disable 2FA first / GitHub 授权登录会绕过第二步验证，请先关闭2FA");
    (await cookies()).set(githubBindCookie, signStateToken({ purpose: "github-bind", userId: user.id }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
    await audit(user.id, (await getPersonalSpace(user.id)).id, "account.github.authorize");
    return NextResponse.json({ ok: true, callbackUrl: "/settings?github=linked" });
  } catch (error) { return apiFailure(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await verifiedUser(request);
    const account = await prisma.account.findFirst({ where: { userId: user.id, provider: "github" } });
    if (!account) throw new ApiError(404, "GitHub is not linked / 未关联 GitHub 账号");
    if (!user.passwordHash && !user.phone) throw new ApiError(409, "Keep another sign-in method before unlinking GitHub / 请先保留其他登录方式再解绑 GitHub");
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.user.update({ where: { id: user.id }, data: { authVersion: { increment: 1 } } });
    await audit(user.id, (await getPersonalSpace(user.id)).id, "account.github.unlink");
    return NextResponse.json({ ok: true, signInAgain: true });
  } catch (error) { return apiFailure(error); }
}