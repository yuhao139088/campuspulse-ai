"use client";
type Result = { ret: number; ticket?: string; randstr?: string };
type Widget = { show: () => void; destroy?: () => void };
declare global { interface Window { TencentCaptcha?: new (appid: string, callback: (result: Result) => void, options?: Record<string, unknown>) => Widget; } }
let sdk: Promise<void> | undefined;
function loadSdk() {
  if (window.TencentCaptcha) return Promise.resolve();
  if (!sdk) sdk = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://turing.captcha.qcloud.com/TCaptcha.js";
    script.async = true;
    const timer = setTimeout(() => { script.remove(); sdk = undefined; reject(new Error("Human verification loading timed out / 人机验证加载超时")); }, 15000);
    script.onload = () => { clearTimeout(timer); if (window.TencentCaptcha) resolve(); else { sdk = undefined; reject(new Error("Tencent verification SDK did not load")); } };
    script.onerror = () => { clearTimeout(timer); script.remove(); sdk = undefined; reject(new Error("Cannot load human verification; check your network / 无法加载人机验证，请检查网络")); };
    document.head.appendChild(script);
  });
  return sdk;
}
export async function verifyHuman(scope: "normal" | "invisible", locale = "zh") {
  const response = await fetch("/api/auth/features", { cache: "no-store" });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "Verification configuration unavailable");
  const config = value.captcha;
  if (!config?.enabled) return undefined;
  if (!config.ready) throw new Error("Human verification is not configured / 人机验证尚未完成配置");
  await loadSdk();
  return new Promise<{ ticket: string; randstr: string }>((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error(locale === "en" ? "Verification expired. Try again." : "验证已超时，请重新开始。")); }, 300000);
    const widget = new window.TencentCaptcha!(String(scope === "normal" ? config.normalAppId : config.invisibleAppId), (result) => {
      clearTimeout(timer);
      if (result.ret === 0 && result.ticket && result.randstr) resolve({ ticket: result.ticket, randstr: result.randstr });
      else reject(new Error(locale === "en" ? "Human verification cancelled or failed. Try again." : "人机验证已取消或未通过，请重试。"));
    }, { userLanguage: locale === "en" ? "en" : "zh-cn" });
    widget.show();
  });
}

export async function verifyHumanInDialog(dialog: HTMLDialogElement | null, scope: "normal" | "invisible", locale = "zh") {
  const restore = !!dialog?.open;
  const page = dialog?.closest<HTMLElement>(".app-shell, .auth-page");
  const wasInert = page?.inert ?? false;
  if (restore) dialog?.close();
  if (restore && page) page.inert = true;
  try { return await verifyHuman(scope, locale); }
  finally {
    if (page) page.inert = wasInert;
    if (restore && dialog?.isConnected && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>("input:not([type='hidden'])")?.focus();
    }
  }
}

export function isCaptchaRiskFailure(problem: unknown) {
  const message = problem instanceof Error ? problem.message : String(problem);
  return message.includes("Human verification did not pass") || message.includes("人机验证未通过");
}
