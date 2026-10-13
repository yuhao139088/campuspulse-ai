"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ChangeEvent } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, ArrowUpRight, BarChart3, ChevronRight, HelpCircle, Database, FileBarChart, FileImage, FileSpreadsheet, FolderKanban, Gauge, Languages, LayoutDashboard, Lightbulb, Settings2, Sparkles, Target, Upload, Users, WandSparkles } from "lucide-react";
import { useAppLocale } from "@/lib/locale";

const ActivityChart = dynamic(() => import("@/components/activity-chart"), { ssr: false });
type UploadItem = { name: string; status: string };
type AnalysisResult = { mode?: string; status?: string; answer?: string; tools?: string[]; evidence?: string[]; metrics?: { conversion: number }; anomalies?: { reason: string; value: number }[]; actionPlan?: string[]; confidence?: number };

const copy = {
  zh: { nav: ["总览", "数据空间", "AI 分析", "图表画布", "报告中心", "管理员空间"], workspace: "工作空间", greeting: "早上好，郑宇豪", intro: "把校园运营数据，转化成下一步行动。", date: "2026年10月 · 社团运营空间", upload: "导入数据", metrics: ["活跃数据集", "本月分析次数", "发现的洞察", "数据健康度"], metricFoot: ["较上月 +2", "较上月 +18%", "较上月 +9", "较上月 +6.4%"], trend: "近 6 个月活动参与趋势", trendNote: "AI 已完成趋势归因", agentLabel: "AI DECISION AGENT", agentTitle: "今天想知道什么？", agentCopy: "从数据中发现趋势、解释异常，并给出可以马上执行的校园运营建议。", placeholder: "例如：为什么十月到场率下降了？", ask: "开始分析", ready: "Agent 在线 · 已连接数据空间", activity: "最近活动", viewAll: "查看全部", issues: "值得关注", issuesNote: "AI 发现 3 个信号", datasets: "数据集状态", dataNote: "4 个数据集正在工作空间中", importTitle: "快速导入", importCopy: "支持 CSV、Excel、图片和截图", drop: "拖拽文件到这里，或点击选择", dropHint: "单个文件不超过 20MB", report: "生成运营报告", reportCopy: "用自然语言生成双语月报", footer: "CampusPulse AI · 为校园组织构建的智能决策层" },
  en: { nav: ["Overview", "Data spaces", "AI analysis", "Chart canvas", "Reports", "Admin space"], workspace: "Workspace", greeting: "Good morning, Yuhao", intro: "Turn campus operations data into the next best action.", date: "October 2026 · Club operations space", upload: "Import data", metrics: ["Active datasets", "Analyses this month", "Insights found", "Data health"], metricFoot: ["+2 vs last month", "+18% vs last month", "+9 vs last month", "+6.4% vs last month"], trend: "Participation trend · last 6 months", trendNote: "AI attribution complete", agentLabel: "AI DECISION AGENT", agentTitle: "What do you want to know?", agentCopy: "Find trends, explain anomalies, and turn campus data into actions your team can execute today.", placeholder: "e.g. Why did attendance drop in October?", ask: "Analyze", ready: "Agent online · data space connected", activity: "Recent activity", viewAll: "View all", issues: "Worth your attention", issuesNote: "AI found 3 signals", datasets: "Dataset status", dataNote: "4 datasets in this workspace", importTitle: "Quick import", importCopy: "CSV, Excel, images and screenshots", drop: "Drop files here, or click to browse", dropHint: "Maximum 20MB per file", report: "Generate operations report", reportCopy: "Create a bilingual monthly report with natural language", footer: "CampusPulse AI · An intelligent decision layer for campus organizations" },
} as const;
const navIcons = [LayoutDashboard, FolderKanban, WandSparkles, BarChart3, FileBarChart, Users];
const activities = [
  { icon: FileSpreadsheet, title: "社团活动报名数据", meta: "刚刚 · AI 已完成字段识别", badge: "READY" },
  { icon: FileImage, title: "十月招新海报与签到截图", meta: "12 分钟前 · 已提取 8 条证据", badge: "IMAGE" },
  { icon: FileBarChart, title: "新生社团招新复盘报告", meta: "昨天 · 郑宇豪编辑过", badge: "REPORT" },
];
const issues = [
  { title: "周三活动到场率下降 22%", copy: "可能与课程冲突和提醒触达率有关" },
  { title: "摄影社预算支出偏高", copy: "本月物料成本高于同类活动均值 31%" },
  { title: "问卷中出现 14 条低满意度反馈", copy: "AI 建议优先查看场地与签到流程" },
];

export default function Home() {
  const router = useRouter();
  const [locale, setLocale] = useAppLocale();
  const [activeNav, setActiveNav] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const t = copy[locale];
  const metrics = useMemo(() => [{ icon: Database, value: "12" }, { icon: Activity, value: "86" }, { icon: Lightbulb, value: "24" }, { icon: Gauge, value: "94.8%" }], []);

  const startAnalysis = async () => {
    if (!prompt.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisError("");
    try {
      const response = await fetch("/api/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, locale }) });
      const payload = await response.json() as AnalysisResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Analysis failed");
      setAnalysisResult(payload);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = locale === "zh" ? `${hour < 6 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好"}，郑宇豪` : `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, Yuhao`;

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setIsUploading(true);
    setUploadedFiles((current) => [...files.map((file) => ({ name: file.name, status: "PROCESSING" })), ...current].slice(0, 4));
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const response = await fetch("/api/data/preview", { method: "POST", body: formData });
        const payload = await response.json() as { status?: string; error?: string };
        setUploadedFiles((current) => current.map((item) => item.name === file.name ? { name: item.name, status: response.ok ? payload.status ?? "READY" : "ERROR" } : item));
      } catch {
        setUploadedFiles((current) => current.map((item) => item.name === file.name ? { name: item.name, status: "ERROR" } : item));
      }
    }
    setIsUploading(false);
    event.target.value = "";
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <a href="/" className="brand"><div className="brand-mark"><Sparkles size={18} /></div><div><div className="brand-title">CampusPulse AI</div><div className="brand-subtitle">Campus intelligence</div></div></a>
      <div className="nav-label">{t.workspace}</div>
      <nav className="nav-list">{t.nav.map((label, index) => { const Icon = navIcons[index]; const routes = ["/dashboard", "/datasets", "/analysis", "/canvas", "/reports", "/admin"]; return <button key={label} className={`nav-item ${activeNav === index ? "active" : ""}`} onClick={() => { setActiveNav(index); router.push(routes[index]); }}><Icon size={15} />{label}{activeNav === index && <ChevronRight size={13} style={{ marginLeft: "auto" }} />}</button>; })}</nav>
      <div className="sidebar-foot"><a href="/settings" className="user-chip"><div className="avatar">郑</div><div><div className="user-name">{locale === "zh" ? "郑宇豪" : "Yuhao Zheng"}</div><div className="user-role">Club workspace owner</div></div><Settings2 size={14} color="#7890a4" style={{ marginLeft: "auto" }} /></a><a href="/admin" className="sidebar-admin"><Users size={13} /> {locale === "zh" ? "管理员空间" : "Admin space"}</a><button className="sidebar-logout" onClick={() => void signOut({ callbackUrl: "/" })}><span>{locale === "zh" ? "退出登录" : "Sign out"}</span><ArrowUpRight size={12} /></button></div>
    </aside>
    <section className="main-area"><div className="content">
      <header className="topbar animate__animated animate__fadeInDown"><div><div className="eyebrow">{t.date}</div><h1>{greeting}</h1><div className="intro">{t.intro}</div></div><div className="top-actions"><button className="icon-button" aria-label="Help" title="使用帮助" onClick={() => setHelpOpen(true)}><HelpCircle size={15} /></button><button className="icon-button" aria-label="Team" title="团队空间" onClick={() => setTeamOpen(true)}><Users size={15} /></button><button className="language-button" onClick={() => setLocale(locale === "zh" ? "en" : "zh")}><Languages size={14} />{locale === "zh" ? "EN" : "中"}</button></div></header>
      <div className="grid grid-4">{metrics.map((metric, index) => { const Icon = metric.icon; return <div className="panel panel-pad metric animate__animated animate__fadeInUp" style={{ animationDelay: `${index * 0.06}s` }} key={t.metrics[index]}><div className="metric-top"><span className="metric-label">{t.metrics[index]}</span><div className="metric-icon"><Icon size={15} /></div></div><div className="metric-value">{metric.value}</div><div className="metric-foot"><ArrowUpRight size={12} style={{ verticalAlign: "-2px" }} /> {t.metricFoot[index]}</div></div>; })}</div>
      <div className="grid grid-main" style={{ marginTop: 16 }}><div className="panel panel-pad animate__animated animate__fadeInUp" style={{ animationDelay: ".18s" }}><div className="section-heading"><div><div className="section-title">{t.trend}</div><div className="section-note" style={{ marginTop: 4 }}>{t.trendNote}</div></div><button className="panel-link" onClick={() => { router.push("/canvas"); }}>{t.viewAll} <ArrowUpRight size={12} style={{ verticalAlign: "-2px" }} /></button></div><div className="chart-wrap"><ActivityChart /></div></div>
        <div className="panel panel-pad agent-panel animate__animated animate__fadeInRight" style={{ animationDelay: ".18s" }}><div className="agent-kicker"><WandSparkles size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />{t.agentLabel}</div><div className="agent-title">{isAnalyzing ? (locale === "zh" ? "正在为你拆解这个问题" : "Breaking this question down") : t.agentTitle}</div><div className="agent-copy">{isAnalyzing ? (locale === "zh" ? "Agent 正在检查报名、签到和问卷数据，并准备一份带证据的解释。" : "The Agent is checking registrations, attendance and survey evidence.") : t.agentCopy}</div><div className="agent-prompt"><input value={prompt} onChange={(event) => { setPrompt(event.target.value); setAnalysisResult(null); }} placeholder={t.placeholder} onKeyDown={(event) => { if (event.key === "Enter") void startAnalysis(); }} /><button className="send-button" onClick={() => void startAnalysis()} disabled={isAnalyzing}>{isAnalyzing ? "•••" : t.ask}</button></div><div className="status-strip"><span className="status-dot" />{isAnalyzing ? (locale === "zh" ? "正在调用分析工具" : "Calling analysis tools") : analysisError || t.ready}</div>{analysisResult && <div className="agent-result animate__animated animate__fadeInUp"><div className="result-answer">{analysisResult.answer}</div>{analysisResult.metrics && <div className="result-metrics"><span>{locale === "zh" ? "签到转化" : "Conversion"}<strong>{analysisResult.metrics.conversion}%</strong></span><span>{locale === "zh" ? "置信度" : "Confidence"}<strong>{Math.round((analysisResult.confidence ?? 0) * 100)}%</strong></span></div>}<div className="result-tags">{(analysisResult.tools ?? []).slice(0, 4).map((tool) => <span key={tool}>{tool}</span>)}</div></div>}</div></div>
      <div className="grid grid-3" style={{ marginTop: 16 }}><div className="panel panel-pad animate__animated animate__fadeInUp" style={{ animationDelay: ".22s" }}><div className="section-heading"><div className="section-title">{t.activity}</div><button className="panel-link" onClick={() => { router.push("/datasets"); }}>{t.viewAll}</button></div><div className="activity-list">{activities.map((item, index) => { const Icon = item.icon; return <div className="activity" key={item.title}><div className="activity-icon"><Icon size={15} /></div><div><div className="activity-title">{locale === "en" ? ["Club event registration data", "October recruitment poster & check-in", "Freshman club recruitment report"][index] : item.title}</div><div className="activity-meta">{item.meta}</div></div><span className="badge" style={{ marginLeft: "auto" }}>{item.badge}</span></div>; })}</div></div><div className="panel panel-pad animate__animated animate__fadeInUp" style={{ animationDelay: ".28s" }}><div className="section-heading"><div><div className="section-title">{t.datasets}</div><div className="section-note" style={{ marginTop: 4 }}>{t.dataNote}</div></div><Database size={16} color="#73d8cb" /></div>{[["报名数据",100],["活动签到",92],["满意度问卷",86],["预算明细",76]].map(([label, value]) => <div key={label as string}><div className="progress-row"><span>{locale === "en" ? ["Registration", "Attendance", "Satisfaction", "Budget detail"][["报名数据","活动签到","满意度问卷","预算明细"].indexOf(label as string)] : label}</span><span>{value}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${value}%` }} /></div></div>)}</div><div className="panel panel-pad animate__animated animate__fadeInUp" style={{ animationDelay: ".34s" }}><div className="section-heading"><div><div className="section-title">{t.issues}</div><div className="section-note" style={{ marginTop: 4 }}>{t.issuesNote}</div></div><AlertTriangle size={16} color="#ffb36b" /></div><div>{issues.map((issue) => <div className="issue" key={issue.title}><div className="issue-badge"><Target size={13} /></div><div><div className="issue-title">{issue.title}</div><div className="issue-copy">{issue.copy}</div></div></div>)}</div></div></div>
      <div id="quick-import" className="grid grid-main" style={{ marginTop: 16 }}><div className="panel panel-pad animate__animated animate__fadeInUp" style={{ animationDelay: ".38s" }}><div className="section-heading"><div><div className="section-title">{t.importTitle}</div><div className="section-note" style={{ marginTop: 4 }}>{t.importCopy}</div></div><Upload size={16} color="#73d8cb" /></div><label className="file-drop"><input type="file" multiple accept=".csv,.xlsx,.xls,image/*" hidden onChange={handleFiles} /><Upload size={19} color="#4de1d4" /><strong>{t.drop}</strong><span>{isUploading ? (locale === "zh" ? "正在识别文件…" : "Processing files…") : t.dropHint}</span></label>{uploadedFiles.length > 0 && <div style={{ marginTop: 14, display: "grid", gap: 6 }}>{uploadedFiles.map((file, index) => <div key={`${file.name}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#b7cad8", fontSize: 11 }}><FileSpreadsheet size={13} color="#78d8c8" />{file.name}<span className="badge" style={{ marginLeft: "auto" }}>{file.status}</span></div>)}</div>}</div><div className="panel panel-pad animate__animated animate__fadeInUp" style={{ animationDelay: ".42s", display: "flex", flexDirection: "column", justifyContent: "space-between" }}><div><div className="section-title">{t.report}</div><div className="section-note" style={{ marginTop: 7, lineHeight: 1.6 }}>{t.reportCopy}</div></div><button className="send-button" style={{ alignSelf: "flex-start", marginTop: 20 }} onClick={() => { router.push("/reports"); }}><FileBarChart size={14} /> {locale === "zh" ? "开始生成" : "Generate now"}</button></div></div>
      <div className="footer-note">{t.footer} · v0.1 foundation</div>
    </div></section>
      {helpOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="使用帮助"><div className="admin-modal"><div className="section-eyebrow">QUICK GUIDE</div><h2>如何使用 CampusPulse</h2><p className="page-muted">先在数据空间导入 CSV、Excel 或图片，再到 AI 分析提问。报告与图表会引用当前数据和工具调用结果。</p><div className="modal-actions"><button className="language-button" onClick={() => setHelpOpen(false)}>关闭</button><button className="send-button" onClick={() => { setHelpOpen(false); router.push("/datasets"); }}>去导入数据</button></div></div></div>}
      {teamOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="团队空间"><div className="admin-modal"><div className="section-eyebrow">TEAM SPACE</div><h2>社团运营团队</h2><div className="team-modal-list"><div><strong>郑宇豪</strong><span>所有者</span></div><div><strong>尤一龙</strong><span>编辑者</span></div><div><strong>高超</strong><span>编辑者</span></div><div><strong>冯玉雷 / 张兴华</strong><span>指导教师</span></div></div><div className="modal-actions"><button className="language-button" onClick={() => setTeamOpen(false)}>关闭</button><button className="send-button" onClick={() => { setTeamOpen(false); router.push("/admin"); }}>管理成员</button></div></div></div>}
  </main>;
}
