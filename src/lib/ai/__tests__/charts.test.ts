import { describe, expect, it } from "vitest";
import { chartData, chartSignature, importChartRecommendations, normalizeChartRecommendations } from "../../charts";

const chart = { title: "Monthly attendance", reason: "Compare attendance over time", type: "line", category: "month", metric: "attendees", aggregation: "sum" };
const columns = ["month", "activity", "attendees", "rating"];
const numeric = ["attendees", "rating"];

describe("importable AI chart recommendations", () => {
  it("rejects invented fields, unsupported types and nonnumeric aggregations", () => {
    expect(normalizeChartRecommendations([
      chart, { ...chart, category: "unknown" }, { ...chart, metric: "activity" },
      { ...chart, type: "scatter" }, { ...chart, aggregation: "median" },
      { ...chart, reason: "" }, null, "raw explanation",
    ], columns, numeric)).toEqual([chart]);
  });
  it("supports row counts without a numeric column and deduplicates by actual configuration", () => {
    const count = { ...chart, category: "activity", metric: "hallucinated", aggregation: "count" };
    const result = normalizeChartRecommendations([chart, { ...chart, title: "Duplicate" }, count], columns, numeric);
    expect(result).toHaveLength(2);
    expect(result[1].metric).toBe("");
    expect(normalizeChartRecommendations([count], ["activity"], [])).toHaveLength(1);
    expect(normalizeChartRecommendations([chart], ["otherDatasetField"], [])).toEqual([]);
  });
  it("imports configurations with fresh IDs and prevents duplicate imports and overflow", () => {
    const recommendations = normalizeChartRecommendations([chart], columns, numeric);
    const first = importChartRecommendations([], recommendations, () => "unique-id");
    expect(first.added[0]).toEqual({ id: "unique-id", title: chart.title, type: chart.type, category: chart.category, metric: chart.metric, aggregation: chart.aggregation });
    expect(importChartRecommendations(first.charts, recommendations, () => "unused").added).toEqual([]);
    const full = Array.from({ length: 30 }, (_, index) => ({ ...first.charts[0], id: String(index), category: String(index) }));
    expect(importChartRecommendations(full, recommendations, () => "overflow").charts).toHaveLength(30);
    expect(chartSignature(first.charts[0])).toBe(chartSignature(recommendations[0]));
  });
  it("aggregates actual rows, skips missing values and sorts chronological line labels", () => {
    const settings = normalizeChartRecommendations([chart], columns, numeric)[0];
    const rows = [{ month: "2026-11", attendees: 10 }, { month: "2026-10", attendees: "6" }, { month: "2026-10", attendees: 4 }, { month: "2026-10", attendees: null }, { month: "2026-10", attendees: "" }];
    expect(chartData(rows, settings)).toEqual({ labels: ["2026-10", "2026-11"], values: [10, 10] });
    expect(chartData(rows, { ...settings, aggregation: "average" }).values).toEqual([5, 10]);
    expect(chartData(rows, { ...settings, aggregation: "count", metric: "" }).values).toEqual([4, 1]);
  });
});
