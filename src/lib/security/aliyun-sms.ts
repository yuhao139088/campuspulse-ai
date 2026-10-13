import { randomUUID } from "node:crypto";
import DypnsClient, { SendSmsVerifyCodeRequest, CheckSmsVerifyCodeRequest } from "@alicloud/dypnsapi20170525";
import { $OpenApiUtil } from "@alicloud/openapi-core";
import { RuntimeOptions } from "@darabonba/typescript";
import type { SecurityConfig } from "./config";
import { ApiError } from "../errors";

export type AliyunSmsDelivery = { provider: "aliyun"; scheme: string; outId: string; verified: boolean };

export function aliyunTemplate(config: SecurityConfig, purpose: string) {
  const templates: Record<string, string> = { register: config.smsTemplate, login: config.smsTemplate, sms_test: config.smsTemplate, change_phone: config.smsTemplateChange, reset_password: config.smsTemplateReset, bind_phone: config.smsTemplateBind, verify_phone: config.smsTemplateVerify };
  if (!templates[purpose]) throw new ApiError(400, "SMS template is not configured for this operation");
  return templates[purpose];
}

function client(config: SecurityConfig) {
  if (!config.smsAccount || !config.smsToken) throw new ApiError(503, "Aliyun SMS credentials are not configured");
  return new DypnsClient(new $OpenApiUtil.Config({ accessKeyId: config.smsAccount, accessKeySecret: config.smsToken, endpoint: "dypnsapi.aliyuncs.com", regionId: "cn-hangzhou", protocol: "HTTPS" }));
}

const runtime = () => new RuntimeOptions({ connectTimeout: 15000, readTimeout: 20000, autoretry: false, maxAttempts: 1 });

function providerError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unavailable";
  const safeCode = /^[A-Za-z0-9_.-]{1,80}$/.test(code) ? code : "unavailable";
  return new ApiError(502, "Aliyun SMS request failed (" + safeCode + ") / 阿里云短信请求失败");
}

export async function checkAliyunSms(config: SecurityConfig, phone: string, code: string, delivery: AliyunSmsDelivery) {
  try {
    const response = await client(config).checkSmsVerifyCodeWithOptions(new CheckSmsVerifyCodeRequest({ countryCode: "86", phoneNumber: phone.slice(3), verifyCode: code, schemeName: delivery.scheme, outId: delivery.outId, caseAuthPolicy: 2 }), runtime());
    if (response.body?.code !== "OK" || response.body.success !== true) throw providerError({ code: response.body?.code });
    if (response.body.model?.verifyResult !== "PASS" || response.body.model.outId && response.body.model.outId !== delivery.outId) throw new ApiError(400, "Code expired or invalid / 验证码已失效或不正确");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw providerError(error);
  }
}

export async function sendAliyunSms(config: SecurityConfig, phone: string, purpose: string) {
  const purposes: Record<string, string> = { register: "register", login: "login", bind_phone: "bind", change_phone: "change", verify_phone: "verify", reset_password: "reset", sms_test: "test" };
  const scene = purposes[purpose];
  if (!scene) throw new ApiError(400, "Unsupported SMS verification purpose");
  const delivery: AliyunSmsDelivery = { provider: "aliyun", scheme: config.smsScheme + "_" + scene, outId: randomUUID(), verified: false };
  try {
    const response = await client(config).sendSmsVerifyCodeWithOptions(new SendSmsVerifyCodeRequest({
      countryCode: "86", phoneNumber: phone.slice(3), signName: config.smsSign, templateCode: aliyunTemplate(config, purpose),
      templateParam: JSON.stringify({ code: "##code##", min: "10" }), schemeName: delivery.scheme, outId: delivery.outId,
      codeLength: 6, codeType: 1, validTime: 600, interval: 60, duplicatePolicy: 1, returnVerifyCode: true, autoRetry: 0,
    }), runtime());
    if (response.body?.code !== "OK" || response.body.success !== true) throw providerError({ code: response.body?.code });
    const code = response.body.model?.verifyCode;
    if (!code || !/^\d{6}$/.test(code)) throw new ApiError(502, "Aliyun did not return the configured six-digit verification code");
    if (purpose === "sms_test") {
      await checkAliyunSms(config, phone, code, delivery);
      delivery.verified = true;
    }
    return { code, delivery };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw providerError(error);
  }
}
