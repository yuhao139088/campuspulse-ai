import { randomInt, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { prisma } from "../prisma";
import { ApiError } from "../errors";
import { codeHash } from "./crypto";
import { securityConfig } from "./config";
import { deliverSms, smsConfigured, validateSmsTarget } from "./sms";
import { checkAliyunSms, type AliyunSmsDelivery } from "./aliyun-sms";
export { normalizePhone } from "../phone";

export async function sendCode(channel: "email"|"sms", target: string, purpose: string, userId?: string, smsPurpose?: "change_phone" | "verify_phone") {
  const config = await securityConfig();
  await prisma.verificationCode.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
  if (channel === "email" && (!config.smtpUser || !config.smtpPassword)) throw new ApiError(503,"Email delivery is not configured");
  if (channel === "sms") {
    if (!smsConfigured(config)) throw new ApiError(503,"SMS provider is not configured / 短信服务尚未配置");
    validateSmsTarget(config, target);
  }
  const code = randomInt(100000,1000000).toString();
  const challenge = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${channel + ":" + target + ":" + purpose}))`;
    const recent = await transaction.verificationCode.findFirst({ where: { channel, target, purpose }, orderBy: { createdAt: "desc" } });
    if (recent && Date.now() - recent.createdAt.getTime() < 60000) throw new ApiError(429, "Wait 60 seconds before resending");
    await transaction.verificationCode.updateMany({ where: { channel, target, purpose, usedAt: null }, data: { usedAt: new Date() } });
    return transaction.verificationCode.create({ data: { channel, target, purpose, userId, hash: codeHash(channel + ":" + target + ":" + purpose + ":" + code), expiresAt: new Date(Date.now() + 600000) } });
  });
  try {
    let providerVerified = false;
    if (channel==="email") {
      const smtp=nodemailer.createTransport({host:config.smtpHost,port:config.smtpPort,secure:config.smtpSecure,requireTLS:!config.smtpSecure,auth:{user:config.smtpUser,pass:config.smtpPassword},connectionTimeout:15000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
      const purposeLabel = purpose.startsWith("security:") ? "账号安全验证 / Account security verification" : purpose;
      const result=await smtp.sendMail({from:{name:"CampusPulse AI",address:config.smtpFrom},to:target,subject:"CampusPulse AI 验证码 / Verification code",text:"您的验证码 / Your verification code: "+code+"\n\n用途 / Purpose: "+purposeLabel+"\n10 分钟内有效，仅可使用一次。\nValid for 10 minutes, single use. Please do not share this code."});
      if (!result.accepted?.length) throw new Error("SMTP recipient was not accepted");
    } else {
      const result = await deliverSms(config, target, code, smsPurpose ?? purpose);
      if (result) {
        await prisma.verificationCode.update({ where: { id: challenge.id }, data: { hash: codeHash(channel + ":" + target + ":" + purpose + ":" + result.code), delivery: result.delivery } });
        providerVerified = result.delivery.verified;
      }
    }
    return {sent:true,expiresIn:600,resendAfter:60,...(providerVerified ? {providerVerified:true} : {})};
  } catch (problem) {
    await prisma.verificationCode.delete({where:{id:challenge.id}});
    if (problem instanceof ApiError) throw problem;
    throw new ApiError(502,"Verification delivery failed; check the configured provider / 验证码发送失败，请检查服务配置");
  }
}

export async function validateCode(channel:string,target:string,purpose:string,code:string,userId?:string) {
  const challenge=await prisma.verificationCode.findFirst({where:{channel,target,purpose,...(userId?{userId}:{} )},orderBy:{createdAt:"desc"}});
  if(!challenge || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.attempts>=5) throw new ApiError(400,"Code expired or invalid");
  const supplied=codeHash(channel+":"+target+":"+purpose+":"+code);
  if(!timingSafeEqual(Buffer.from(supplied),Buffer.from(challenge.hash))) {
    await prisma.verificationCode.update({where:{id:challenge.id},data:{attempts:{increment:1}}});
    throw new ApiError(400,"Code expired or invalid");
  }
  const delivery = challenge.delivery as AliyunSmsDelivery | null;
  if (channel === "sms" && delivery?.provider === "aliyun" && !delivery.verified) {
    const config = await securityConfig();
    if (config.smsProvider !== "aliyun" || !smsConfigured(config)) throw new ApiError(503, "Aliyun SMS verification is unavailable");
    try { await checkAliyunSms(config, target, code, delivery); }
    catch (problem) {
      if (problem instanceof ApiError && problem.status === 400) await prisma.verificationCode.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw problem;
    }
    await prisma.verificationCode.update({ where: { id: challenge.id }, data: { delivery: { ...delivery, verified: true } } });
  }
  return challenge;
}

export async function consumeCode(channel:string,target:string,purpose:string,code:string,userId?:string) {
  const challenge = await validateCode(channel,target,purpose,code,userId);
  const consumed=await prisma.verificationCode.updateMany({where:{id:challenge.id,usedAt:null,expiresAt:{gt:new Date()},attempts:{lt:5}},data:{usedAt:new Date()}});
  if(!consumed.count) throw new ApiError(400,"Code already used");
}
