export type ChartSettings = {
  title: string;
  type: "bar" | "line" | "pie";
  category: string;
  metric: string;
  aggregation: "sum" | "average" | "count";
};

export type ChartRecommendation = ChartSettings & { reason: string };
export type CanvasChart = ChartSettings & { id: string };

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

export function importChartRecommendations(charts: CanvasChart[], recommendations: ChartRecommendation[], createId: () => string) {
  const signatures = new Set(charts.map(chartSignature));
  const added: CanvasChart[] = [];
  for (const recommendation of recommendations) {
    if (charts.length + added.length >= 30) break;
    const signature = chartSignature(recommendation);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    const { title, type, category, metric, aggregation } = recommendation;
    added.push({ id: createId(), title, type, category, metric, aggregation });
  }
  return { charts: [...charts, ...added], added };
}

export function chartData(rows: Record<string, unknown>[], chart: ChartSettings) {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const label = String(row[chart.category] ?? "—");
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
