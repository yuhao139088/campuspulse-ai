"use client";

import { useEffect, useState } from "react";
import { Download, FileBarChart, FileText, Languages, Plus, Sparkles, X } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { useAppLocale } from "@/lib/locale";

type ReportRecord = { id: string; title: string; type: string; status: "READY" | "DRAFT"; date: string };
const initialReports: ReportRecord[] = [{ id: "demo-monthly-2026-10", title: "社团运营月报 · 2026年10月", type: "运营月报", status: "READY", date: "刚刚" }, { id: "recruitment-review", title: "新生社团招新复盘", type: "活动复盘", status: "READY", date: "昨天" }, { id: "budget-quality", title: "预算与数据质量检查", type: "质量报告", status: "DRAFT", date: "2026-10-08" }];
const reportCopy = { zh: { mine: "我的报告", editable: "个报告 · 可持续编辑", builder: "AI REPORT BUILDER", note: "自动嵌入指标、异常、证据、行动建议和检索知识。", toggle: "English", generate: "生成报告", ready: "准备好生成这份报告了吗？", readyNote: "AI 将基于当前数据空间生成中文版本，并保留证据链。", start: "开始生成", markdown: "下载 Markdown", docx: "下载 DOCX", create: "新建报告", createNote: "先创建草稿，再调用 AI 生成内容", close: "关闭", name: "报告名称", type: "报告类型", cancel: "取消", createDraft: "创建草稿", custom: "校园运营自定义报告", placeholder: "例如：十月招新效果复盘" }, en: { mine: "My reports", editable: "reports · editable", builder: "AI REPORT BUILDER", note: "Metrics, anomalies, evidence, actions and retrieved knowledge are embedded automatically.", toggle: "中文", generate: "Generate report", ready: "Ready to generate this report?", readyNote: "The AI will generate an English version from the current data space and preserve its evidence chain.", start: "Start generation", markdown: "Download Markdown", docx: "Download DOCX", create: "New report", createNote: "Create a draft first, then call the AI", close: "Close", name: "Report name", type: "Report type", cancel: "Cancel", createDraft: "Create draft", custom: "Campus operations custom report", placeholder: "e.g. October recruitment review" } } as const;
const reportNames: Record<string, [string, string]> = { "社团运营月报 · 2026年10月": ["社团运营月报 · 2026年10月", "Club operations monthly · October 2026"], "新生社团招新复盘": ["新生社团招新复盘", "Freshman club recruitment review"], "预算与数据质量检查": ["预算与数据质量检查", "Budget & data quality check"] };
const reportTypes: Record<string, [string, string]> = { "自定义报告": ["自定义报告", "Custom report"], "预算分析": ["预算分析", "Budget analysis"], "数据质量报告": ["数据质量报告", "Data quality report"], "运营月报": ["运营月报", "Operations monthly"], "活动复盘": ["活动复盘", "Event review"], "质量报告": ["质量报告", "Quality report"] };

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRecord[]>(initialReports);
  const [selected, setSelected] = useState<ReportRecord>(initialReports[0]);
  const [markdown, setMarkdown] = useState("");
  const [locale, setLocale] = useAppLocale();
  const t = reportCopy[locale];
  const displayReportName = (title: string) => reportNames[title]?.[locale === "en" ? 1 : 0] ?? title;
  const displayReportType = (type: string) => reportTypes[type]?.[locale === "en" ? 1 : 0] ?? type;
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("自定义报告");

  useEffect(() => { fetch("/api/reports", { cache: "no-store" }).then((response) => response.json()).then((data) => { if (data.reports?.length) setSelected(data.reports[0]); }).catch(() => undefined); }, []);

  async function generate() {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: displayReportName(selected.title), prompt: selected.title, locale }) });
      const data = await response.json();
      setMarkdown(data.markdown || "");
    } finally {
      setLoading(false);
    }
  }

  function createReport() {
    const title = newTitle.trim() || t.custom;
    const report: ReportRecord = { id: `draft-${Date.now()}`, title, type: newType, status: "DRAFT", date: "刚刚" };
    setReports((current) => [report, ...current]);
    setSelected(report);
    setMarkdown("");
    setCreateOpen(false);
  }

  function downloadMarkdown() {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.title}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadDocx() {
    if (!markdown || loading) return;
    const response = await fetch("/api/reports/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: selected.title, prompt: selected.title, locale, markdown, format: "docx" }) });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${selected.title}.docx`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <WorkspaceShell active="/reports" title="报告中心" subtitle="把分析结论整理成团队能审阅、能分享、能继续执行的双语交付物。"><div className="reports-layout"><aside className="panel panel-pad report-list"><div className="section-heading"><div><div className="section-title">{t.mine}</div><div className="section-note">{reports.length} {t.editable}</div></div><button className="icon-button" onClick={() => setCreateOpen(true)} aria-label={t.create} title={t.create}><Plus size={15} /></button></div>{reports.map((report) => <button className={`report-list-item ${selected.id === report.id ? "active" : ""}`} key={report.id} onClick={() => { setSelected(report); setMarkdown(""); }}><FileText size={15} /><span><strong>{displayReportName(report.title)}</strong><small>{displayReportType(report.type)} · {locale === "en" ? ({ "刚刚": "Just now", "昨天": "Yesterday" } as Record<string, string>)[report.date] ?? report.date : report.date}</small></span><span className={`status-badge ${report.status === "DRAFT" ? "processing" : "ready"}`}>{report.status}</span></button>)}</aside><section className="panel panel-pad report-editor"><div className="report-editor-top"><div><div className="section-eyebrow">{t.builder}</div><h2 className="page-heading">{displayReportName(selected.title)}</h2><p className="page-muted">{t.note}</p></div><div className="report-actions"><button className="language-button" onClick={() => setLocale(locale === "zh" ? "en" : "zh")}><Languages size={14} /> {t.toggle}</button><button className="send-button" onClick={() => void generate()} disabled={loading}><Sparkles size={14} /> {loading ? (locale === "zh" ? "生成中…" : "Generating…") : t.generate}</button></div></div>{markdown ? <><div className="markdown-preview"><pre>{markdown}</pre></div><div className="report-downloads"><button className="language-button" onClick={downloadMarkdown}><Download size={14} /> {t.markdown}</button><button className="language-button" onClick={() => void downloadDocx()} disabled={loading}><Download size={14} /> {t.docx}</button></div></> : <div className="report-empty"><FileBarChart size={34} /><h3>{t.ready}</h3><p>{t.readyNote}</p><button className="send-button" onClick={() => void generate()} disabled={loading}><Sparkles size={14} /> {loading ? (locale === "zh" ? "生成中…" : "Generating…") : t.start}</button></div>}</section></div>{createOpen && <div className="modal-backdrop" onClick={() => setCreateOpen(false)}><div className="admin-modal" onClick={(event) => event.stopPropagation()}><div className="section-heading"><div><div className="section-title">{t.create}</div><div className="section-note">{t.createNote}</div></div><button className="icon-button" onClick={() => setCreateOpen(false)} aria-label={t.close}><X size={15} /></button></div><label className="auth-label">{t.name}<input className="auth-input" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={t.placeholder} /></label><label className="auth-label">{t.type}<select className="auth-input" value={newType} onChange={(event) => setNewType(event.target.value)}>{["自定义报告", "运营月报", "活动复盘", "预算分析", "数据质量报告"].map((type) => <option key={type} value={type}>{displayReportType(type)}</option>)}</select></label><div className="modal-actions"><button className="language-button" onClick={() => setCreateOpen(false)}>{t.cancel}</button><button className="send-button" onClick={createReport}><Plus size={14} />{t.createDraft}</button></div></div></div>}</WorkspaceShell>;
}
