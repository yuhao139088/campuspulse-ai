import { NextResponse } from "next/server";
import { z } from "zod";
import { platformAccess, audit, ApiError, apiFailure } from "@/lib/access";
import { prisma } from "@/lib/prisma";
export async function PATCH(request: Request) {
  try {
    const user = await platformAccess();
    const data = z.object({ spaceId: z.string(), name: z.string().trim().min(2).max(80).optional(), ownerId: z.string().optional() }).strict().parse(await request.json());
    const space = await prisma.space.findUnique({ where: { id: data.spaceId } });
    if (!space) throw new ApiError(404, "Workspace not found");
    if (data.ownerId && space.type === "PERSONAL") throw new ApiError(400, "Personal workspace ownership follows its account");
    await prisma.$transaction(async (transaction) => {
      if (data.name) await transaction.space.update({ where: { id: space.id }, data: { name: data.name } });
      if (data.ownerId) {
        const owner = await transaction.user.findUnique({ where: { id: data.ownerId } });
        if (!owner || owner.disabled) throw new ApiError(400, "Choose an active account");
        await transaction.membership.updateMany({ where: { spaceId: space.id, role: "OWNER" }, data: { role: "ADMIN" } });
        await transaction.membership.upsert({ where: { userId_spaceId: { userId: owner.id, spaceId: space.id } }, update: { role: "OWNER" }, create: { userId: owner.id, spaceId: space.id, role: "OWNER" } });
      }
    });
    await audit(user.id, space.id, "platform.space.update", { ...(data.name ? { name: data.name } : {}), ...(data.ownerId ? { ownerId: data.ownerId } : {}) });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
