import { NextResponse } from "next/server";
import { workspaceAccess, apiFailure, ApiError, audit } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { removeObject } from "@/lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { space } = await workspaceAccess();
    const { id } = await context.params;
    const dataset = await prisma.dataset.findFirst({ where: { id, spaceId: space.id }, include: { evidence: true, analyses: { orderBy: { createdAt: "desc" }, take: 10 } } });
    if (!dataset) throw new ApiError(404, "Dataset not found");
    return NextResponse.json({ dataset });
  } catch (error) { return apiFailure(error); }
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { space, user } = await workspaceAccess(true);
    const { id } = await context.params;
    const dataset = await prisma.dataset.findFirst({ where: { id, spaceId: space.id } });
    if (!dataset) throw new ApiError(404, "Dataset not found");
    await prisma.$transaction([prisma.analysis.updateMany({ where: { datasetId: id }, data: { datasetId: null } }), prisma.report.updateMany({ where: { datasetId: id }, data: { datasetId: null } }), prisma.dataset.delete({ where: { id } })]);
    if (dataset.objectKey) await removeObject(dataset.objectKey);
    await audit(user.id, space.id, "dataset.delete", { id, name: dataset.name });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
