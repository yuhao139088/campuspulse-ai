import { NextResponse } from "next/server";
import { githubOAuth, securityConfig } from "@/lib/security/config";
import { smsConfigured } from "@/lib/security/sms";
import { siteConfig } from "@/lib/system-config";
import { apiFailure } from "@/lib/access";
import { captchaConfig, captchaReady } from "@/lib/security/captcha";
export async function GET() {
  try {
    if (process.env.DEMO_AUTH_ENABLED === "true") return NextResponse.json({ passwordLogin: true, phoneLogin: false, emailVerification: false, registrationEnabled: true, totpAllowed: false, smsEnabled: false, githubLogin: false, site: await siteConfig() });
    const config = await securityConfig();
    const captcha = await captchaConfig();
    return NextResponse.json({ githubLogin: Boolean(githubOAuth(config)), passwordLogin: config.passwordLogin, phoneLogin: config.phoneLogin, emailVerification: config.emailVerification, registrationEnabled: config.registrationEnabled, totpAllowed: config.totpAllowed, smsEnabled: smsConfigured(config), smsCountries: config.smsProvider === "gateway" ? ["CN", "HK", "MO", "TW", "US", "GB", "AU", "SG", "JP", "KR"] : ["CN"], emailConfigured: Boolean(config.smtpUser && config.smtpPassword), site: await siteConfig(), captcha: { enabled: captcha.enabled, ready: captchaReady(captcha), normalAppId: captcha.normalAppId, invisibleAppId: captcha.invisibleAppId } });
  } catch (error) { return apiFailure(error); }
}
