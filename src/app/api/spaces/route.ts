import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { currentUser, apiFailure, ApiError, audit } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getPersonalSpace } from "@/lib/workspace";

export async function GET() {
  try {
    const user = await currentUser();
    if (user.demo) return NextResponse.json({ user, spaces: [{ id: "demo-space", name: "演示空间", role: "OWNER" }], active: "demo-space" });
    await getPersonalSpace(user.id);
    const memberships = await prisma.membership.findMany({ where: { userId: user.id }, include: { space: true } });
    const active = (await cookies()).get("campuspulse-space")?.value ?? memberships.find((item) => item.space.type === "PERSONAL")?.spaceId;
    const spaces = user.globalRole === "ADMIN" ? (await prisma.space.findMany({ orderBy: { createdAt: "asc" } })).map((space) => ({ ...space, role: "OWNER" })) : memberships.map((item) => ({ ...item.space, role: item.role }));
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, globalRole: user.globalRole }, spaces, active });
  } catch (error) { return apiFailure(error); }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    const { name } = z.object({ name: z.string().trim().min(2).max(80) }).parse(await request.json());
    const space = await prisma.space.create({ data: { name, slug: "club-" + crypto.randomUUID(), type: "CLUB", memberships: { create: { userId: user.id, role: "OWNER" } } } });
    await audit(user.id, space.id, "space.create", { name });
    (await cookies()).set("campuspulse-space", space.id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    return NextResponse.json({ space }, { status: 201 });
  } catch (error) { return apiFailure(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await currentUser();
    const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());
    if (!user.demo && (user.globalRole === "ADMIN" ? !await prisma.space.findUnique({ where: { id } }) : !await prisma.membership.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: id } } }))) throw new ApiError(403, "No access to this workspace");
    (await cookies()).set("campuspulse-space", id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
