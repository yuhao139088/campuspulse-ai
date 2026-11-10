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
  mocks.findFirst.mockResolvedValue({ id: "selected-dataset", name: "Ratings", evidence: [{ kind: "TABLE", content: { rows: [{ month: "2026-10", activity: "Workshop", registered: 20, checkedIn: 15, rating: 4 }, { month: "2026-11", activity: "Welcome", registered: 40, checkedIn: 20, rating: 5 }] } }] });
});

describe("chart recommendation Agent", () => {
  it("returns explicit arithmetic ratios without asserting business meaning", async () => {
    mocks.callAI.mockResolvedValueOnce({ content: "", tool_calls: [{ id: "tool-ratio", function: { name: "calculate_ratio", arguments: JSON.stringify({ numeratorColumn: "checkedIn", denominatorColumn: "registered", groupBy: "activity" }) } }] })
      .mockResolvedValueOnce({ content: JSON.stringify({ answer: "The grouped ratio was calculated from the selected fields." }) });
    const result = await runAgent("space", "Calculate a ratio by activity", "en", "selected-dataset");
    const ratioTrace = result.traces.find((trace) => trace.name === "calculate_ratio");
    expect(ratioTrace?.result).toMatchObject({ numeratorColumn: "checkedIn", denominatorColumn: "registered", groupBy: "activity", interpretation: expect.stringContaining("does not infer or validate") });
    expect((ratioTrace?.result as { results: { group: string; ratioPercent: number }[] }).results).toEqual([
      { group: "Workshop", numerator: 15, denominator: 20, ratioPercent: 75, validRows: 1, excludedRows: 0 },
      { group: "Welcome", numerator: 20, denominator: 40, ratioPercent: 50, validRows: 1, excludedRows: 0 },
    ]);
  });

  it("rejects ratio calculations that reference columns outside the dataset", async () => {
    mocks.callAI.mockResolvedValueOnce({ content: "", tool_calls: [{ id: "tool-ratio", function: { name: "calculate_ratio", arguments: JSON.stringify({ numeratorColumn: "registered", denominatorColumn: "invented" }) } }] })
      .mockResolvedValueOnce({ content: JSON.stringify({ answer: "The selected field was unavailable." }) });
    const result = await runAgent("space", "Calculate a ratio", "en", "selected-dataset");
    expect(result.traces.find((trace) => trace.name === "calculate_ratio")?.result).toMatchObject({ error: "Choose actual numeric fields" });
  });

  it("rejects ratios that reuse a field as both numerator and denominator", async () => {
    mocks.callAI.mockResolvedValueOnce({ content: "", tool_calls: [{ id: "tool-ratio", function: { name: "calculate_ratio", arguments: JSON.stringify({ numeratorColumn: "registered", denominatorColumn: "registered" }) } }] })
      .mockResolvedValueOnce({ content: JSON.stringify({ answer: "The ratio fields must be distinct." }) });
    const result = await runAgent("space", "Calculate a ratio", "en", "selected-dataset");
    expect(result.traces.find((trace) => trace.name === "calculate_ratio")?.result).toMatchObject({ error: "Numerator and denominator must be different fields" });
  });

  it("does not silently choose the first numeric field when a metric is omitted", async () => {
    mocks.callAI.mockResolvedValueOnce({ content: "", tool_calls: [{ id: "tool-aggregate", function: { name: "aggregate_metrics", arguments: "{}" } }] })
      .mockResolvedValueOnce({ content: JSON.stringify({ answer: "Select a metric before aggregating." }) });
    const result = await runAgent("space", "Aggregate the metric", "en", "selected-dataset");
    expect(result.traces.find((trace) => trace.name === "aggregate_metrics")?.result).toMatchObject({ error: "Choose an actual numeric column explicitly; no default metric is selected" });
  });

  it("executes the action-plan tool from deterministic anomaly results", async () => {
    const rows = [{ rating: 3 }, { rating: 3.1 }, { rating: 3 }, { rating: 3.2 }, { rating: 5 }];
    mocks.findFirst.mockResolvedValueOnce({ id: "selected-dataset", name: "Ratings", evidence: [{ kind: "TABLE", content: { rows } }] });
    mocks.callAI.mockResolvedValueOnce({ content: "", tool_calls: [{ id: "tool-plan", function: { name: "create_action_plan", arguments: JSON.stringify({ column: "rating" }) } }] })
      .mockResolvedValueOnce({ content: JSON.stringify({ answer: "Review the candidate records." }) });
    const result = await runAgent("space", "Make a cautious review plan", "en", "selected-dataset");
    const planTrace = result.traces.find((trace) => trace.name === "create_action_plan");
    expect(planTrace?.result).toMatchObject({ metricColumn: "rating", rowCount: 5, limitation: expect.stringContaining("do not establish an error or its cause") });
    expect((planTrace?.result as { actions: string[] }).actions[0]).toContain("rating");
  });

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
