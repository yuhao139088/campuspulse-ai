import { NextResponse } from "next/server";
import { workspaceAccess, apiFailure } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { user, space, role } = await workspaceAccess();
    const [datasets, analyses, reports, tasks, logs] = await Promise.all([
      prisma.dataset.findMany({ where: { spaceId: space.id }, orderBy: { updatedAt: "desc" } }),
      prisma.analysis.findMany({ where: { dataset: { spaceId: space.id } }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.report.findMany({ where: { spaceId: space.id }, orderBy: { updatedAt: "desc" }, take: 10 }),
      prisma.actionTask.findMany({ where: { spaceId: space.id }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.auditLog.findMany({ where: { spaceId: space.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    ]);
    return NextResponse.json({ user: { name: user.name, email: user.email }, space, role, datasets, analyses, reports, tasks, logs, health: datasets.length ? Math.round(datasets.reduce((sum, item) => sum + (item.healthScore ?? 0), 0) / datasets.length) : null });
  } catch (error) { return apiFailure(error); }
}
