import { ApiError } from "../errors";
import type { SecurityConfig } from "./config";
import { sendAliyunSms } from "./aliyun-sms";

export function smsConfigured(config: SecurityConfig) {
  return config.smsEnabled && !!config.smsToken && (config.smsProvider === "aliyun" ? !!config.smsAccount && !!config.smsSign && /^\d+$/.test(config.smsTemplate) && /^[A-Za-z0-9_-]{1,11}$/.test(config.smsScheme) : config.smsProvider === "ihuyi" ? !!config.smsAccount && /^\d+$/.test(config.smsTemplate) : !!config.smsUrl);
}

export function validateSmsTarget(config: SecurityConfig, phone: string) {
  if (config.smsProvider !== "gateway" && !/^\+861[3-9]\d{9}$/.test(phone)) throw new ApiError(400, "This SMS provider supports mainland China mobile numbers / 当前短信服务仅支持中国大陆手机号");
}

export async function deliverSms(config: SecurityConfig, phone: string, code: string, purpose: string) {
  if (!smsConfigured(config)) throw new ApiError(503, "SMS provider is not configured / 短信服务尚未配置");
  validateSmsTarget(config, phone);
  if (config.smsProvider === "aliyun") return sendAliyunSms(config, phone, purpose);
  if (config.smsProvider === "ihuyi") {
    const body = new URLSearchParams({ account: config.smsAccount, password: config.smsToken!, mobile: phone.slice(3), content: code, templateid: config.smsTemplate });
    const response = await fetch("https://api.ihuyi.com/sms/Submit.json", {
      method: "POST", redirect: "error", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new ApiError(502, "SMS provider HTTP error / 短信供应商请求失败");
    const payload = await response.json();
    if (payload?.code !== 2 && payload?.code !== "2") {
      const status = /^\d{1,6}$/.test(String(payload?.code)) ? String(payload.code) : "unknown";
      throw new ApiError(502, "SMS provider declined delivery (" + status + ") / 短信供应商未接受发送");
    }
    return;
  }
  const response = await fetch(config.smsUrl, {
    method: "POST", redirect: "error", headers: { "Content-Type": "application/json", Authorization: "Bearer " + config.smsToken },
    body: JSON.stringify({ phone, code, purpose, template: config.smsTemplate, sign: config.smsSign, expiresIn: 600 }), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok || (await response.json())?.ok !== true) throw new ApiError(502, "SMS gateway did not accept delivery / 短信网关未确认发送");
}
