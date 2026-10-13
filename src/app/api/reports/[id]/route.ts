import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { workspaceAccess, apiFailure, ApiError, audit } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { space } = await workspaceAccess(); const { id } = await context.params; const report = await prisma.report.findFirst({ where: { id, spaceId: space.id } }); if (!report) throw new ApiError(404, "Report not found"); const versions = await prisma.reportVersion.findMany({ where: { reportId: id }, orderBy: { number: "desc" } }); return NextResponse.json({ report, versions }); }
  catch (error) { return apiFailure(error); }
}
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { space, user } = await workspaceAccess(true); const { id } = await context.params;
    const data = z.object({ title: z.string().min(1).max(120), markdown: z.string().max(200000) }).parse(await request.json());
    const report = await prisma.report.findFirst({ where: { id, spaceId: space.id } }); if (!report) throw new ApiError(404, "Report not found");
    const content = { ...(report.content as Record<string, Prisma.InputJsonValue>), markdown: data.markdown };
    const version = await prisma.reportVersion.findFirst({ where: { reportId: id }, orderBy: { number: "desc" } });
    const updated = await prisma.$transaction([prisma.report.update({ where: { id }, data: { title: data.title, content } }), prisma.reportVersion.create({ data: { reportId: id, number: (version?.number ?? 0) + 1, content } })]);
    await audit(user.id, space.id, "report.edit", { id });
    return NextResponse.json({ report: updated[0] });
  } catch (error) { return apiFailure(error); }
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { space, user } = await workspaceAccess(true); const { id } = await context.params; const report = await prisma.report.findFirst({ where: { id, spaceId: space.id } }); if (!report) throw new ApiError(404, "Report not found"); await prisma.$transaction([prisma.reportVersion.deleteMany({ where: { reportId: id } }), prisma.report.delete({ where: { id } })]); await audit(user.id, space.id, "report.delete", { id }); return NextResponse.json({ ok: true }); }
  catch (error) { return apiFailure(error); }
}
