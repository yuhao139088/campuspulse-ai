import { isValidPhone } from "./phone";
type AuthFields = { mode: "login" | "register" | "reset"; channel: "email" | "sms"; name: string; target: string; password: string; code: string; needsCode: boolean };
export type AuthFieldErrors = Partial<Record<"name" | "target" | "password" | "code", string>>;

export function validateAuthFields(fields: AuthFields, locale: "zh" | "en"): AuthFieldErrors {
  const text = (zh: string, en: string) => locale === "zh" ? zh : en;
  const errors: AuthFieldErrors = {};
  if (fields.mode === "register" && fields.name.trim().length < 2) errors.name = text("请输入至少2个字符的姓名", "Enter a name with at least 2 characters");
  const target = fields.target.trim();
  if (!target) errors.target = fields.channel === "sms" ? text("请输入手机号", "Enter your phone number") : text("请输入邮箱或已绑定手机号", "Enter your email or linked phone");
  else if (fields.channel === "sms") {
    if (!isValidPhone(target)) errors.target = text("请填写所选地区的有效手机号", "Enter a valid mobile number for the selected country");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target) && !(fields.mode === "login" && isValidPhone(target))) errors.target = text("请填写有效的邮箱地址", "Enter a valid email address");
  if (fields.mode !== "login" || fields.channel === "email") {
    if (!fields.password) errors.password = text("请输入密码", "Enter your password");
    else if (fields.mode !== "login" && fields.password.length < 8) errors.password = text("密码至少需要8个字符", "Use at least 8 characters");
    else if (new TextEncoder().encode(fields.password).length > 72) errors.password = text("密码最多72字节，请缩短密码", "Use a password of at most 72 bytes");
  }
  if (fields.needsCode && !/^\d{6}$/.test(fields.code)) errors.code = text("请输入6位数字验证码", "Enter the 6-digit verification code");
  return errors;
}
