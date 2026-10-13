"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { KeyRound, X } from "lucide-react";
import { isCaptchaRiskFailure, verifyHumanInDialog } from "@/lib/captcha-client";
import { useText } from "./production/shared";

export function PasswordDialog({ onSave, onCancel }: { onSave: (password: string, captcha: unknown, captchaScope?: "normal" | "invisible") => Promise<void>; onCancel: () => void }) {
  const { text, locale } = useText();
  const dialog = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8 || new TextEncoder().encode(password).length > 72) { setFailure(text("请输入8位以上、最多72字节的新密码", "Use at least eight characters and at most 72 bytes")); return; }
    if (confirmation !== password) { setFailure(text("两次输入的密码不一致", "The passwords do not match")); return; }
    setBusy(true); setFailure("");
    try {
      let captcha = await verifyHumanInDialog(dialog.current, "invisible", locale);
      try { await onSave(password, captcha, "invisible"); }
      catch (problem) {
        if (!isCaptchaRiskFailure(problem)) throw problem;
        captcha = await verifyHumanInDialog(dialog.current, "normal", locale);
        await onSave(password, captcha, "normal");
      }
    }
    catch (problem) { setFailure(problem instanceof Error ? problem.message : String(problem)); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="factor-dialog password-dialog" aria-labelledby="password-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className="factor-dialog-heading"><span className="factor-symbol"><KeyRound size={24} /></span><button className="icon-button" aria-label={text("关闭密码窗口", "Close password window")} disabled={busy} onClick={onCancel}><X size={18} /></button></div>
    <h2 id="password-dialog-title">{text("设置新密码", "Set a new password")}</h2><p>{text("身份已验证。确认新密码后将完成无感人机验证，并撤销旧登录会话。请在5分钟内完成。", "Identity verified. Confirm your new password within five minutes. Human verification is required, and previous sessions will be revoked.")}</p>
    <form noValidate onSubmit={submit}>
      <label className="auth-label">{text("新密码", "New password")}<input className="auth-input" type="password" autoComplete="new-password" minLength={8} maxLength={72} disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={text("输入新的密码", "Enter a new password")} /></label>
      <label className="auth-label">{text("确认新密码", "Confirm new password")}<input className="auth-input" type="password" autoComplete="new-password" maxLength={72} disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={text("再次输入新的密码", "Enter the new password again")} /></label>
      {failure && <div className="auth-error" role="alert">{failure}</div>}
      <button className="send-button auth-submit" disabled={busy}>{busy ? text("正在更新…", "Updating…") : text("确认更新密码", "Confirm password update")}</button>
    </form>
  </dialog>;
}
