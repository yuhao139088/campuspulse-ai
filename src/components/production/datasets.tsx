"use client";
import { useState } from "react";
import { Upload, FileSpreadsheet, FileImage, Trash2 } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Dataset, useResource, request, useText, Notice } from "./shared";

export default function ProductionDatasets() {
  const { data, loading, error, refresh } = useResource<{ datasets: Dataset[] }>("/api/datasets");
  const { text, locale } = useText();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const upload = async (files: FileList | null) => {
    if (!files || busy) return;
    setBusy(true); setFailure(""); let completed = 0;
    for (const file of Array.from(files)) {
      setNotice(text("正在识别并保存：", "Recognizing and saving: ") + file.name);
      try { const form = new FormData(); form.set("file", file); form.set("locale", locale); await request("/api/import", "POST", form); completed++; }
      catch (problem) { setFailure(problem instanceof Error ? problem.message : "Import failed"); }
    }
    setNotice(text("成功保存文件：", "Files saved: ") + completed); setBusy(false); await refresh();
  };
  return <WorkspaceShell production active="/datasets" title="" subtitle=""><div className="page-toolbar"><div><div className="section-eyebrow">DATA OPERATIONS</div><h2 className="page-heading">{text("你的数据资产", "Your data assets")}</h2><p className="page-muted">{text("CSV / Excel / 图片 · 原文件私有存储 · 自动清洗与字段识别", "CSV / Excel / images · Private original files · Cleaning and field extraction")}</p></div><label className="send-button"><Upload size={14}/>{busy ? text("正在处理…", "Processing…") : text("导入数据", "Import data")}<input type="file" hidden disabled={busy} multiple accept=".csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp" onChange={(event) => { void upload(event.target.files); event.target.value = ""; }}/></label></div><Notice error={failure || error} loading={loading}/>{notice && <div className="notice-card" role="status">{notice}</div>}<div className="dataset-grid">{data?.datasets.map((item) => <article className="dataset-card" key={item.id}><div className="dataset-card-top"><div className="dataset-type">{item.sourceType === "IMAGE" ? <FileImage size={18}/> : <FileSpreadsheet size={18}/>}</div><span className="status-badge ready">{item.status}</span></div><a href={"/datasets/" + item.id}><h3 title={item.name}>{item.name}</h3><p>{item.description}</p></a><div className="dataset-meta"><span>{item.rowCount} {text("行", "rows")}</span><span>{item.columnCount} {text("字段", "columns")}</span><span>{item.healthScore ?? 0}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: (item.healthScore ?? 0) + "%" }}/></div><button className="panel-link danger-button" onClick={async () => { if (!confirm(text("删除此数据集及原文件？", "Delete this dataset and original file?"))) return; try { await request("/api/datasets/" + item.id, "DELETE"); await refresh(); } catch (problem) { setFailure(String(problem)); } }}><Trash2 size={13}/>{text("删除", "Delete")}</button></article>)}</div>{!loading && !data?.datasets.length && <div className="panel panel-pad report-empty"><FileSpreadsheet size={32}/><h3>{text("导入第一份数据开始分析", "Import your first dataset")}</h3><p>{text("你的空间当前没有数据；系统不会自动填入演示数据。", "This workspace is empty. Imported files become the evidence for AI analysis.")}</p></div>}</WorkspaceShell>;
}
