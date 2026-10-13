import { describe, expect, it } from "vitest";
import { normalizeAnalysisResult } from "../analysis-result";

describe("model response normalization", () => {
  it("handles missing reasons, alternate descriptions and repeated text without fabricating anomalies", () => {
    const result = normalizeAnalysisResult({
      answer: "Review the budget",
      anomalies: [{ value: 20 }, { description: "Low conversion", value: 12 }, { reason: "Low conversion", value: 9 }, "High cost", null],
      tools: ["inspect_dataset", 42],
      actionPlan: [null, "Review attendance"],
      metrics: { conversion: 0.5 },
      confidence: 1.5,
    });
    expect(result.anomalies.map((item) => item.reason)).toEqual(["Low conversion", "Low conversion", "High cost"]);
    expect(result.tools).toEqual(["inspect_dataset"]);
    expect(result.actionPlan).toEqual(["Review attendance"]);
    expect(result.metrics).toBeUndefined();
    expect(result.confidence).toBe(1);
  });

  it("treats an invalid model payload as empty content", () => {
    expect(normalizeAnalysisResult(null).anomalies).toEqual([]);
    expect(normalizeAnalysisResult({ tools: "query_dataset" }).tools).toEqual([]);
  });
});
