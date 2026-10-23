import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import type { NextAuthOptions } from "next-auth";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { githubOAuth, securityConfig } from "@/lib/security/config";
import { verifyFactor } from "@/lib/security/factor";
import { normalizePhone, consumeCode, validateCode } from "@/lib/security/verification";
import { captchaConfig, checkCaptchaGate, consumeCaptchaGate, requestIp } from "@/lib/security/captcha";
import { verifyStateToken } from "@/lib/security/crypto";
import { githubBindCookie, githubEmailVerified } from "@/lib/security/github";
import { getPersonalSpace } from "@/lib/workspace";

const demoEmail = process.env.DEMO_EMAIL ?? "demo@campuspulse.local";
const demoPassword = process.env.DEMO_PASSWORD ?? "CampusPulse2026!";
const demoAuthEnabled = process.env.DEMO_AUTH_ENABLED === "true" || (process.env.NODE_ENV !== "production" && process.env.DEMO_AUTH_ENABLED !== "false");

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: { email: { label: "Email or phone", type: "text" }, password: { label: "Password", type: "password" }, totp: { label: "Authenticator code", type: "text" }, loginProof: { type: "text" } },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials.password) return null;
        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);
        if (!allowRequest("login:" + email, 12, 60000)) return null;
        if (demoAuthEnabled && email === demoEmail.toLowerCase() && password === demoPassword) return { id: "demo-user", name: "郑宇豪", email: demoEmail };
        try {
          const user = await prisma.user.findFirst({ where: email.includes("@") ? { email } : { phone: normalizePhone(email) } });
          if (!user || user.disabled || !user.passwordHash || !(await compare(password, user.passwordHash))) return null;
          if (!(await securityConfig()).passwordLogin && user.globalRole !== "ADMIN") return null;
          const gate = (await captchaConfig()).enabled ? await checkCaptchaGate(user.totpEnabled ? "login_factor" : "login", credentials.loginProof ?? "", user.id, user.authVersion, "email", requestIp(request.headers ?? {})) : undefined;
          if (!await verifyFactor(user, credentials.totp ?? "")) return null;
          if (gate) await consumeCaptchaGate(gate);
          return { id: user.id, name: user.name, email: user.email, image: user.image, authVersion: user.authVersion };
        } catch {
          return null;
        }
      },
    }),
    CredentialsProvider({
      id: "phone-otp", name: "Phone verification code",
      credentials: { phone: { type: "text" }, code: { type: "text" }, totp: { type: "text" }, loginProof: { type: "text" } },
      async authorize(credentials, request) {
        if (!credentials?.phone || !credentials.code) return null;
        try {
          const phone = normalizePhone(credentials.phone);
          if (!allowRequest("phone-login:" + phone, 10, 60000)) return null;
          const config = await securityConfig();
          if (!config.smsEnabled || !config.phoneLogin) return null;
          const user = await prisma.user.findUnique({ where: { phone } });
          if (!user || user.disabled) return null;
          await validateCode("sms", phone, "login", credentials.code);
          const gate = (await captchaConfig()).enabled ? await checkCaptchaGate(user.totpEnabled ? "login_factor" : "login", credentials.loginProof ?? "", user.id, user.authVersion, "sms", requestIp(request.headers ?? {})) : undefined;
          if (!await verifyFactor(user, credentials.totp ?? "")) return null;
          if (gate) await consumeCaptchaGate(gate);
          await consumeCode("sms", phone, "login", credentials.code);
          return { id: user.id, name: user.name, email: user.email, image: user.image, authVersion: user.authVersion };
        } catch { return null; }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "github") return true;
      const config = await securityConfig();
      if (!githubOAuth(config)) return false;
      const githubId = String(account.providerAccountId ?? "");
      if (!user.email || !githubId) return false;
      const email = user.email.toLowerCase();
      const where = { provider_providerAccountId: { provider: "github", providerAccountId: githubId } };
      const bind = verifyStateToken<{ purpose: string; userId: string }>((await cookies()).get(githubBindCookie)?.value ?? "", 600);
      if (bind?.purpose === "github-bind") {
        const session = await getServerSession(authOptions);
        if (session?.user?.id !== bind.userId) return false;
        const owner = await prisma.user.findUnique({ where: { id: bind.userId } });
        if (!owner || owner.disabled || owner.totpEnabled) return false;
        const conflict = await prisma.account.findUnique({ where });
        if (conflict && conflict.userId !== owner.id) return false;
        await prisma.account.upsert({ where, update: { userId: owner.id, type: account.type }, create: { userId: owner.id, provider: "github", providerAccountId: githubId, type: account.type, scope: typeof account.scope === "string" ? account.scope : null } });
        try { (await cookies()).delete(githubBindCookie); } catch { /* cookie jar may be read-only here */ }
        await recordGithubEvent(owner.id, "account.github.link");
        user.id = owner.id;
        user.authVersion = owner.authVersion;
        return true;
      }
      const linked = await prisma.account.findUnique({ where });
      if (linked) {
        const owner = await prisma.user.findUnique({ where: { id: linked.userId } });
        if (!owner || owner.disabled || owner.totpEnabled) return false;
        await recordGithubEvent(owner.id, "account.github.signin");
        user.id = owner.id;
        user.authVersion = owner.authVersion;
        return true;
      }
      if (!config.registrationEnabled || await prisma.user.findUnique({ where: { email } })) return false;
      if (!await githubEmailVerified(typeof account.access_token === "string" ? account.access_token : "", email)) return false;
      const created = await prisma.user.create({ data: { name: user.name || email.split("@")[0], email, image: user.image } });
      await getPersonalSpace(created.id);
      await prisma.account.create({ data: { userId: created.id, provider: "github", providerAccountId: githubId, type: account.type, scope: typeof account.scope === "string" ? account.scope : null } });
      await recordGithubEvent(created.id, "account.github.register");
      user.id = created.id;
      user.authVersion = created.authVersion;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) { token.sub = user.id; token.authVersion = user.authVersion ?? 0; }
      else if (token.sub && !(token.sub === "demo-user" && demoAuthEnabled)) {
        const account = await prisma.user.findUnique({ where: { id: token.sub }, select: { disabled: true, authVersion: true } });
        if (!account || account.disabled || account.authVersion !== (token.authVersion ?? 0)) return {};
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.sub) return { ...session, user: undefined as never };
      if (session.user) { session.user.id = token.sub; session.user.authVersion = token.authVersion ?? 0; }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

async function recordGithubEvent(userId: string, action: string) {
  try {
    const space = await getPersonalSpace(userId);
    await prisma.auditLog.create({ data: { userId, spaceId: space.id, action, detail: { provider: "github" } } });
  } catch { /* audit failures must not block sign-in */ }
}

export async function buildAuthOptions(): Promise<NextAuthOptions> {
  const github = githubOAuth(await securityConfig());
  if (!github) return authOptions;
  return { ...authOptions, providers: [GitHubProvider({ clientId: github.clientId, clientSecret: github.clientSecret, authorization: { params: { scope: "read:user user:email" } } }), ...authOptions.providers] };
}

