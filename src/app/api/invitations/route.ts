import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { currentUser, apiFailure, ApiError, audit } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    const { token } = z.object({ token: z.string().length(64) }).parse(await request.json());
    const invite = await prisma.invitation.findUnique({ where: { token } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date() || invite.email !== user.email?.toLowerCase()) throw new ApiError(403, "Invitation is expired, already used or belongs to another email");
    await prisma.$transaction([
      prisma.membership.upsert({ where: { userId_spaceId: { userId: user.id, spaceId: invite.spaceId } }, update: {}, create: { userId: user.id, spaceId: invite.spaceId, role: invite.role } }),
      prisma.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    ]);
    (await cookies()).set("campuspulse-space", invite.spaceId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    await audit(user.id, invite.spaceId, "member.accept", { email: user.email ?? "" });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
