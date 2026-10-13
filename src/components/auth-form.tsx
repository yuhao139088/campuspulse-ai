"use client";
import { signIn } from "next-auth/react";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Languages, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useAppLocale } from "@/lib/locale";
import { verifyHuman } from "@/lib/captcha-client";
import { FactorDialog } from "@/components/factor-dialog";
import { useRouter } from "next/navigation";
import { PhoneInput } from "@/components/phone-input";
import { validateAuthFields, type AuthFieldErrors } from "@/lib/auth-validation";
type Features = { passwordLogin: boolean; phoneLogin: boolean; smsEnabled: boolean; smsCountries?: string[]; emailVerification: boolean; registrationEnabled: boolean; site?: { name: string } };
export default function AuthForm({ mode }: { mode: "login" | "register" | "reset" }) {
  const router = useRouter();
  const [locale, setLocale] = useAppLocale();
  const text = (zh: string, en: string) => locale === "en" ? en : zh;
  const [features, setFeatures] = useState<Features | null>(null);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factor, setFactor] = useState<"login" | "reset" | null>(null);
  const [loginProof, setLoginProof] = useState("");
  const [resetProof, setResetProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  useEffect(() => { fetch("/api/auth/features", { cache: "no-store" }).then((response) => response.json()).then((data) => { if (data.error) throw new Error(data.error); setFeatures(data); }).catch((problem) => setFailure(String(problem))); }, []);
  useEffect(() => { if (cooldown <= 0) return; const timer = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const needsCode = mode === "reset" || channel === "sms" || (mode === "register" && !!features?.emailVerification);
  function clearError(field: keyof AuthFieldErrors) { setFieldErrors((previous) => ({ ...previous, [field]: undefined })); }
  function validate(onlyTarget = false) {
    const checked = validateAuthFields({ mode, channel, name, target, password, code, needsCode }, locale);
    const errors = onlyTarget ? checked.target ? { target: checked.target } : {} : checked;
    setFieldErrors(errors);
    if (Object.keys(errors).length) window.setTimeout(() => document.querySelector<HTMLInputElement>(".auth-card [aria-invalid='true']")?.focus(), 0);
    return !Object.keys(errors).length;
  }
  async function send() {
    if (sending || cooldown || !features || !validate(true)) return;
    setSending(true); setFailure("");
    try {
      const captcha = await verifyHuman("normal", locale);
      const response = await fetch("/api/auth/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, target, purpose: mode === "reset" ? "reset_password" : mode, captcha }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCooldown(60); setMessage(text("验证码已发送；登录和找回密码仅向已注册账号发送。", "Code requested. Login and recovery codes are sent only to registered accounts."));
    } catch (problem) { setFailure(String(problem)); } finally { setSending(false); }
  }
  async function finishLogin(totp = "", proof = loginProof, captcha?: unknown, captchaScope: "normal" | "invisible" = "invisible") {
    const param = new URLSearchParams(window.location.search).get("callbackUrl");
    const callbackUrl = param?.startsWith("/") && !param.startsWith("//") ? param : "/dashboard";
    if (totp) {
      const checked = await fetch("/api/auth/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, target, password, code, captcha, captchaScope, factorStage: true, loginProof: proof }) });
      const result = await checked.json();
      if (!checked.ok) throw new Error(result.error);
      proof = result.loginProof ?? "";
    }
    const result = await signIn(channel === "sms" ? "phone-otp" : "credentials", { ...(channel === "sms" ? { phone: target, code } : { email: target, password }), totp, loginProof: proof, redirect: false, callbackUrl });
    if (result?.error || !result?.ok) throw new Error(text("登录验证失败。请检查凭据，或使用新的认证码/未使用恢复码。", "Sign-in verification failed. Check your credentials or use a fresh authenticator or unused recovery code."));
    window.location.href = result.url || callbackUrl;
  }
  async function resetPassword(totp = "", captcha?: unknown, captchaScope: "normal" | "invisible" = "invisible") {
    const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, target, password, code, totp, captchaProof: totp ? resetProof : "", captcha: captcha ?? await verifyHuman("invisible", locale), captchaScope }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    if (result.requires2FA) { setResetProof(result.captchaProof ?? ""); setFactor("reset"); }
    else { setFactor(null); router.push("/login?updated=1"); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !features || !validate()) return;
    setBusy(true); setFailure(""); setMessage("");
    try {
      if (mode === "register") {
        const captcha = await verifyHuman("invisible", locale);
        const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, channel, captcha, ...(channel === "email" ? { email: target } : { phone: target }), password, ...(code ? { code } : {}) }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        router.push("/login?created=1"); return;
      }
      if (mode === "reset") { await resetPassword(); return; }
      const captcha = await verifyHuman("invisible", locale);
      const checked = await fetch("/api/auth/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, target, password, code, captcha }) });
      const result = await checked.json();
      if (!checked.ok) throw new Error(result.error);
      setLoginProof(result.loginProof ?? "");
      if (result.requires2FA) setFactor("login");
      else await finishLogin("", result.loginProof ?? "");
    } catch (problem) { setFailure(String(problem)); } finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card">
    <div className="section-heading"><a className="auth-back" href="/"><ArrowLeft size={14}/>{text("返回首页", "Home")}</a><button className="language-button" onClick={() => setLocale(locale === "zh" ? "en" : "zh")}><Languages size={14}/>{locale === "zh" ? "EN" : "中"}</button></div>
    <a className="brand auth-brand" href="/"><span className="brand-mark"><Sparkles size={18}/></span><strong>{features?.site?.name ?? "CampusPulse AI"}</strong></a>
    <div className="auth-kicker"><ShieldCheck size={14}/> ACCOUNT SECURITY</div>
    <h1>{mode === "register" ? text("创建你的账号", "Create your account") : mode === "reset" ? text("找回密码", "Reset password") : text("进入你的数据空间", "Sign in to your workspace")}</h1>
    <p>{text("验证账号身份，安全地继续你的校园数据工作。", "Verify your identity and continue your campus data work securely.")}</p>
    <div className="auth-methods">
      <button disabled={!features || busy} className={"language-button " + (channel === "email" ? "active" : "")} onClick={() => { setChannel("email"); setTarget(""); setCode(""); setFieldErrors({}); }}>{mode === "login" ? text("密码登录", "Password") : text("邮箱", "Email")}</button>
      <button disabled={!features?.smsEnabled || !features.phoneLogin || busy} className={"language-button " + (channel === "sms" ? "active" : "")} onClick={() => { setChannel("sms"); setTarget(""); setCode(""); setFieldErrors({}); }}>{text("手机验证码", "Phone code")}</button>
    </div>
    {!features && !failure && <div className="auth-feature-loading" role="status">{text("正在加载登录方式…", "Loading sign-in methods…")}</div>}
    {features && !features.smsEnabled && <small className="auth-provider-disabled">{text("手机服务由系统管理员配置后启用。", "Phone verification becomes available after administrator configuration.")}</small>}
    <form noValidate onSubmit={submit}>
      {mode === "register" && <label className="auth-label">{text("姓名", "Name")}<input className="auth-input" autoComplete="name" minLength={2} maxLength={80} required aria-invalid={!!fieldErrors.name || undefined} aria-describedby={fieldErrors.name ? "auth-name-error" : undefined} value={name} onChange={(event) => { setName(event.target.value); clearError("name"); }}/>{fieldErrors.name && <span className="field-error" id="auth-name-error" role="alert">{fieldErrors.name}</span>}</label>}
      <label className="auth-label">{channel === "sms" ? text("手机号", "Phone number") : mode === "login" ? text("邮箱或已绑定手机号", "Email or linked phone") : text("邮箱", "Email")}
        {channel === "sms" ? <PhoneInput value={target} onChange={(value) => { setTarget(value); clearError("target"); }} autoComplete="username" label={text("手机号", "Phone number")} allowedCountries={features?.smsCountries} invalid={!!fieldErrors.target} describedBy={fieldErrors.target ? "auth-target-error" : undefined}/> : <input className="auth-input" type={mode === "login" ? "text" : "email"} autoComplete="username" placeholder="you@example.com" required aria-invalid={!!fieldErrors.target || undefined} aria-describedby={fieldErrors.target ? "auth-target-error" : undefined} value={target} onChange={(event) => { setTarget(event.target.value); clearError("target"); }}/>}
        {fieldErrors.target && <span className="field-error" id="auth-target-error" role="alert">{fieldErrors.target}</span>}
      </label>
      {needsCode && <label className="auth-label">{text("验证码", "Verification code")}<div className="verification-line"><input aria-label={text("验证码", "Verification code")} className="auth-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required aria-invalid={!!fieldErrors.code || undefined} aria-describedby={fieldErrors.code ? "auth-code-error" : undefined} value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "")); clearError("code"); }}/><button type="button" className="language-button" disabled={sending || cooldown > 0 || !target || !features} onClick={() => void send()}>{cooldown > 0 ? cooldown + "s" : sending ? text("发送中…", "Sending…") : text("发送验证码", "Send code")}</button></div>{fieldErrors.code && <span className="field-error" id="auth-code-error" role="alert">{fieldErrors.code}</span>}</label>}
      {(mode !== "login" || channel === "email") && <label className="auth-label">{mode === "reset" ? text("新密码", "New password") : text("密码", "Password")}<input className="auth-input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 8} maxLength={72} required aria-invalid={!!fieldErrors.password || undefined} aria-describedby={fieldErrors.password ? "auth-password-error" : undefined} value={password} onChange={(event) => { setPassword(event.target.value); clearError("password"); }}/>{fieldErrors.password && <span className="field-error" id="auth-password-error" role="alert">{fieldErrors.password}</span>}</label>}
      {failure && <div className="auth-error" role="alert">{failure}</div>}
      {message && <div className="notice-card" role="status">{message}</div>}
      <button className="send-button auth-submit" disabled={busy || !features || (mode === "register" && !features.registrationEnabled)}><LockKeyhole size={14}/>{busy ? text("处理中…", "Processing…") : mode === "register" ? text("创建账号", "Create account") : mode === "reset" ? text("更新密码", "Update password") : text("登录", "Sign in")}</button>
      {mode === "register" && features && !features.registrationEnabled && <p>{text("管理员已暂停公开注册。", "Public registration is currently paused.")}</p>}
    </form>
    <div className="auth-foot"><a href={mode === "login" ? "/register" : "/login"}>{mode === "login" ? text("创建个人账号", "Create an account") : text("返回登录", "Back to sign in")}</a>{mode === "login" && <a href="/reset-password">{text("忘记密码", "Forgot password")}</a>}</div>
    {factor && <FactorDialog onCancel={() => { setFactor(null); setResetProof(""); setLoginProof(""); }} onVerify={async (value, captcha, captchaScope) => { if (factor === "login") await finishLogin(value, loginProof, captcha, captchaScope); else await resetPassword(value, captcha, captchaScope); }}/>} 
  </section></main>;
}
