import { describe, expect, it } from "vitest";
import { chartData, chartMatchesColumns, chartSignature, chartsForDataset, importChartRecommendations, normalizeCanvasCharts, normalizeChartRecommendations, type CanvasChart } from "../../charts";

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
    const first = importChartRecommendations([], recommendations, () => "unique-id", "dataset-1");
    expect(first.added[0]).toEqual({ id: "unique-id", title: chart.title, type: chart.type, category: chart.category, metric: chart.metric, aggregation: chart.aggregation, datasetId: "dataset-1" });
    expect(importChartRecommendations(first.charts, recommendations, () => "unused", "dataset-1").added).toEqual([]);
    expect(importChartRecommendations(first.charts, recommendations, () => "other", "dataset-2").added).toHaveLength(1);
    const full = Array.from({ length: 30 }, (_, index) => ({ ...first.charts[0], id: String(index), category: String(index) }));
    expect(importChartRecommendations(full, recommendations, () => "overflow", "dataset-1").charts).toHaveLength(30);
    expect(chartSignature(first.charts[0])).toBe(chartSignature(recommendations[0]));
  });
  it("aggregates actual rows, skips missing values and sorts chronological line labels", () => {
    const settings = normalizeChartRecommendations([chart], columns, numeric)[0];
    const rows = [{ month: "2026-11", attendees: 10 }, { month: "2026-10", attendees: "6" }, { month: "2026-10", attendees: 4 }, { month: "2026-10", attendees: null }, { month: "2026-10", attendees: "" }];
    expect(chartData(rows, settings)).toEqual({ labels: ["2026-10", "2026-11"], values: [10, 10] });
    expect(chartData(rows, { ...settings, aggregation: "average" }).values).toEqual([5, 10]);
    expect(chartData(rows, { ...settings, aggregation: "count", metric: "" }).values).toEqual([4, 1]);
  });
  it("collapses non-scalar and blank category cells into one neutral label", () => {
    const settings = normalizeChartRecommendations([chart], columns, numeric)[0];
    const rows = [{ month: [{ name: "nested" }], attendees: 3 }, { month: null, attendees: 2 }, { month: "   ", attendees: 1 }];
    expect(chartData(rows, { ...settings, aggregation: "count", metric: "" })).toEqual({ labels: ["—"], values: [3] });
  });
});

describe("canvas charts stay scoped to their own dataset", () => {
  const settings = { title: "月度签到人数", type: "line", category: "month", metric: "checkedIn", aggregation: "sum" } as const;
  const stored: CanvasChart[] = [{ ...settings, id: "chart-1", datasetId: "dataset-1" }, { ...settings, id: "chart-2", type: "bar", category: "班级", metric: "", aggregation: "count", datasetId: "dataset-2" }];
  it("shows only the charts of the active dataset", () => {
    expect(chartsForDataset(stored, "dataset-1").map((item) => item.id)).toEqual(["chart-1"]);
    expect(chartsForDataset(stored, "dataset-2").map((item) => item.id)).toEqual(["chart-2"]);
    expect(chartsForDataset(stored, "")).toEqual([]);
  });
  it("adopts the stored dataset for legacy charts and drops unusable entries", () => {
    const legacy = [stored[0], { id: "", ...settings }, { ...settings, id: "chart-3", title: "  " }, { ...settings, id: "chart-4", metric: "" }, { ...settings, id: "chart-5", datasetId: "dataset-9" }, null, "junk", stored[0]];
    expect(normalizeCanvasCharts(legacy, "dataset-1").map((item) => [item.id, item.datasetId])).toEqual([["chart-1", "dataset-1"], ["chart-5", "dataset-9"]]);
    expect(normalizeCanvasCharts(undefined, "dataset-1")).toEqual([]);
    expect(normalizeCanvasCharts([{ ...settings, id: "chart-6", aggregation: "count", metric: "" }], "")).toEqual([]);
  });
  it("flags charts whose fields no longer exist in the dataset", () => {
    expect(chartMatchesColumns(settings, ["month", "checkedIn"])).toBe(true);
    expect(chartMatchesColumns(settings, ["班级", "序号"])).toBe(false);
    expect(chartMatchesColumns({ ...settings, aggregation: "count", metric: "" }, ["month"])).toBe(true);
    expect(chartMatchesColumns({ ...settings, metric: "missing" }, ["month", "checkedIn"])).toBe(false);
  });
  it("keeps recommendation duplicates separate per dataset", () => {
    const recommendations = normalizeChartRecommendations([chart], columns, numeric);
    const imported = importChartRecommendations(stored, recommendations, () => "new-id", "dataset-2");
    expect(imported.added).toHaveLength(1);
    expect(imported.added[0].datasetId).toBe("dataset-2");
    expect(chartsForDataset(imported.charts, "dataset-1")).toHaveLength(1);
  });
});
