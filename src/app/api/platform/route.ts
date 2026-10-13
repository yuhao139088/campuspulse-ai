import { NextResponse } from "next/server";
import { z } from "zod";
import { platformAccess, ApiError, apiFailure, audit } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getPersonalSpace } from "@/lib/workspace";

export async function GET() {
  try {
    const user = await platformAccess();
    const [users, spaces, datasets, analyses, reports] = await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, phone: true, totpEnabled: true, disabled: true, globalRole: true, createdAt: true } }),
      prisma.space.findMany({ include: { _count: { select: { memberships: true, datasets: true, reports: true } } } }),
      prisma.dataset.count(), prisma.analysis.count(), prisma.report.count(),
    ]);
    return NextResponse.json({ userId: user.id, users, spaces, datasets, analyses, reports });
  } catch (error) { return apiFailure(error); }
}
export async function PATCH(request: Request) {
  try {
    const user = await platformAccess();
    const data = z.object({ userId: z.string(), disabled: z.boolean().optional(), globalRole: z.enum(["USER", "ADMIN"]).optional(), resetSessions: z.boolean().optional() }).strict().parse(await request.json());
    if (data.userId === user.id) throw new ApiError(403, "Use account security to change your own login; your administrator access is protected");
    const target = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!target) throw new ApiError(404, "User not found");
    await prisma.$transaction(async (transaction) => {
      if (target.globalRole === "ADMIN" && (data.disabled || data.globalRole === "USER")) {
        const administrators = await transaction.user.count({ where: { globalRole: "ADMIN", disabled: false } });
        if (administrators < 2) throw new ApiError(403, "The last system administrator must remain active");
      }
      await transaction.user.update({ where: { id: target.id }, data: { ...(data.disabled !== undefined ? { disabled: data.disabled } : {}), ...(data.globalRole ? { globalRole: data.globalRole } : {}), authVersion: { increment: 1 } } });
    }, { isolationLevel: "Serializable" });
    await audit(user.id, (await getPersonalSpace(user.id)).id, "platform.account", { userId: data.userId, ...(data.disabled !== undefined ? { disabled: data.disabled } : {}), ...(data.globalRole ? { globalRole: data.globalRole } : {}), resetSessions: true });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
