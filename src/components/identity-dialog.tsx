"use client";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, X, Mail, Smartphone, KeyRound } from "lucide-react";
import { RoundedSelect } from "./rounded-select";
import { isCaptchaRiskFailure, verifyHumanInDialog } from "@/lib/captcha-client";
import type { IdentityMethod, SecurityIntent } from "@/lib/security/intent";
import { request, useText, Notice } from "./production/shared";

type Method = { id: IdentityMethod; destination: string | null };
export function IdentityDialog({ intent, onVerified, onCancel }: { intent: SecurityIntent; onVerified: (proof: string, captchaScope?: "normal" | "invisible") => Promise<void>; onCancel: () => void }) {
  const { text, locale } = useText();
  const dialog = useRef<HTMLDialogElement>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [method, setMethod] = useState<IdentityMethod | "">("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldowns, setCooldowns] = useState<Partial<Record<IdentityMethod, number>>>({});
  const [now, setNow] = useState(() => Date.now());
  const cooldown = method ? Math.max(0, Math.ceil(((cooldowns[method] ?? 0) - now) / 1000)) : 0;
  const labels = { email: text("邮箱验证码", "Email code"), sms: text("手机验证码", "Phone code"), totp: text("Authenticator认证码", "Authenticator code"), recovery: text("2FA恢复码", "2FA recovery code") };
  const actions = { setup: text("开启2FA", "Set up 2FA"), disable: text("关闭2FA", "Disable 2FA"), recovery: text("更新恢复码", "Replace recovery codes"), password: text("修改密码", "Change password"), bind_email: text("修改邮箱", "Change email"), bind_phone: text("绑定或修改手机号", "Link or change phone"), verify_phone: text("验证已绑定手机号", "Verify linked phone"), bind_github: text("关联 GitHub 账号", "Link GitHub account") };
  const current = methods.find((item) => item.id === method);
  const deliverable = method === "email" || method === "sms";
  const Icon = method === "email" ? Mail : method === "sms" ? Smartphone : KeyRound;

  useEffect(() => {
    dialog.current?.showModal();
    let alive = true;
    request<{ methods: Method[] }>("/api/security/verify").then((result) => {
      if (!alive) return;
      setMethods(result.methods); setMethod(result.methods[0]?.id ?? "");
    }).catch((problem) => { if (alive) setFailure(String(problem)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!Object.values(cooldowns).some((end) => end && end > Date.now())) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldowns]);

  async function send() {
    if (!deliverable || busy || cooldown) return;
    setBusy(true); setFailure(""); setNotice("");
    try {
      const captcha = await verifyHumanInDialog(dialog.current, "normal", locale);
      const result = await request<{ resendAfter: number }>("/api/security/verify", "POST", { stage: "send", method, intent, captcha });
      const sentAt = Date.now();
      setNow(sentAt);
      setCooldowns((previous) => ({ ...previous, [method]: sentAt + result.resendAfter * 1000 }));
      setNotice(text("验证码已发送至已绑定的联系方式。", "Code sent to your linked contact."));
    } catch (problem) { setFailure(String(problem)); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !method || !current) return;
    const valid = method === "recovery" ? /^[a-fA-F0-9]{12}$/.test(code.trim()) : /^\d{6}$/.test(code);
    if (!valid) { setFailure(method === "recovery" ? text("请输入12位恢复码", "Enter your 12-character recovery code") : text("请输入6位数字验证码", "Enter the six-digit code")); return; }
    setBusy(true); setFailure("");
    try {
      let captcha = await verifyHumanInDialog(dialog.current, "invisible", locale);
      try {
        const result = await request<{ proof: string }>("/api/security/verify", "POST", { stage: "verify", method, intent, code, captcha, captchaScope: "invisible" });
        await onVerified(result.proof, "invisible");
      } catch (problem) {
        if (!isCaptchaRiskFailure(problem)) throw problem;
        captcha = await verifyHumanInDialog(dialog.current, "normal", locale);
        const result = await request<{ proof: string }>("/api/security/verify", "POST", { stage: "verify", method, intent, code, captcha, captchaScope: "normal" });
        await onVerified(result.proof, "normal");
      }
    } catch (problem) { setFailure(String(problem)); setCode(""); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="factor-dialog identity-dialog" aria-labelledby="identity-title" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className="factor-dialog-heading"><span className="factor-symbol"><ShieldCheck size={24} /></span><button className="icon-button" aria-label={text("关闭验证窗口", "Close verification")} disabled={busy} onClick={onCancel}><X size={18} /></button></div>
    <div className="section-eyebrow">{actions[intent.action]}</div><h2 id="identity-title">{text("验证当前身份", "Verify your identity")}</h2><p>{text("请选择账号已设置的验证方式，验证后继续本次操作。", "Choose a verification method already linked to your account to continue this action.")}</p>
    <Notice loading={loading} />
    {!loading && !methods.length && <div className="notice-card">{text("此账号暂无可用的验证方式，请联系系统管理员。", "No linked verification method is available. Contact the system administrator.")}</div>}
    {!!methods.length && <form noValidate onSubmit={submit}>
      <label className="auth-label">{text("验证方式", "Verification method")}<RoundedSelect aria-label={text("验证方式", "Verification method")} className="auth-input" value={method} disabled={busy} onChange={(event) => { setMethod(event.target.value as IdentityMethod); setCode(""); setFailure(""); setNotice(""); }}>{methods.map((item) => <option key={item.id} value={item.id}>{labels[item.id]}</option>)}</RoundedSelect></label>
      <div className="identity-destination"><Icon size={18} /><span>{current?.destination ?? (method === "totp" ? text("使用已绑定的Authenticator", "Use your linked Authenticator") : text("使用未使用过的恢复码", "Use an unused recovery code"))}</span></div>
      <label className="auth-label">{method === "recovery" ? text("恢复码", "Recovery code") : text("验证码", "Verification code")}<div className="identity-code-row"><input aria-label={method === "recovery" ? text("恢复码", "Recovery code") : text("验证码", "Verification code")} className="auth-input" inputMode={method === "recovery" ? "text" : "numeric"} autoComplete={method === "recovery" ? "off" : "one-time-code"} maxLength={method === "recovery" ? 12 : 6} value={code} placeholder={method === "recovery" ? "XXXXXXXXXXXX" : text("输入6位验证码", "Enter the six-digit code")} onChange={(event) => setCode(method === "recovery" ? event.target.value.toUpperCase() : event.target.value.replace(/\D/g, ""))} />{deliverable && <button type="button" className="language-button" disabled={busy || cooldown > 0} onClick={() => void send()}>{cooldown ? `${cooldown}s` : text("发送验证码", "Send code")}</button>}</div></label>
      {notice && <div className="notice-card" role="status">{notice}</div>}<Notice error={failure} />
      <button className="send-button auth-submit" disabled={busy || !code.trim()}>{busy ? text("正在验证…", "Verifying…") : text("验证并继续", "Verify and continue")}</button>
    </form>}
    {!methods.length && <Notice error={failure} />}
  </dialog>;
}
