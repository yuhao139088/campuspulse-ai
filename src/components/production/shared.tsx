"use client";
import { useEffect, useState, useCallback } from "react";
import { RoundedSelect } from "@/components/rounded-select";
import { useAppLocale } from "@/lib/locale";

export function useText() { const [locale] = useAppLocale(); return { locale, text: (zh: string, en: string) => locale === "zh" ? zh : en }; }
export async function request<T>(url: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(url, { method, cache: "no-store", ...(data instanceof FormData ? { body: data } : data === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}
export function useResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!url) { setData(null); setLoading(false); return; }
    setLoading(true); setError("");
    try { setData(await request<T>(url)); } catch (failure) { setError(failure instanceof Error ? failure.message : "Request failed"); }
    finally { setLoading(false); }
  }, [url]);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, [refresh]);
  return { data, error, loading, refresh, setData };
}
export function Notice({ error, loading }: { error?: string; loading?: boolean }) { const { text } = useText(); return error ? <div className="auth-error" role="alert">{error}</div> : loading ? <div className="notice-card">{text("正在加载…", "Loading…")}</div> : null; }
export type Dataset = { id: string; name: string; description?: string; rowCount: number; columnCount: number; healthScore: number | null; sourceType: string; status: string; updatedAt: string; evidence?: { kind: string; content: { rows?: Record<string, unknown>[]; columns?: string[]; dictionary?: { field: string; meaning: string; type: string }[]; ocr?: { text: string; method: string; model: string }; profile?: { missingCells: number; numericColumns: string[] }; duplicates?: number } }[] };
export function DatasetSelect({ datasets, value, onChange }: { datasets: Dataset[]; value: string; onChange: (value: string) => void }) { const { text } = useText(); return <RoundedSelect className="auth-input" aria-label={text("选择数据集", "Select dataset")} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{text("选择数据集", "Select dataset")}</option>{datasets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</RoundedSelect>; }
