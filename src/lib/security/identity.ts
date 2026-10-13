import type { User } from "@prisma/client";
import type { SecurityConfig } from "./config";
import type { IdentityMethod, SecurityIntent } from "./intent";
import { smsConfigured } from "./sms";
import { ApiError } from "../errors";

export function identityMethods(user: Pick<User, "email" | "phone" | "totpEnabled" | "totpSecret" | "recoveryCodes">, config: SecurityConfig): IdentityMethod[] {
  const methods: IdentityMethod[] = [];
  if (user.email && config.smtpUser && config.smtpPassword) methods.push("email");
  if (user.phone && smsConfigured(config) && (config.smsProvider === "gateway" || /^\+861[3-9]\d{9}$/.test(user.phone))) methods.push("sms");
  if (user.totpEnabled && user.totpSecret) {
    methods.push("totp");
    if (Array.isArray(user.recoveryCodes) && user.recoveryCodes.length) methods.push("recovery");
  }
  return methods;
}

export function requireIdentityMethod(user: Parameters<typeof identityMethods>[0], config: SecurityConfig, method: IdentityMethod) {
  if (!identityMethods(user, config).includes(method)) throw new ApiError(403, "This verification method is not linked or available / 此验证方式未绑定或不可用");
}

export function validateSecurityAction(user: Pick<User, "phone" | "totpEnabled">, config: SecurityConfig, intent: SecurityIntent) {
  if (intent.action === "setup" && (!config.totpAllowed || user.totpEnabled)) throw new ApiError(403, "New authenticator setup is unavailable");
  if (["disable", "recovery"].includes(intent.action) && !user.totpEnabled) throw new ApiError(400, "Authenticator is not enabled");
  if (intent.action === "verify_phone" && (!user.phone || intent.target !== user.phone)) throw new ApiError(403, "Only your linked phone can be verified");
  if (["bind_phone", "verify_phone"].includes(intent.action) && !smsConfigured(config)) throw new ApiError(503, "SMS verification is unavailable");
  if (["bind_phone", "bind_email", "verify_phone"].includes(intent.action) && !/^\d{6}$/.test(intent.code)) throw new ApiError(400, "Enter the six-digit contact verification code");
}
