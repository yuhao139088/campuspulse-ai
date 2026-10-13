import { ApiError } from "./errors";

const nationalRules = [
  { prefix: "+886", pattern: /^9\d{8}$/ },
  { prefix: "+852", pattern: /^[4-9]\d{7}$/ },
  { prefix: "+853", pattern: /^6\d{7}$/ },
  { prefix: "+86", pattern: /^1[3-9]\d{9}$/ },
  { prefix: "+1", pattern: /^[2-9]\d{2}[2-9]\d{6}$/ },
  { prefix: "+44", pattern: /^7\d{9}$/ },
  { prefix: "+61", pattern: /^4\d{8}$/ },
  { prefix: "+65", pattern: /^[89]\d{7}$/ },
  { prefix: "+81", pattern: /^[789]0\d{8}$/ },
  { prefix: "+82", pattern: /^10\d{8}$/ },
];

export function normalizePhone(phone: string) {
  const compact = phone.replace(/[\s()-]/g, "");
  const normalized = /^1[3-9]\d{9}$/.test(compact) ? "+86" + compact : compact;
  const rule = nationalRules.find((item) => normalized.startsWith(item.prefix));
  if (!/^\+[1-9]\d{7,14}$/.test(normalized) || !rule || !rule.pattern.test(normalized.slice(rule.prefix.length))) throw new ApiError(400, "Enter a valid mobile number for the selected country / 请填写所选地区的有效手机号");
  return normalized;
}

export function isValidPhone(phone: string) {
  try { normalizePhone(phone); return true; }
  catch { return false; }
}
