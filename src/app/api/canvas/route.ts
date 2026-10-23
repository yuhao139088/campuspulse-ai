import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceAccess, audit, apiFailure, ApiError } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET() {
  try { const { user, space } = await workspaceAccess(); const canvas = user.demo ? null : await prisma.canvas.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: space.id } } }); return NextResponse.json({ config: canvas?.config ?? null }); }
  catch (error) { return apiFailure(error); }
}
export async function PUT(request: Request) {
  try {
    const { user, space } = await workspaceAccess(true);
    const config = z.object({ components: z.array(z.string().max(80)).max(30), chartType: z.string().max(80), datasetId: z.string().optional(), charts: z.array(z.object({ id: z.string(), title: z.string(), type: z.enum(["bar", "line", "pie"]), category: z.string(), metric: z.string(), aggregation: z.enum(["sum", "average", "count"]), datasetId: z.string().max(80).optional() })).max(30).optional() }).parse(await request.json());
    if (!user.demo) {
      if (config.datasetId && !await prisma.dataset.findFirst({ where: { id: config.datasetId, spaceId: space.id } })) throw new ApiError(404, "Dataset not found");
      await prisma.canvas.upsert({ where: { userId_spaceId: { userId: user.id, spaceId: space.id } }, update: { config: config as Prisma.InputJsonValue }, create: { userId: user.id, spaceId: space.id, config: config as Prisma.InputJsonValue } });
      await audit(user.id, space.id, "canvas.save", { components: config.components.length });
    }
    return NextResponse.json({ ok: true, updatedAt: new Date() });
  } catch (error) { return apiFailure(error); }
}
