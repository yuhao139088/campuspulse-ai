"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, FileText, Lightbulb, RotateCcw, Search, Sparkles, Wrench } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { useAppLocale } from "@/lib/locale";
import { normalizeAnalysisResult, type AnalysisResult } from "@/lib/ai/analysis-result";

type Conversation = { id: string; prompt: string; result: AnalysisResult };

const suggestions = [["哪个活动的预算投入产出最低？", "预算投入产出", Search], ["给我一份本月社团运营行动计划", "行动计划", Lightbulb], ["检查数据里有哪些异常值", "异常检测", Wrench]] as const;

export default function AnalysisPage() {
  const [locale] = useAppLocale();
  const isEn = locale === "en";
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (!prompt.trim() || loading) return;
    const submittedPrompt = prompt.trim();
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: submittedPrompt, locale, datasetId: "club-operations" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (isEn ? "Analysis failed" : "分析失败"));
      setHistory((current) => [{ id: crypto.randomUUID(), prompt: submittedPrompt, result: normalizeAnalysisResult(data) }, ...current]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : (isEn ? "Analysis failed" : "分析失败"));
    } finally { setLoading(false); }
  }

  return <WorkspaceShell active="/analysis" title="AI 分析" subtitle="把一个问题交给 Agent，得到可复核的答案，而不是一段无来源的生成文本。"><div className="analysis-layout"><section className="analysis-main panel panel-pad"><div className="section-eyebrow">AGENT WORKSPACE</div><div className="analysis-heading-row"><div><h2 className="page-heading">{isEn ? "Ask a question that changes operations" : "问一个真正影响运营的问题"}</h2><p className="page-muted">{isEn ? "The Agent inspects data, calls tools and retrieves evidence before making a recommendation." : "Agent 会检查数据集、调用分析工具、检索知识并生成带证据的行动建议。"}</p></div>{history.length > 0 && <button className="language-button" onClick={() => setHistory([])}><RotateCcw size={13} /> {isEn ? "Clear session" : "清空会话"}</button>}</div><div className="analysis-input-wrap"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} placeholder={isEn ? "e.g. Which event has the lowest budget return?" : "例如：哪个活动的预算投入产出最低？"} /><button className="send-button" onClick={() => void analyze()} disabled={loading}><Sparkles size={14} /> {loading ? (isEn ? "Analyzing…" : "分析中…") : (isEn ? "Analyze" : "开始分析")}</button></div><div className="suggestion-row">{suggestions.map(([value, label, Icon], index) => <button key={label} onClick={() => setPrompt(isEn ? ["Which event has the lowest budget return?", "Create an action plan for this month", "Check the dataset for anomalies"][index] : value)}><Icon size={13} />{isEn ? ["Budget ROI", "Action plan", "Anomaly detection"][index] : label}</button>)}</div>{error && <div className="auth-error">{error}</div>}{history.length === 0 && <div className="analysis-empty"><Sparkles size={20} /><strong>{isEn ? "Waiting for your first question" : "等待你的第一个问题"}</strong><span>{isEn ? "Ask about budget, anomalies, satisfaction or next actions." : "试试预算、异常、满意度或行动计划问题，Agent 会为每个问题建立独立证据链。"}</span></div>}</section><aside className="analysis-side"><div className="panel panel-pad"><div className="section-heading"><div className="section-title">{isEn ? "Agent status" : "Agent 状态"}</div><span className="status-dot" /></div>{(isEn ? ["Dataset connected", "Column profile complete", "Tool calls traceable", "Evidence chain ready"] : ["数据集已连接", "字段画像完成", "工具调用可追溯", "证据链已生成"]).map((item, index) => <div className="agent-step" key={item}>{index < 2 || history.length > 0 ? <CheckCircle2 size={15} color="#4de1d4" /> : <CircleDashed size={15} color="#7890a4" />}<span>{item}</span></div>)}</div><div className="panel panel-pad analysis-recommendations"><div className="section-title">{isEn ? "Recommended next steps" : "推荐入口"}</div><a href="/canvas" className="recommend-link"><span>{isEn ? "Send the result to canvas" : "把结果放进图表画布"}</span><ArrowRight size={14} /></a><a href="/reports" className="recommend-link"><span>{isEn ? "Generate a bilingual report" : "生成双语运营报告"}</span><ArrowRight size={14} /></a></div></aside></div>{history.length > 0 && <div className="analysis-results-stack">{history.map(({ id, prompt: submittedPrompt, result }) => <article className="analysis-result analysis-result-wide animate__animated animate__fadeInUp" key={id}><div className="result-header"><div><span className="status-badge ready">{result.mode === "live" ? "LIVE AI" : result.mode === "fallback" ? "LOCAL AGENT" : "COMPLETED"}</span><h3>{submittedPrompt}</h3></div><span className="confidence-pill">{isEn ? "Confidence" : "置信度"} {Math.round((result.confidence ?? 0) * 100)}%</span></div>{result.model && <div className="result-source">{isEn ? "Model" : "模型"}：{result.model} · {isEn ? "Query type" : "查询类型"}：{result.queryType ?? "analysis"}</div>}<p className="result-answer large">{result.answer}</p>{result.metrics && <div className="result-metrics large-metrics"><span>{isEn ? "Registrations" : "报名"}<strong>{result.metrics.registration.total}</strong></span><span>{isEn ? "Check-ins" : "签到"}<strong>{result.metrics.attendance.total}</strong></span><span>{isEn ? "Conversion" : "转化"}<strong>{result.metrics.conversion}%</strong></span></div>}<div className="analysis-columns"><div><h4>{isEn ? "Tool trace" : "工具调用链"}</h4>{(result.tools ?? []).map((tool, toolIndex) => <div className="trace-item" key={id + "-tool-" + toolIndex}><CheckCircle2 size={14} />{tool}</div>)}</div><div><h4>{isEn ? "Action plan" : "行动建议"}</h4>{(result.actionPlan ?? []).map((action, actionIndex) => <div className="trace-item" key={id + "-action-" + actionIndex}><ArrowRight size={14} />{action}</div>)}</div></div>{(result.anomalies ?? []).length > 0 && <div className="result-anomalies"><strong>{isEn ? "Detected anomalies" : "检测到的异常"}</strong>{result.anomalies?.map((item, anomalyIndex) => <span key={id + "-anomaly-" + anomalyIndex} title={item.zScore ? "z-score " + item.zScore : undefined}>{item.reason}</span>)}</div>}<div className="evidence-strip"><FileText size={15} /><span>{isEn ? "Evidence" : "证据"}：{(result.evidence ?? []).join(" · ")}</span></div></article>)}</div>}</WorkspaceShell>;
}
