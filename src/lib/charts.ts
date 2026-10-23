export type ChartSettings = {
  title: string;
  type: "bar" | "line" | "pie";
  category: string;
  metric: string;
  aggregation: "sum" | "average" | "count";
};

export type ChartRecommendation = ChartSettings & { reason: string };
export type CanvasChart = ChartSettings & { id: string; datasetId: string };

export function chartSignature(chart: ChartSettings) {
  return JSON.stringify([chart.type, chart.category, chart.metric, chart.aggregation]);
}

export function normalizeChartRecommendations(value: unknown, columns: string[], numericColumns: string[]): ChartRecommendation[] {
  if (!Array.isArray(value)) return [];
  const signatures = new Set<string>();
  const recommendations: ChartRecommendation[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const input = candidate as Record<string, unknown>;
    if (typeof input.title !== "string" || !input.title.trim() || typeof input.reason !== "string" || !input.reason.trim()) continue;
    if (input.type !== "bar" && input.type !== "line" && input.type !== "pie") continue;
    if (input.aggregation !== "sum" && input.aggregation !== "average" && input.aggregation !== "count") continue;
    if (typeof input.category !== "string" || !columns.includes(input.category)) continue;
    const metric = input.aggregation === "count" ? "" : input.metric;
    if (typeof metric !== "string" || (input.aggregation !== "count" && !numericColumns.includes(metric))) continue;
    const chart: ChartRecommendation = {
      title: input.title.trim().slice(0, 120),
      reason: input.reason.trim().slice(0, 1200),
      type: input.type,
      category: input.category,
      metric,
      aggregation: input.aggregation,
    };
    const signature = chartSignature(chart);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    recommendations.push(chart);
    if (recommendations.length === 5) break;
  }
  return recommendations;
}

export function chartsForDataset(charts: CanvasChart[], datasetId: string) {
  return datasetId ? charts.filter((chart) => chart.datasetId === datasetId) : [];
}

export function chartMatchesColumns(chart: ChartSettings, columns: string[]) {
  if (!columns.includes(chart.category)) return false;
  return chart.aggregation === "count" || chart.metric === "" || columns.includes(chart.metric);
}

export function normalizeCanvasCharts(value: unknown, fallbackDatasetId: string): CanvasChart[] {
  if (!Array.isArray(value)) return [];
  const charts: CanvasChart[] = [];
  const ids = new Set<string>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const input = candidate as Record<string, unknown>;
    if (typeof input.id !== "string" || !input.id.trim() || ids.has(input.id)) continue;
    if (typeof input.title !== "string" || !input.title.trim()) continue;
    if (input.type !== "bar" && input.type !== "line" && input.type !== "pie") continue;
    if (typeof input.category !== "string" || !input.category.trim()) continue;
    if (input.aggregation !== "sum" && input.aggregation !== "average" && input.aggregation !== "count") continue;
    const metric = typeof input.metric === "string" ? input.metric.trim() : "";
    if (input.aggregation !== "count" && !metric) continue;
    const datasetId = typeof input.datasetId === "string" && input.datasetId.trim() ? input.datasetId.trim() : fallbackDatasetId;
    if (!datasetId) continue;
    ids.add(input.id);
    charts.push({ id: input.id.trim(), title: input.title.trim().slice(0, 120), type: input.type, category: input.category.trim(), metric: input.aggregation === "count" ? "" : metric, aggregation: input.aggregation, datasetId });
    if (charts.length === 30) break;
  }
  return charts;
}

export function importChartRecommendations(charts: CanvasChart[], recommendations: ChartRecommendation[], createId: () => string, datasetId: string) {
  const signatures = new Set(chartsForDataset(charts, datasetId).map(chartSignature));
  const added: CanvasChart[] = [];
  for (const recommendation of recommendations) {
    if (charts.length + added.length >= 30) break;
    const signature = chartSignature(recommendation);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    const { title, type, category, metric, aggregation } = recommendation;
    added.push({ id: createId(), title, type, category, metric, aggregation, datasetId });
  }
  return { charts: [...charts, ...added], added };
}

const axisLabel = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" || typeof value === "boolean" ? String(value) : "—");

export function chartData(rows: Record<string, unknown>[], chart: ChartSettings) {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const label = axisLabel(row[chart.category]);
    const raw = row[chart.metric];
    const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
    if (chart.aggregation !== "count" && !Number.isFinite(value)) continue;
    const group = groups.get(label) ?? { sum: 0, count: 0 };
    group.sum += chart.aggregation === "count" ? 1 : value;
    group.count++;
    groups.set(label, group);
  }
  const labels = Array.from(groups.keys());
  if (chart.type === "line") labels.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  return { labels, values: labels.map((label) => {
    const group = groups.get(label)!;
    return chart.aggregation === "average" ? group.sum / group.count : group.sum;
  }) };
}
