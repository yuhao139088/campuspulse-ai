"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ShieldCheck, KeyRound, X, Copy, Download } from "lucide-react";
import { useAppLocale } from "@/lib/locale";
import { isCaptchaRiskFailure, verifyHumanInDialog } from "@/lib/captcha-client";

export function FactorDialog({ onVerify, onCancel, enrollment = false }: { onVerify: (value: string, captcha?: unknown, captchaScope?: "normal" | "invisible") => Promise<void>; onCancel: () => void; enrollment?: boolean }) {
  const [locale] = useAppLocale();
  const text = (zh: string, en: string) => locale === "zh" ? zh : en;
  const dialog = useRef<HTMLDialogElement>(null);
  const [recovery, setRecovery] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  useEffect(() => { dialog.current?.showModal(); dialog.current?.querySelector<HTMLInputElement>("input")?.focus(); }, []);
  useEffect(() => { dialog.current?.querySelector<HTMLInputElement>("input")?.focus(); }, [recovery]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim() || (!recovery && !/^\d{6}$/.test(value.trim()))) { setFailure(text("请输入6位认证码，或切换到恢复码验证。", "Enter a six-digit authenticator code, or switch to recovery code verification.")); return; }
    setBusy(true); setFailure("");
    try {
      let captcha = await verifyHumanInDialog(dialog.current, "invisible", locale);
      try { await onVerify(value.trim(), captcha, "invisible"); }
      catch (problem) {
        if (!isCaptchaRiskFailure(problem)) throw problem;
        captcha = await verifyHumanInDialog(dialog.current, "normal", locale);
        await onVerify(value.trim(), captcha, "normal");
      }
    } catch (problem) { setFailure(problem instanceof Error ? problem.message : String(problem)); setValue(""); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="factor-dialog" aria-labelledby="factor-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}><div className="factor-dialog-heading"><span className="factor-symbol"><ShieldCheck size={24}/></span><button className="icon-button" aria-label={text("关闭验证窗口", "Close verification")} disabled={busy} onClick={onCancel}><X size={18}/></button></div><h2 id="factor-dialog-title">{enrollment ? text("确认绑定Authenticator", "Confirm Authenticator setup") : text("二次身份验证", "Verify your identity")}</h2><p>{enrollment ? text("请输入刚绑定的Authenticator显示的6位认证码。", "Enter the six-digit code from the Authenticator you just linked.") : text("此账号已开启2FA。验证通过后才能继续。", "This account has 2FA enabled. Complete verification to continue.")}</p>{!enrollment && <div className="factor-methods"><button disabled={busy} className={recovery ? "" : "active"} onClick={() => { setRecovery(false); setValue(""); setFailure(""); }}><ShieldCheck size={16}/>{text("认证器验证码", "Authenticator")}</button><button disabled={busy} className={recovery ? "active" : ""} onClick={() => { setRecovery(true); setValue(""); setFailure(""); }}><KeyRound size={16}/>{text("使用恢复码", "Recovery code")}</button></div>}<form noValidate onSubmit={submit}><label className="auth-label">{recovery ? text("恢复码", "Recovery code") : text("6位认证码", "Six-digit code")}<input autoFocus className={"auth-input factor-code " + (recovery ? "recovery-input" : "")} type="text" inputMode={recovery ? "text" : "numeric"} autoComplete={recovery ? "off" : "one-time-code"} required pattern={recovery ? undefined : "[0-9]{6}"} maxLength={recovery ? 32 : 6} value={value} onChange={(event) => setValue(event.target.value)} placeholder={recovery ? "XXXXXXXXXXXX" : "000000"}/></label><p className="factor-hint">{recovery ? text("每个恢复码只能用一次。", "Each recovery code can be used only once.") : text("认证码每30秒更新，刚使用过的认证码不能重复使用。", "Codes change every 30 seconds. A used code cannot be reused.")}</p>{failure && <div className="auth-error" role="alert">{failure}</div>}<button className="send-button auth-submit" disabled={busy || !value.trim()}>{busy ? text("验证中…", "Verifying…") : text("验证并继续", "Verify and continue")}</button></form></dialog>;
}

export function RecoveryCodesDialog({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const [locale] = useAppLocale();
  const text = (zh: string, en: string) => locale === "zh" ? zh : en;
  const dialog = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="factor-dialog recovery-dialog" aria-labelledby="recovery-dialog-title" onCancel={(event) => { event.preventDefault(); }}><span className="factor-symbol"><KeyRound size={24}/></span><h2 id="recovery-dialog-title">{text("保存你的恢复码", "Save your recovery codes")}</h2><p>{text("这些恢复码只显示一次。无法使用认证器时，可以在验证窗口中选择恢复码登录。", "These codes are shown only once. If your authenticator is unavailable, choose Recovery code in the verification dialog.")}</p><div className="recovery-code-grid">{codes.map((code) => <code key={code}>{code}</code>)}</div><div className="factor-methods"><button onClick={async () => { await navigator.clipboard.writeText(codes.join("\n")); setCopied(true); }}><Copy size={16}/>{copied ? text("已复制", "Copied") : text("复制", "Copy")}</button><button onClick={() => { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([codes.join("\n")], { type: "text/plain" })); link.download = "campuspulse-recovery-codes.txt"; link.click(); URL.revokeObjectURL(link.href); }}><Download size={16}/>{text("下载", "Download")}</button></div><label className="recovery-confirm"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)}/>{text("我已将恢复码保存到安全位置", "I have saved these codes somewhere safe")}</label><button className="send-button auth-submit" disabled={!saved} onClick={onClose}>{text("完成", "Done")}</button></dialog>;
}
