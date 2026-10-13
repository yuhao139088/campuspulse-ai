import { NextResponse } from "next/server";
import { workspaceAccess, apiFailure, ApiError } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { readObject } from "@/lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { space } = await workspaceAccess();
    const { id } = await context.params;
    const dataset = await prisma.dataset.findFirst({ where: { id, spaceId: space.id } });
    if (!dataset?.objectKey) throw new ApiError(404, "Source file unavailable");
    const file = await readObject(dataset.objectKey);
    return new NextResponse(file.bytes as BodyInit, { headers: { "Content-Type": file.contentType ?? "application/octet-stream", "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(dataset.name), "Cache-Control": "private, no-store" } });
  } catch (error) { return apiFailure(error); }
}
