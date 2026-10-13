"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Download, Grid2X2, Maximize2, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { useAppLocale } from "@/lib/locale";

const ActivityChart = dynamic(() => import("@/components/activity-chart"), { ssr: false });
type ChartApi = { getDataURL: (options?: Record<string, unknown>) => string };
const allChartTypes = ["趋势面积图", "报名与签到", "预算效率", "满意度分布"];
const storageKey = "campuspulse.canvas.v1";
const chartLabels: Record<string, [string, string]> = { "趋势面积图": ["趋势面积图", "Trend area"], "报名与签到": ["报名与签到", "Registrations & check-ins"], "预算效率": ["预算效率", "Budget efficiency"], "满意度分布": ["满意度分布", "Satisfaction distribution"] };

export default function CanvasPage() {
  const [locale] = useAppLocale();
  const isEn = locale === "en";
  const [chartType, setChartType] = useState("趋势面积图");
  const [components, setComponents] = useState(["趋势面积图"]);
  const [saved, setSaved] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const chartRef = useRef<ChartApi | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { components?: string[]; chartType?: string } | null;
      const valid = stored?.components?.filter((item) => allChartTypes.includes(item));
      timer = window.setTimeout(() => {
        if (valid?.length) setComponents(valid);
        if (stored?.chartType && allChartTypes.includes(stored.chartType)) setChartType(stored.chartType);
        setSaved(Boolean(stored));
        setHydrated(true);
      }, 0);
    } catch {
      localStorage.removeItem(storageKey);
    }
    return () => { if (timer) window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey, JSON.stringify({ components, chartType, savedAt: new Date().toISOString() }));
    const timer = window.setTimeout(() => setSaved(true), 0);
    return () => window.clearTimeout(timer);
  }, [chartType, components, hydrated]);
  function addChart(type: string) {
    setComponents((current) => current.includes(type) ? current : [...current, type]);
    setChartType(type);
    setSaved(false);
    setShowAdd(false);
  }

  function removeChart(type: string) {
    if (components.length <= 1) return;
    const next = components.filter((item) => item !== type);
    setComponents(next);
    if (chartType === type) setChartType(next[0]);
    setSaved(false);
  }

  function saveCanvas() {
    localStorage.setItem(storageKey, JSON.stringify({ components, chartType, savedAt: new Date().toISOString() }));
    setSaved(true);
  }

  function exportPng() {
    const dataUrl = chartRef.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#08111d" });
    if (!dataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${chartType}.png`;
    anchor.click();
  }

  function chartLabel(type: string) { return chartLabels[type]?.[isEn ? 1 : 0] ?? type; }

  return <WorkspaceShell active="/canvas" title="图表画布" subtitle="把 AI 推荐的图表组合成可分享、可导出的数据故事。"><div className="canvas-toolbar"><div><div className="section-eyebrow">VISUAL ANALYTICS CANVAS</div><h2 className="page-heading">{isEn ? "Let the data speak clearly" : "让数据自己讲清楚"}</h2><p className="page-muted">{isEn ? `${components.length} chart view${components.length === 1 ? "" : "s"} connected; changes are stored in this browser.` : `已接入 ${components.length} 种图表视图；组件可删除，保存后会在此浏览器中保留。`}</p></div><div className="report-actions"><button className="language-button" onClick={saveCanvas}><Save size={14} /> {saved ? (isEn ? "Saved" : "已保存") : (isEn ? "Save canvas" : "保存画布")}</button><button className="language-button" onClick={exportPng}><Download size={14} /> {isEn ? "Export PNG" : "导出 PNG"}</button></div></div><div className={`canvas-layout ${fullscreen ? "canvas-fullscreen" : ""}`}><aside className="panel panel-pad canvas-sidebar"><div className="section-heading"><div className="section-title">{isEn ? "Components" : "组件"}</div><button className="icon-button" onClick={() => setShowAdd((value) => !value)} aria-label={isEn ? "Add chart" : "添加图表"} title={isEn ? "Add chart" : "添加图表"}><Plus size={14} /></button></div>{showAdd && <div className="canvas-add-panel"><strong>{isEn ? "Add chart component" : "添加图表组件"}</strong><span>{isEn ? "Choose a view for this canvas" : "选择一个视图加入当前画布"}</span>{allChartTypes.map((type) => <button className="canvas-add-option" key={type} onClick={() => addChart(type)}><Grid2X2 size={13} />{chartLabel(type)}<small>{components.includes(type) ? (isEn ? "Added" : "已添加") : (isEn ? "Add" : "添加")}</small></button>)}</div>}{components.map((item) => <div className="canvas-item-row" key={item}><button className={`canvas-item ${chartType === item ? "active" : ""}`} onClick={() => { setChartType(item); setSaved(false); }}><Grid2X2 size={14} />{chartLabel(item)}</button><button className="canvas-delete" aria-label={`${isEn ? "Delete " : "删除"}${chartLabel(item)}`} title={`${isEn ? "Delete " : "删除"}${chartLabel(item)}`} disabled={components.length <= 1} onClick={() => removeChart(item)}><Trash2 size={13} /></button></div>)}<div className="canvas-ai"><Sparkles size={15} /><strong>{isEn ? "AI recommendation" : "AI 推荐"}</strong><p>{isEn ? "Compare conversion, budget efficiency and satisfaction instead of relying on a single trend." : "根据当前数据，建议同时查看转化、预算效率和满意度，避免只看单一趋势。"}</p></div></aside><section className="panel panel-pad canvas-board"><div className="board-header"><div><span className="status-badge ready">LIVE DATA</span><h3>{chartLabel(chartType)}</h3></div><button className="icon-button" onClick={() => setFullscreen((value) => !value)} aria-label={fullscreen ? (isEn ? "Exit fullscreen" : "退出全屏") : (isEn ? "View fullscreen" : "全屏查看")}>{fullscreen ? <X size={15} /> : <Maximize2 size={15} />}</button></div><div className="board-chart"><ActivityChart chartType={chartType} onReady={(chart) => { chartRef.current = chart as ChartApi; }} /></div><div className="board-footer"><span>{isEn ? "Source: club operations data · Updated just now" : "来源：社团运营数据 · 更新于刚刚"}</span><span>{isEn ? "AI attribution complete · 91% confidence" : "AI attribution complete · 91% confidence"}</span></div></section></div></WorkspaceShell>;
}
