import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/access", () => ({ workspaceAccess: async () => ({ user: { id: "demo-user", demo: true }, space: { id: "demo-space" } }), apiFailure: () => new Response("failure", { status: 503 }) }));
import { POST as analyze } from "@/app/api/ai/analyze/route";
import { GET as datasets } from "@/app/api/datasets/route";
import { POST as reports } from "@/app/api/reports/route";

describe("CampusPulse API contracts", () => {
  it("returns dataset fallback records", async () => {
    const response = await datasets();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.datasets.length).toBeGreaterThan(0);
  });
  it("returns evidence-backed agent results", async () => {
    const response = await analyze(new Request("http://localhost/api/ai/analyze", { method: "POST", body: JSON.stringify({ prompt: "检查签到异常", locale: "zh" }), headers: { "Content-Type": "application/json" } }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.tools).toContain("detect_anomalies");
    expect(payload.evidence.length).toBeGreaterThan(0);
  });
  it("generates bilingual report markdown", async () => {
    const response = await reports(new Request("http://localhost/api/reports", { method: "POST", body: JSON.stringify({ title: "测试报告", prompt: "复盘签到", locale: "en" }), headers: { "Content-Type": "application/json" } }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.markdown).toContain("Executive summary");
  });
});
