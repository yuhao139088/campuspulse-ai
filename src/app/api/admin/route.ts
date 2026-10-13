import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceAccess, audit, apiFailure, ApiError } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

export async function GET() {
  try {
    const { space, user, role } = await workspaceAccess(false, true);
    if (user.demo) return NextResponse.json({ members: [], logs: [], datasets: [], invitations: [], settings: {}, role });
    const [members, logs, datasets, invitations, analyses, reports] = await Promise.all([
      prisma.membership.findMany({ where: { spaceId: space.id }, include: { user: { select: { id: true, name: true, email: true, disabled: true } } } }),
      prisma.auditLog.findMany({ where: { spaceId: space.id }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.dataset.findMany({ where: { spaceId: space.id }, orderBy: { updatedAt: "desc" } }),
      prisma.invitation.findMany({ where: { spaceId: space.id, acceptedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.analysis.count({ where: { dataset: { spaceId: space.id } } }),
      prisma.report.count({ where: { spaceId: space.id } }),
    ]);
    return NextResponse.json({ members, logs, datasets, invitations, analyses, reports, settings: space.settings ?? {}, role, userId: user.id, platformAdmin: user.globalRole === "ADMIN" });
  } catch (error) { return apiFailure(error); }
}

export async function POST(request: Request) {
  try {
    const { space, user } = await workspaceAccess(true, true);
    const settings = space.settings as { defaultRole?: "VIEWER" | "EDITOR" } | null;
    const data = z.object({ email: z.string().email(), name: z.string().max(80).optional(), role: z.enum(["EDITOR", "VIEWER", "ADVISOR", "ADMIN"]).default(settings?.defaultRole ?? "VIEWER") }).parse(await request.json());
    const invitee = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (invitee && await prisma.membership.findUnique({ where: { userId_spaceId: { userId: invitee.id, spaceId: space.id } } })) throw new ApiError(409, "Already a workspace member");
    const invitation = await prisma.invitation.create({ data: { ...data, email: data.email.toLowerCase(), spaceId: space.id, token: randomBytes(32).toString("hex"), expiresAt: new Date(Date.now() + 7 * 86400000) } });
    await audit(user.id, space.id, "member.invite", { email: data.email, role: data.role });
    return NextResponse.json({ invitation, link: (process.env.NEXTAUTH_URL ?? "") + "/settings?invite=" + invitation.token });
  } catch (error) { return apiFailure(error); }
}

export async function PATCH(request: Request) {
  try {
    const { space, user } = await workspaceAccess(true, true);
    const body = await request.json();
    if (body.memberId) {
      const member = await prisma.membership.findFirst({ where: { id: body.memberId, spaceId: space.id } });
      if (!member || member.role === "OWNER") throw new ApiError(403, "The owner cannot be changed or removed");
      if (body.remove) await prisma.membership.delete({ where: { id: member.id } });
      else await prisma.membership.update({ where: { id: member.id }, data: { role: z.enum(["ADMIN", "EDITOR", "VIEWER", "ADVISOR"]).parse(body.role) } });
      await audit(user.id, space.id, "member.update", { memberId: member.id, role: body.role ?? "REMOVED" });
    } else {
      const settings = z.object({ defaultRole: z.enum(["VIEWER", "EDITOR"]).default("VIEWER"), requireEvidence: z.boolean().default(true), auditEnabled: z.boolean().default(true) }).parse(body.settings);
      await prisma.space.update({ where: { id: space.id }, data: { settings } });
      await audit(user.id, space.id, "space.settings", settings);
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
