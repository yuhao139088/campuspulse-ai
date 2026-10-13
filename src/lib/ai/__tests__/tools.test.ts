import { describe, expect, it } from "vitest";
import { detectAnomalies, inspectDataset } from "@/lib/ai/tools";

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
});
