import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import type { NextAuthOptions } from "next-auth";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { securityConfig } from "@/lib/security/config";
import { verifyFactor } from "@/lib/security/factor";
import { normalizePhone, consumeCode, validateCode } from "@/lib/security/verification";
import { captchaConfig, checkCaptchaGate, consumeCaptchaGate, requestIp } from "@/lib/security/captcha";

const demoEmail = process.env.DEMO_EMAIL ?? "demo@campuspulse.local";
const demoPassword = process.env.DEMO_PASSWORD ?? "CampusPulse2026!";
const demoAuthEnabled = process.env.DEMO_AUTH_ENABLED === "true" || (process.env.NODE_ENV !== "production" && process.env.DEMO_AUTH_ENABLED !== "false");

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET ? [GitHubProvider({ clientId: process.env.GITHUB_ID, clientSecret: process.env.GITHUB_SECRET })] : []),
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
      if (!user.email) return false;
      const email = user.email.toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing?.disabled || existing?.totpEnabled) return false;
      if (existing?.passwordHash) {
        const linked = await prisma.account.findUnique({ where: { provider_providerAccountId: { provider: "github", providerAccountId: account.providerAccountId } } });
        if (!linked || linked.userId !== existing.id) return false;
      }
      const saved = existing ?? await prisma.user.create({ data: { name: user.name, email, image: user.image } });
      await prisma.account.upsert({ where: { provider_providerAccountId: { provider: "github", providerAccountId: account.providerAccountId } }, update: {}, create: { userId: saved.id, provider: "github", providerAccountId: account.providerAccountId, type: account.type } });
      user.id = saved.id;
      user.authVersion = saved.authVersion;
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

