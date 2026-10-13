import { NextResponse } from "next/server";
import { workspaceAccess, apiFailure, ApiError } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { demoDatasets } from "@/lib/demo-data";

export async function GET() {
  try {
    const { user, space } = await workspaceAccess();
    if (user.demo) return NextResponse.json({ datasets: demoDatasets, source: "demo" });
    return NextResponse.json({ datasets: await prisma.dataset.findMany({ where: { spaceId: space.id }, orderBy: { updatedAt: "desc" } }), source: "postgres" });
  } catch (error) { return apiFailure(error); }
}

export async function POST() { return apiFailure(new ApiError(400, "Upload the original file using /api/import")); }
