import { describe, expect, it } from "vitest";
import { calculateRatio, createActionPlan, detectAnomalies, inspectDataset } from "@/lib/ai/tools";

describe("CampusPulse agent tools", () => {
  it("profiles columns and missing values", () => {
    const profile = inspectDataset([{ name: "A", count: 3 }, { name: "B", count: null }]);
    expect(profile.columns).toEqual(["name", "count"]);
    expect(profile.missingCells).toBe(1);
  });

  it("detects low or high metric outliers", () => {
    const anomalies = detectAnomalies([{ score: 10 }, { score: 11 }, { score: 10 }, { score: 12 }, { score: 50 }], "score");
    expect(anomalies.some((anomaly) => anomaly.rowIndex === 4)).toBe(true);
  });

  it("keeps an extreme observation visible when a mean and standard deviation would mask it", () => {
    const rows = [{ score: 10 }, { score: 10 }, { score: 10 }, { score: 10 }, { score: 10 }, { score: 10 }, { score: 100 }];
    expect(detectAnomalies(rows, "score").map((anomaly) => anomaly.rowIndex)).toEqual([6]);
  });

  it("creates localized, evidence-bounded action steps for outlier candidates", () => {
    const rows = [{ score: 10 }, { score: 11 }, { score: 10 }, { score: 12 }, { score: 50 }];
    const anomalies = detectAnomalies(rows, "score");
    const plan = createActionPlan(anomalies, "en", "score", rows.length);
    expect(plan[0]).toContain("score");
    expect(plan[0]).toContain("5");
    expect(plan[1]).toContain("units");
    expect(plan.every((item) => !/[\u4e00-\u9fff]/.test(item))).toBe(true);
  });

  it("warns about insufficient sample size instead of implying a reliable anomaly check", () => {
    const plan = createActionPlan([], "en", "score", 2);
    expect(detectAnomalies([{ score: 1 }, { score: 2 }, { score: 3 }, { score: 4 }], "score")).toEqual([]);
    expect(plan[0]).toContain("Only 2 numeric observation(s)");
    expect(plan.join(" ")).toContain("units");
  });

  it("calculates grouped ratios from summed values and excludes zero or invalid denominators", () => {
    const result = calculateRatio([
      { activity: "A", checkedIn: 8, registered: 10 },
      { activity: "A", checkedIn: 9, registered: 10 },
      { activity: "B", checkedIn: 5, registered: 0 },
      { activity: "B", checkedIn: 3, registered: null },
    ], "checkedIn", "registered", "activity");
    expect(result.results).toEqual([
      { group: "A", numerator: 17, denominator: 20, ratioPercent: 85, validRows: 2, excludedRows: 0 },
      { group: "B", numerator: 0, denominator: 0, ratioPercent: null, validRows: 0, excludedRows: 2 },
    ]);
  });

  it("keeps missing, numeric, and text group labels distinct", () => {
    const result = calculateRatio([
      { group: null, numerator: 1, denominator: 2 },
      { group: "(missing)", numerator: 1, denominator: 2 },
      { group: 1, numerator: 1, denominator: 2 },
      { group: "1", numerator: 1, denominator: 2 },
    ], "numerator", "denominator", "group");
    expect(result.results.map((entry) => entry.group)).toEqual(["(missing) [missing]", "(missing) [string]", "1 [number]", "1 [string]"]);
  });
});
