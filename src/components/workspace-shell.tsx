"use client";

import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { BarChart3, FileBarChart, FolderKanban, Languages, LayoutDashboard, LogOut, Settings2, Sparkles, Users, WandSparkles } from "lucide-react";
import { useAppLocale } from "@/lib/locale";
import { useSiteSettings } from "@/components/site-settings";
import WorkspaceControls from "@/components/production/workspace-controls";

const navigation = {
  zh: [["总览", "/dashboard", LayoutDashboard], ["数据空间", "/datasets", FolderKanban], ["AI 分析", "/analysis", WandSparkles], ["图表画布", "/canvas", BarChart3], ["报告中心", "/reports", FileBarChart], ["管理员空间", "/admin", Users]],
  en: [["Overview", "/dashboard", LayoutDashboard], ["Data spaces", "/datasets", FolderKanban], ["AI analysis", "/analysis", WandSparkles], ["Chart canvas", "/canvas", BarChart3], ["Reports", "/reports", FileBarChart], ["Admin space", "/admin", Users]],
} as const;

const pageCopy = {
  zh: { "/settings": ["系统设置", "管理个人偏好、工作空间默认值和 AI 服务连接状态。"], "/dashboard": ["总览", "把校园运营数据，转化成下一步行动。"], "/datasets": ["数据空间", "管理结构化数据与图片证据，保持每个结论都有来源。"], "/analysis": ["AI 分析", "把一个问题交给 Agent，得到可复核的答案，而不是一段无来源的生成文本。"], "/canvas": ["图表画布", "把 AI 推荐的图表组合成可分享、可导出的数据故事。"], "/reports": ["报告中心", "把分析结论整理成团队能审阅、能分享、能继续执行的双语报告。"], "/admin": ["管理员空间", "管理成员、数据资产、AI 使用记录与工作空间安全策略。"] },
  en: { "/settings": ["System settings", "Manage personal preferences, workspace defaults and AI service connections."], "/dashboard": ["Overview", "Turn campus operations data into the next best action."], "/datasets": ["Data spaces", "Manage structured data and image evidence with traceable conclusions."], "/analysis": ["AI analysis", "Give an operational question to the Agent and receive an auditable answer."], "/canvas": ["Chart canvas", "Compose AI-recommended charts into a shareable data story."], "/reports": ["Reports", "Turn analysis into bilingual deliverables your team can review and act on."], "/admin": ["Admin space", "Manage members, data assets, AI usage and workspace security policies."] },
} as const;

type SessionUser = { name?: string | null; email?: string | null };
type AuthState = "loading" | "authenticated" | "unauthenticated";

export function WorkspaceShell({ active, title, subtitle, children, production = false }: { active: string; title: string; subtitle: string; children: ReactNode; production?: boolean }) {
  const site = useSiteSettings();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [locale, setLocale] = useAppLocale();

  useEffect(() => {
    let alive = true;
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
        const data = await response.json();
        if (!alive) return;
        setUser(data?.user ?? null);
        setAuthState(data?.user ? "authenticated" : "unauthenticated");
      } catch {
        if (alive) {
          setUser(null);
          setAuthState("unauthenticated");
        }
      }
    }
    void loadSession();
    return () => { alive = false; };
  }, []);

  const displayName = user?.name || user?.email?.split("@")[0] || "郑宇豪";
  const copy = pageCopy[locale][active as keyof typeof pageCopy.zh] ?? [title, subtitle];
  const items = navigation[locale];
  const authAction = authState === "loading"
    ? <span className="language-button auth-loading" aria-live="polite">{locale === "zh" ? "同步中…" : "Syncing…"}</span>
    : user
      ? <button className="language-button" onClick={() => void signOut({ callbackUrl: "/" })}><LogOut size={13} />{locale === "zh" ? "退出登录" : "Sign out"}</button>
      : <a href={`/login?callbackUrl=${encodeURIComponent(active)}`} className="language-button">{locale === "zh" ? "切换账号" : "Switch account"}</a>;

  return <main className={production ? "app-shell production-workspace" : "app-shell"}><aside className="sidebar"><a href="/" className="brand" aria-label={locale === "zh" ? "CampusPulse产品首页" : "CampusPulse product home"}><div className="brand-mark"><Sparkles size={18} /></div><div className="brand-copy"><div className="brand-title">{site.name}</div><div className="brand-subtitle">Campus intelligence</div></div></a><div className="nav-label">{locale === "zh" ? "工作空间" : "Workspace"}</div><nav className="nav-list">{items.map(([label, href, Icon]) => <a key={href} href={href} aria-label={label} title={label} className={`nav-item ${active === href ? "active" : ""}`}><Icon size={18} aria-hidden="true" /><span>{label}</span></a>)}</nav><div className="sidebar-foot"><a href="/settings" className="user-chip"><div className="avatar">{displayName.slice(0, 1)}</div><div><div className="user-name">{displayName}</div><div className="user-role">{locale === "zh" ? "校园数据工作空间" : "Campus data workspace"}</div></div><Settings2 size={14} color="#7890a4" style={{ marginLeft: "auto" }} /></a><a href="/admin" className={`sidebar-admin ${active === "/admin" ? "active" : ""}`}><Users size={13} /> {locale === "zh" ? "管理员空间" : "Admin space"}</a></div></aside><section className="main-area"><div className="content">{site.announcement && <div className="site-announcement" role="status">{site.announcement}</div>}<header className="topbar"><div><div className="eyebrow">{new Date().toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long" }) + (locale === "zh" ? " · 社团运营空间" : " · Club operations space")}</div><h1>{copy[0]}</h1><div className="intro">{copy[1]}</div></div><div className="top-actions"><a href="/" className="language-button">{locale === "zh" ? "产品首页" : "Product home"}</a>{authAction}<button className="language-button" onClick={() => setLocale(locale === "zh" ? "en" : "zh")}><Languages size={14} />{locale === "zh" ? "EN" : "中"}</button></div></header><WorkspaceControls/>{children}</div></section></main>;
}
