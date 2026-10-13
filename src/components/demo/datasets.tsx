"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Database, FileImage, FileSpreadsheet, Plus, RefreshCw, Upload } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { useAppLocale } from "@/lib/locale";
import type { DemoDataset } from "@/lib/demo-data";

type DatasetRecord = DemoDataset & { aiSummary?: string; ocr?: { text: string; confidence: number | null; fields: string[]; model?: string; status?: string }; evidence?: string[]; persistence?: string };
const storageKey = "campuspulse.uploaded-datasets.v1";

export default function DatasetsPage() {
  const [locale] = useAppLocale();
  const isEn = locale === "en";
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(isEn ? "Loading data space…" : "正在加载数据空间…");

  useEffect(() => {
    let alive = true;
    Promise.all([fetch("/api/datasets", { cache: "no-store" }).then((response) => response.json()), Promise.resolve(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as DatasetRecord[])])
      .then(([remote, local]) => { if (!alive) return; const remoteDatasets = (remote.datasets ?? []) as DatasetRecord[]; const ids = new Set(remoteDatasets.map((item) => item.id)); setDatasets([...remoteDatasets, ...local.filter((item) => !ids.has(item.id))]); setMessage(""); })
      .catch(() => { if (alive) setMessage(isEn ? "Could not load the data space. Try again." : "数据空间加载失败，请重试。"); });
    return () => { alive = false; };
  }, [isEn]);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true); setMessage(isEn ? `Running OCR, field extraction and persistence for ${files.length} file${files.length === 1 ? "" : "s"}…` : `正在执行 OCR、字段识别和入库，共 ${files.length} 个文件…`);
    const created: DatasetRecord[] = [];
    for (const file of files) {
      try {
        const formData = new FormData(); formData.append("file", file);
        const previewResponse = await fetch("/api/data/preview", { method: "POST", body: formData });
        const preview = await previewResponse.json();
        if (!previewResponse.ok) throw new Error(preview.error ?? "文件识别失败");
        const sourceType = preview.sourceType === "IMAGE" ? "IMAGE" : preview.sourceType === "EXCEL" ? "EXCEL" : "CSV";
        const healthScore = preview.healthScore ?? (typeof preview.ocr?.confidence === "number" ? Math.round(preview.ocr.confidence * 100) : 0);
        const datasetResponse = await fetch("/api/datasets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, description: preview.aiSummary ?? preview.ocr?.text ?? "AI 已建立文件识别任务和证据记录。", sourceType, status: preview.status, rowCount: preview.rowCount ?? 0, columnCount: preview.columnCount ?? 0, healthScore, evidenceContent: preview.ocr ? { ocr: preview.ocr, evidence: preview.evidence } : { preview: preview.preview, dataDictionary: preview.dataDictionary, qualityIssues: preview.qualityIssues, aiSummary: preview.aiSummary } }) });
        const persisted = await datasetResponse.json().catch(() => ({}));
        const dataset = (persisted.dataset ?? {}) as Partial<DatasetRecord>;
        created.push({ id: dataset.id ?? `upload-${Date.now()}-${file.name}`, name: file.name, description: preview.aiSummary ?? preview.ocr?.text ?? "AI 已建立文件识别任务和证据记录。", sourceType, status: preview.status ?? "READY", rowCount: preview.rowCount ?? 0, columnCount: preview.columnCount ?? 0, healthScore, updatedAt: new Date().toISOString(), aiSummary: preview.aiSummary, ocr: preview.ocr, evidence: preview.evidence, persistence: persisted.persistence ?? "client-fallback" });
      } catch (error) { setMessage(error instanceof Error ? `${file.name}: ${error.message}` : (isEn ? `${file.name}: processing failed` : `${file.name}：处理失败`)); }
    }
    if (created.length) { const local = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as DatasetRecord[]; const merged = [...created, ...local].slice(0, 20); localStorage.setItem(storageKey, JSON.stringify(merged)); setDatasets((current) => [...created, ...current.filter((item) => !created.some((newItem) => newItem.id === item.id))]); setMessage(isEn ? `${created.length} file${created.length === 1 ? "" : "s"} processed by AI and added to the data space.` : `已完成 ${created.length} 个文件的 AI 识别并加入数据空间。`); }
    setUploading(false); event.target.value = "";
  }

  return <WorkspaceShell active="/datasets" title="数据空间" subtitle="管理结构化数据与图片证据，保持每个结论都有来源。"><div className="page-toolbar"><div><div className="section-eyebrow">DATA OPERATIONS</div><h2 className="page-heading">{isEn ? "Your data assets" : "你的数据资产"}</h2><p className="page-muted">{isEn ? `${datasets.length} datasets · CSV, Excel, images and screenshots` : `共 ${datasets.length} 个数据集 · 支持 CSV、Excel、图片和截图`}</p></div><label className="send-button"><Upload size={14} /> {uploading ? (isEn ? "Processing…" : "处理中…") : (isEn ? "Import data" : "导入数据")}<input hidden type="file" multiple accept=".csv,.xlsx,.xls,image/*" onChange={handleFiles} /></label></div>{message && <div className="notice-card">{message}</div>}<div className="dataset-grid">{datasets.map((dataset) => <a href={`/datasets/${dataset.id}`} className="dataset-card" key={dataset.id}><div className="dataset-card-top"><div className="dataset-type">{dataset.sourceType === "IMAGE" ? <FileImage size={16} /> : <FileSpreadsheet size={16} />}</div><span className={`status-badge ${dataset.status.toLowerCase()}`}>{dataset.status}</span></div><h3 title={dataset.name}>{dataset.name}</h3><p>{dataset.description}</p>{dataset.aiSummary && <div className="dataset-ai-summary">AI: {dataset.aiSummary}</div>}{dataset.ocr && <div className="dataset-ai-summary">OCR {typeof dataset.ocr.confidence === "number" ? `${Math.round(dataset.ocr.confidence * 100)}%` : (isEn ? "Processing" : "处理中")} · {dataset.ocr.fields.length ? dataset.ocr.fields.join(isEn ? ", " : "、") : (isEn ? "Waiting for vision fields" : "等待视觉模型确认字段")}<div className="ocr-model">{isEn ? "Model" : "模型"}: {dataset.ocr.model ?? "Carbon AI"}</div></div>}<div className="dataset-meta"><span>{dataset.rowCount || "—"} rows</span><span>{dataset.columnCount || "—"} columns</span><span>{dataset.healthScore}% health</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${dataset.healthScore}%` }} /></div></a>)}<label className="dataset-card add-card"><Plus size={20} /><strong>{isEn ? "Import a new dataset" : "导入新的数据集"}</strong><span>{isEn ? "Create an evidence space for the Agent" : "创建一个可被 Agent 使用的证据空间"}</span><input hidden type="file" multiple accept=".csv,.xlsx,.xls,image/*" onChange={handleFiles} /></label></div><div className="panel panel-pad dataset-note"><Database size={18} color="#73d8cb" /><div><strong>{isEn ? "Data processing" : "数据处理说明"}</strong><p>{isEn ? "Tables receive profiling, quality checks and AI summaries. Images call CARBON_AI_MODEL for OCR and visual field extraction; missing model results remain processing." : "表格会先完成字段画像、质量评估和 AI 摘要；图片会调用 CARBON_AI_MODEL 执行 OCR 与视觉字段抽取，未返回结果时保持处理中，不显示虚构识别内容。"}</p></div><button className="panel-link" onClick={() => window.location.reload()}><RefreshCw size={13} /> {isEn ? "Refresh" : "刷新"}</button></div></WorkspaceShell>;
}
