import { z } from "zod";
import { normalizePhone } from "../phone";

export const securityIntentSchema = z.object({
  action: z.enum(["setup", "disable", "recovery", "bind_phone", "bind_email", "verify_phone", "password", "bind_github"]),
  target: z.string().max(254).default(""),
  newPassword: z.string().max(72).default(""),
  code: z.string().max(6).default(""),
}).strict();
export type SecurityIntent = z.infer<typeof securityIntentSchema>;
export type IdentityMethod = "email" | "sms" | "totp" | "recovery";

export function normalizeSecurityIntent(value: unknown): SecurityIntent {
  const intent = securityIntentSchema.parse(value);
  if (intent.action === "bind_email") intent.target = z.string().email().parse(intent.target.trim().toLowerCase());
  else if (intent.action === "bind_phone" || intent.action === "verify_phone") intent.target = normalizePhone(intent.target);
  else intent.target = "";
  intent.newPassword = "";
  if (!["bind_email", "bind_phone", "verify_phone"].includes(intent.action)) intent.code = "";
  return intent;
}

export function securityIntentContext(intent: SecurityIntent) {
  return JSON.stringify([intent.action, intent.target, intent.newPassword]);
}
