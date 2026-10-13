"use client";
import { useState } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { useResource, useText, Notice, Dataset } from "./shared";

export default function DatasetDetail({ id }: { id: string }) {
  const { data, error, loading, refresh } = useResource<{ dataset: Dataset }>("/api/datasets/" + id);
  const { text } = useText();
  const [failure, setFailure] = useState("");
  const dataset = data?.dataset;
  const document = dataset?.evidence?.[0]?.content;
  const rows = document?.rows ?? [];
  const columns = document?.columns ?? [];
  return <WorkspaceShell production active="/datasets" title={dataset?.name ?? ""} subtitle={dataset?.description ?? ""}><Notice error={failure || error} loading={loading}/>{dataset && <><div className="detail-hero panel panel-pad"><div><h2 className="page-heading">{dataset.name}</h2><p className="page-muted">{dataset.description}</p></div><div className="detail-actions"><a className="send-button" href={"/analysis?dataset=" + id}>{text("分析此数据集", "Analyze dataset")}</a><a className="language-button" href={"/api/datasets/" + id + "/download"}>{text("下载原文件", "Download original")}</a></div></div><div className="grid grid-4">{[[text("记录数", "Rows"),dataset.rowCount],[text("字段数", "Columns"),dataset.columnCount],[text("质量评分", "Quality"),(dataset.healthScore ?? 0)+"%"],[text("已删除重复行", "Duplicates removed"),document?.duplicates ?? 0]].map(([label,value]) => <div className="panel panel-pad" key={String(label)}><span className="metric-label">{label}</span><strong className="detail-value">{value}</strong></div>)}</div><section className="panel panel-pad" style={{ marginTop: 20 }}><h3>{text("字段字典与质量检查", "Data dictionary & quality")}</h3>{document?.dictionary?.map((field) => <div className="field-row" key={field.field}><div><strong>{field.field}</strong><small>{field.meaning} · {field.type}</small></div></div>)}<p className="page-muted">{text("缺失值总数：", "Missing cells: ")}{document?.profile?.missingCells ?? 0}</p></section>{document?.ocr && <section className="panel panel-pad" style={{ marginTop: 20 }}><h3>OCR · {document.ocr.model}</h3><p className="page-muted">{document.ocr.method}</p><pre className="source-text">{document.ocr.text}</pre></section>}<section className="panel panel-pad" style={{ marginTop: 20 }}><h3>{text("数据预览（前 100 行）", "Data preview (first 100 rows)")}</h3><div className="data-table-wrap"><table className="data-table"><thead><tr>{columns.map((name) => <th key={name}>{name}</th>)}</tr></thead><tbody>{rows.slice(0,100).map((row,index) => <tr key={index}>{columns.map((name) => <td key={name}>{String(row[name] ?? "—")}</td>)}</tr>)}</tbody></table></div></section><button className="language-button" onClick={() => { void refresh().catch((problem) => setFailure(String(problem))); }}>{text("刷新", "Refresh")}</button></>}</WorkspaceShell>;
}
