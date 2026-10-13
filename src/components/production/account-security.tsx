"use client";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { ShieldCheck, Smartphone, Mail, KeyRound } from "lucide-react";
import { verifyHuman } from "@/lib/captcha-client";
import { FactorDialog, RecoveryCodesDialog } from "@/components/factor-dialog";
import { IdentityDialog } from "@/components/identity-dialog";
import { PasswordDialog } from "@/components/password-dialog";
import { RoundedSelect } from "@/components/rounded-select";
import { PhoneInput } from "@/components/phone-input";
import { isValidPhone } from "@/lib/phone";
import type { IdentityMethod, SecurityIntent } from "@/lib/security/intent";
import Image from "next/image";
import { request, useResource, useText, Notice } from "./shared";

type Security = { email: string | null; phone: string | null; totpEnabled: boolean; totpAllowed: boolean; smsEnabled: boolean; smsCountries?: string[]; methods: IdentityMethod[]; recoveryRemaining: number; emailVerified: boolean; phoneVerified: boolean };
type ActionResult = { qr?: string; secret?: string; enrollmentProof?: string; recoveryCodes?: string[]; signInAgain?: boolean };

export default function AccountSecurity() {
  const { text, locale } = useText();
  const resource = useResource<Security>("/api/security");
  const [intent, setIntent] = useState<SecurityIntent | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [setup, setSetup] = useState<{ qr: string; secret: string; enrollmentProof: string } | null>(null);
  const [backup, setBackup] = useState<string[]>([]);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [verifyExistingPhone, setVerifyExistingPhone] = useState(false);
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [passwordProof, setPasswordProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [signAgain, setSignAgain] = useState(false);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((previous) => Math.max(0, previous - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function start(action: SecurityIntent["action"]) {
    if (busy) return;
    setFailure(""); setNotice("");
    setIntent({ action, target: ["bind_email", "bind_phone", "verify_phone"].includes(action) ? target : "", code: ["bind_email", "bind_phone", "verify_phone"].includes(action) ? code : "", newPassword: "" });
  }

  async function complete(result: ActionResult) {
    if (result.qr && result.secret && result.enrollmentProof) setSetup({ qr: result.qr, secret: result.secret, enrollmentProof: result.enrollmentProof });
    if (result.recoveryCodes) { setBackup(result.recoveryCodes); setSetup(null); }
    if (result.signInAgain) setSignAgain(true);
    else await resource.refresh();
    setNotice(text("安全设置已更新。", "Security settings updated."));
  }

  async function authorize(proof: string) {
    if (!intent) return;
    const pending = intent;
    if (pending.action === "password") { setIntent(null); setPasswordProof(proof); return; }
    setIntent(null); setBusy(true);
    try { await complete(await request<ActionResult>("/api/security", "POST", { intent: pending, proof })); }
    catch (problem) { setFailure(String(problem)); }
    finally { setBusy(false); }
  }

  async function savePassword(password: string, captcha: unknown, captchaScope: "normal" | "invisible" = "invisible") {
    setBusy(true);
    try { const result = await request<ActionResult>("/api/security", "POST", { action: "password", newPassword: password, proof: passwordProof, captcha, captchaScope }); setPasswordProof(""); await complete(result); }
    finally { setBusy(false); }
  }

  async function confirmEnrollment(value: string, captcha?: unknown, captchaScope: "normal" | "invisible" = "invisible") {
    if (!setup) return;
    setBusy(true);
    try { const result = await request<ActionResult>("/api/security", "POST", { action: "enable", code: value, enrollmentProof: setup.enrollmentProof, captcha, captchaScope }); setEnrolling(false); await complete(result); }
    finally { setBusy(false); }
  }

  async function sendVerification() {
    if (busy || cooldown || !target) return;
    if (channel === "sms" && !isValidPhone(target)) { setFailure(text("请填写所选地区的有效手机号", "Enter a valid mobile number for the selected country")); return; }
    if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) { setFailure(text("请填写有效的邮箱地址", "Enter a valid email address")); return; }
    setBusy(true); setFailure(""); setNotice("");
    try {
      const captcha = await verifyHuman("normal", locale);
      const result = await request<{ resendAfter: number }>("/api/auth/code", "POST", { channel, target, purpose: verifyExistingPhone ? "verify_phone" : channel === "sms" ? "bind_phone" : "bind_email", captcha });
      setCooldown(result.resendAfter);
      setNotice(text("验证码已发送，请查收。", "Verification code sent. Check your inbox or phone."));
    } catch (problem) { setFailure(String(problem)); }
    finally { setBusy(false); }
  }

  return <section className="panel panel-pad account-security">
    <div className="security-page-heading"><div><div className="section-eyebrow">ACCOUNT SECURITY</div><h2><ShieldCheck size={22} />{text("账号与登录安全", "Account & sign-in security")}</h2><p>{text("敏感操作会弹出身份验证窗口，只能使用账号已设置的验证方式。", "Sensitive actions open a verification window using methods already linked to your account.")}</p></div><span className="status-badge ready">{resource.data?.totpEnabled ? "2FA ON" : "2FA OFF"}</span></div>
    <Notice error={failure || resource.error} loading={resource.loading} />
    <div className="security-identities">
      <div className="security-identity"><Mail size={18} /><div><small>{text("已绑定邮箱", "Linked email")}</small><strong>{resource.data?.email ?? text("未绑定邮箱", "No linked email")}</strong></div></div>
      <div className="security-identity"><Smartphone size={18} /><div><small>{text("已绑定手机", "Linked phone")}</small><strong>{resource.data?.phone ?? text("未绑定手机", "No linked phone")}</strong></div>{resource.data?.phone && <button className="language-button" disabled={busy || !resource.data.smsEnabled} onClick={() => { setVerifyExistingPhone(true); setChannel("sms"); setTarget(resource.data!.phone!); setCode(""); document.getElementById("contact-verification")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>{text("验证手机号", "Verify phone")}</button>}</div>
    </div>
    {signAgain ? <div className="notice-card"><h3>{text("安全设置已更新，请重新登录", "Security updated. Sign in again")}</h3><p>{text("旧登录会话已撤销。如有新的恢复码，请先保存。", "Previous sessions have been revoked. Save any new recovery codes before signing in again.")}</p><button className="send-button" onClick={() => void signOut({ callbackUrl: "/login" })}>{text("重新登录", "Sign in again")}</button></div> : <div className="security-sections">
      <section className="security-block"><div className="security-block-heading"><h3><ShieldCheck size={18} />Microsoft Authenticator / TOTP</h3><p>{text("使用认证器为账号添加第二层登录保护。", "Add an extra layer of sign-in protection with your authenticator.")}</p></div>
        {setup && <div className="totp-setup"><Image unoptimized src={setup.qr} alt={text("Authenticator绑定二维码", "Authenticator setup QR code")} width={220} height={220} /><div><p>{text("在 Authenticator 中添加“其他账户”，扫描二维码。也可手动输入下方密钥；请在5分钟内确认。", "In Authenticator, add an Other account and scan the QR code, or enter this key manually. Confirm within five minutes.")}</p><code className="source-text">{setup.secret}</code><button className="send-button" disabled={busy} onClick={() => setEnrolling(true)}>{text("确认开启2FA", "Confirm and enable 2FA")}</button></div></div>}
        <div className="security-block-actions">{resource.data?.totpEnabled ? <><button className="language-button" disabled={busy} onClick={() => start("recovery")}>{text("重新生成恢复码", "Regenerate recovery codes")}</button><button className="language-button danger-button" disabled={busy} onClick={() => start("disable")}>{text("关闭2FA", "Disable 2FA")}</button><small>{resource.data.recoveryRemaining} {text("个未使用恢复码", "unused recovery codes")}</small></> : <button className="send-button" disabled={busy || !resource.data?.totpAllowed} onClick={() => start("setup")}>{text("绑定 Authenticator", "Set up Authenticator")}</button>}</div>
      </section>
      <section className="security-block" id="contact-verification"><div className="security-block-heading"><h3><Smartphone size={18} />{verifyExistingPhone ? text("验证已绑定手机号", "Verify your linked phone") : text("绑定或更新联系方式", "Link or update contact details")}</h3><p>{verifyExistingPhone ? text("验证码将发送到当前账号已绑定的手机号。", "The code is sent only to the phone linked to your account.") : text("先验证新的联系方式，确认时再验证当前账号身份。", "Verify the new contact, then verify your current account when confirming.")}</p>{verifyExistingPhone && <button className="language-button security-back-button" onClick={() => { setVerifyExistingPhone(false); setTarget(""); setCode(""); }}>{text("返回联系方式绑定", "Back to contact linking")}</button>}</div>
        <div className="security-fields"><label>{text("联系方式", "Contact type")}<RoundedSelect aria-label={text("联系方式", "Contact type")} className="auth-input" value={channel} disabled={busy || verifyExistingPhone} onChange={(event) => { setChannel(event.target.value === "sms" ? "sms" : "email"); setTarget(""); setCode(""); }}><option value="email">{text("邮箱", "Email")}</option><option value="sms" disabled={!resource.data?.smsEnabled}>{text("手机", "Phone")}</option></RoundedSelect></label><label>{channel === "email" ? text("新邮箱地址", "New email address") : text("手机号", "Phone number")}{channel === "sms" ? <PhoneInput label={text("手机号", "Phone number")} value={target} onChange={setTarget} allowedCountries={resource.data?.smsCountries} disabled={busy} readOnly={verifyExistingPhone}/> : <input className="auth-input" type="email" autoComplete="email" placeholder="you@example.com" disabled={busy} value={target} onChange={(event) => setTarget(event.target.value)}/>}</label></div>
        <div className="security-verification"><label>{text("联系方式验证码", "Contact verification code")}<input aria-label={text("绑定验证码", "Link verification code")} className="auth-input" value={code} placeholder={text("输入6位验证码", "Enter the 6-digit code")} inputMode="numeric" autoComplete="one-time-code" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label><button className="language-button" disabled={busy || !target || cooldown > 0} onClick={() => void sendVerification()}>{cooldown ? `${cooldown}s` : text("发送验证码", "Send code")}</button></div>
        <div className="security-block-footer"><p>{text("确认时可选择已绑定邮箱、手机号或2FA验证。", "Confirm using a linked email, phone or 2FA method.")}</p><button className="send-button" disabled={busy || code.length !== 6 || !target} onClick={() => start(verifyExistingPhone ? "verify_phone" : channel === "sms" ? "bind_phone" : "bind_email")}>{verifyExistingPhone ? text("确认验证", "Confirm verification") : text("确认绑定", "Confirm link")}</button></div>
      </section>
      <section className="security-block"><div className="security-block-heading"><h3><KeyRound size={18} />{text("修改密码", "Change password")}</h3><p>{text("先验证账号身份，再在独立窗口中设置新密码。", "Verify your identity, then set a new password in a separate window.")}</p></div><div className="security-block-actions"><button className="language-button" disabled={busy} onClick={() => start("password")}>{text("更新密码", "Update password")}</button></div></section>
    </div>}
    {intent && <IdentityDialog intent={intent} onVerified={authorize} onCancel={() => setIntent(null)} />}
    {passwordProof && <PasswordDialog onSave={savePassword} onCancel={() => setPasswordProof("")} />}
    {enrolling && <FactorDialog enrollment onCancel={() => setEnrolling(false)} onVerify={confirmEnrollment} />}
    {backup.length > 0 && <RecoveryCodesDialog codes={backup} onClose={() => setBackup([])} />}
    {notice && <div className="notice-card" role="status">{notice}</div>}
  </section>;
}
