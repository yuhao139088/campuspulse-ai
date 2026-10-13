import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { workspaceAccess, apiFailure, audit } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { runAgent } from "@/lib/ai/agent";
import { runDemoAgent } from "@/lib/ai/demo-agent";

export async function POST(request: Request) {
  try {
    const data = z.object({ prompt: z.string().trim().min(1).max(2000), locale: z.enum(["zh", "en"]).default("zh"), datasetId: z.string().optional(), purpose: z.literal("chart_recommendations").optional() }).parse(await request.json());
    if (process.env.NODE_ENV === "test") return NextResponse.json({ mode: "demo", ...runDemoAgent(data.prompt, data.locale) });
    const { user, space } = await workspaceAccess(true);
    if (user.demo) return NextResponse.json({ mode: "demo", ...runDemoAgent(data.prompt, data.locale) });
    const result = await runAgent(space.id, data.prompt, data.locale, data.datasetId, data.purpose);
    const analysis = await prisma.analysis.create({ data: { prompt: data.prompt, answer: result.answer, locale: data.locale, model: result.model, datasetId: result.datasetId, userId: user.id, tools: result.tools, evidence: result.evidence, result: result as unknown as Prisma.InputJsonValue } });
    await audit(user.id, space.id, "analysis.create", { analysisId: analysis.id, prompt: data.prompt, datasetId: result.datasetId, tools: result.tools.length });
    return NextResponse.json({ ...result, id: analysis.id });
  } catch (error) { return apiFailure(error); }
}
export async function GET() {
  try { const { user, space } = await workspaceAccess(); return NextResponse.json({ analyses: user.demo ? [] : await prisma.analysis.findMany({ where: { dataset: { spaceId: space.id } }, orderBy: { createdAt: "desc" }, take: 30 }) }); }
  catch (error) { return apiFailure(error); }
}
