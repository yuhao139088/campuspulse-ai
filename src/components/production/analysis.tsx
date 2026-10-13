"use client";
import { useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { normalizeAnalysisResult, type AnalysisResult } from "@/lib/ai/analysis-result";
import { Dataset, DatasetSelect, request, useResource, useText, Notice } from "./shared";

type StoredAnalysis = { id: string; prompt: string; result: unknown; createdAt: string };
export default function ProductionAnalysis() {
  const { text, locale } = useText();
  const datasets = useResource<{ datasets: Dataset[] }>("/api/datasets");
  const history = useResource<{ analyses: StoredAnalysis[] }>("/api/ai/analyze");
  const [datasetId, setDatasetId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [taskNotice, setTaskNotice] = useState("");
  const [answer, setAnswer] = useState<AnalysisResult | null>(null);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("dataset"); if (id) { const timer = window.setTimeout(() => setDatasetId(id),0); return () => window.clearTimeout(timer); } },[]);
  async function analyze() {
    if (!prompt.trim() || !datasetId || busy) return;
    setBusy(true); setFailure("");
    try { setAnswer(normalizeAnalysisResult(await request("/api/ai/analyze", "POST", { datasetId, prompt, locale }))); await history.refresh(); }
    catch (problem) { setFailure(problem instanceof Error ? problem.message : "Analysis failed"); }
    finally { setBusy(false); }
  }
  return <WorkspaceShell production active="/analysis" title="" subtitle=""><div className="analysis-layout"><section className="panel panel-pad"><div className="section-eyebrow">AGENT WORKSPACE</div><h2 className="page-heading">{text("让 Agent 分析你的真实数据", "Ask the Agent about your data")}</h2><DatasetSelect datasets={datasets.data?.datasets ?? []} value={datasetId} onChange={setDatasetId}/><div className="analysis-input-wrap"><textarea rows={4} value={prompt} placeholder={text("请输入要分析的问题", "Enter an analysis question")} onChange={(event) => setPrompt(event.target.value)}/><button className="send-button" disabled={busy || !datasetId || !prompt.trim()} onClick={() => void analyze()}>{busy ? text("正在执行工具调用…", "Executing tools…") : text("开始分析", "Analyze")}</button></div><Notice error={failure || datasets.error}/></section><aside className="panel panel-pad"><h3>{text("已保存的分析", "Saved analyses")}</h3>{history.data?.analyses.map((item) => <button className="report-list-item" key={item.id} onClick={() => { setPrompt(item.prompt); setAnswer(normalizeAnalysisResult(item.result)); }}>{item.prompt}</button>)}{!history.data?.analyses.length && <p className="page-muted">{text("分析会自动保存到数据库，刷新后可继续查看。", "Analysis history is stored in the database.")}</p>}</aside></div>{answer && <article className="analysis-result analysis-result-wide"><div className="result-header"><h3>{prompt}</h3><span className="status-badge ready">{answer.mode} · {answer.model}</span></div><p className="result-answer large">{answer.answer}</p><div className="analysis-columns"><div><h4>{text("实际执行的工具", "Executed tools")}</h4>{answer.tools.map((tool,index) => <div className="trace-item" key={"tool-"+index}>{tool}</div>)}</div><div><h4>{text("行动建议", "Recommended actions")}</h4>{answer.actionPlan.map((action,index) => <div className="trace-item" key={"action-"+index}><span>{action}</span><button className="language-button" onClick={async () => { try { await request("/api/tasks", "POST", { title: action }); setTaskNotice(text("已保存为行动任务", "Saved as an action task")); } catch (problem) { setFailure(String(problem)); } }}>{text("加入任务", "Save task")}</button></div>)}</div></div>{taskNotice && <div className="notice-card">{taskNotice}</div>}{answer.anomalies.length > 0 && <div className="result-anomalies"><strong>{text("异常", "Anomalies")}</strong>{answer.anomalies.map((item,index) => <span key={index}>{item.reason}</span>)}</div>}<details className="evidence-strip"><summary>{text("查看数据证据与工具输出", "View evidence & tool outputs")}</summary><pre className="source-text">{answer.evidence.join("\n\n")}</pre></details><div className="report-downloads"><a href={"/canvas?dataset="+datasetId} className="language-button">{text("创建图表", "Create chart")}</a><a href={"/reports?dataset="+datasetId} className="language-button">{text("生成报告", "Generate report")}</a></div></article>}</WorkspaceShell>;
}
