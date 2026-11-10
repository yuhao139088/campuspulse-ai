import { describe, expect, it } from "vitest";
import { retrieveKnowledge } from "../knowledge";

describe("campus operations knowledge retrieval", () => {
  it("ranks relevant attendance and privacy guidance with traceable provenance", () => {
    const results = retrieveKnowledge("Compare attendance check-in with registration", "en");
    expect(results[0].id).toBe("club-attendance");
    expect(results[0].matchedTerms.length).toBeGreaterThan(0);
    expect(results[0].source).toBe("CampusPulse curated playbook");
    expect(retrieveKnowledge("如何脱敏学生联系方式", "zh")[0].id).toBe("privacy-minimization");
  });

  it("returns no fabricated fallback context for unrelated queries", () => {
    expect(retrieveKnowledge("space telescope launch window", "en")).toEqual([]);
    expect(retrieveKnowledge("   ", "zh")).toEqual([]);
  });

  it("retrieves attendance guidance from English registration synonyms", () => {
    expect(retrieveKnowledge("registration patterns", "en")[0].id).toBe("club-attendance");
  });
});
