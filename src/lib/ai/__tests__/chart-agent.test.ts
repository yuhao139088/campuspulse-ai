import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ callAI: vi.fn(), findFirst: vi.fn() }));
vi.mock("../../prisma", () => ({ prisma: { dataset: { findFirst: mocks.findFirst } } }));
vi.mock("../../access", () => ({ ApiError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock("../../system-config", () => ({ aiConfig: async () => ({ model: "test-model", timeout: 60 }) }));
vi.mock("../provider", () => ({ callAI: mocks.callAI }));
import { runAgent } from "../agent";

const recommendation = { title: "Ratings by activity", reason: "Compare average satisfaction", category: "activity", metric: "rating", aggregation: "average", type: "bar" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findFirst.mockResolvedValue({ id: "selected-dataset", name: "Ratings", evidence: [{ kind: "TABLE", content: { rows: [{ month: "2026-10", activity: "Workshop", registered: 20, rating: 4 }, { month: "2026-11", activity: "Welcome", registered: 40, rating: 5 }] } }] });
});

describe("chart recommendation Agent", () => {
  it("honors tool fields and aggregation and validates final configurations against scoped data", async () => {
    mocks.callAI.mockResolvedValueOnce({ content: "", tool_calls: [{ id: "tool-1", function: { name: "generate_chart_config", arguments: JSON.stringify(recommendation) } }] })
      .mockResolvedValueOnce({ content: JSON.stringify({ answer: "## Recommendation\n- Compare ratings.", chartRecommendations: [recommendation, { ...recommendation, category: "invented" }] }) });
    const result = await runAgent("authorized-space", "Suggest charts", "en", "selected-dataset", "chart_recommendations");
    expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ spaceId: "authorized-space", id: "selected-dataset" });
    expect(result.chartRecommendations).toEqual([recommendation]);
    expect(result.traces.find((trace) => trace.name === "generate_chart_config")?.result).toEqual({ ...recommendation, datasetId: "selected-dataset" });
    expect(mocks.callAI.mock.calls[1][0].find((message: { role: string }) => message.role === "tool").content).toContain('"aggregation":"average"');
  });
  it("recovers a validated configuration from actual tool results if final JSON omits it", async () => {
    mocks.callAI.mockResolvedValueOnce({ content: "", tool_calls: [{ id: "tool-1", function: { name: "recommend_chart", arguments: JSON.stringify(recommendation) } }] })
      .mockResolvedValueOnce({ content: JSON.stringify({ answer: "## Recommended chart\n- Ratings." }) });
    expect((await runAgent("space", "Charts", "en", "selected-dataset", "chart_recommendations")).chartRecommendations).toEqual([recommendation]);
  });
  it("reports failure when the model only produces invalid configurations", async () => {
    mocks.callAI.mockResolvedValue({ content: JSON.stringify({ answer: "Chart", chartRecommendations: [{ ...recommendation, metric: "missing" }] }) });
    await expect(runAgent("space", "Charts", "en", "selected-dataset", "chart_recommendations")).rejects.toThrow("AI did not return valid chart recommendations");
  });
});
