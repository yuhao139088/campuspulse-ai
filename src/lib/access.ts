import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { getPersonalSpace } from "./workspace";
import type { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { ApiError } from "./errors";
export { ApiError } from "./errors";

export async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new ApiError(401, "Please sign in / 请先登录");
  if (session.user.id === "demo-user" && process.env.DEMO_AUTH_ENABLED === "true") return { id: session.user.id, email: session.user.email, name: session.user.name, globalRole: "ADMIN", demo: true as const };
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.disabled || user.authVersion !== (session.user.authVersion ?? 0)) throw new ApiError(401, "Session expired; sign in again / 登录已失效，请重新登录");
  return { ...user, demo: false as const };
}

export async function workspaceAccess(write = false, admin = false) {
  const user = await currentUser();
  if (user.demo) return { user, space: { id: "demo-space", name: "演示空间", settings: null }, role: "OWNER" as const };
  const cookieStore = await cookies();
  const requested = cookieStore.get("campuspulse-space")?.value;
  const space = requested ? await prisma.space.findUnique({ where: { id: requested } }) : await getPersonalSpace(user.id);
  if (!space) throw new ApiError(404, "Workspace not found");
  if (user.globalRole === "ADMIN") return { user, space, role: "OWNER" as const };
  const membership = await prisma.membership.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: space.id } } });
  if (!membership) throw new ApiError(403, "Workspace access denied");
  if (admin && !["OWNER", "ADMIN"].includes(membership.role)) throw new ApiError(403, "Admin role required");
  if (write && !["OWNER", "ADMIN", "EDITOR"].includes(membership.role)) throw new ApiError(403, "Read-only workspace");
  return { user, space, role: membership.role };
}

export async function audit(userId: string, spaceId: string, action: string, detail: Prisma.InputJsonValue = {}) {
  if (userId === "demo-user") return;
  if (!/^(platform\.|account\.|member\.|space\.)/.test(action)) {
    const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { settings: true } });
    const settings = space?.settings as { auditEnabled?: boolean } | null;
    if (settings?.auditEnabled === false) return;
  }
  await prisma.auditLog.create({ data: { userId, spaceId, action, detail } });
}

export async function platformAccess() {
  const user = await currentUser();
  if (user.demo || user.globalRole !== "ADMIN") throw new ApiError(403, "System administrator required / 需要系统管理员权限");
  return user;
}

export function apiFailure(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid request / 请求参数无效" }, { status: 400 });
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("campuspulse_api_failure", error instanceof Error ? error.message : "unknown");
  return NextResponse.json({ error: "Service temporarily unavailable / 服务暂不可用" }, { status: 503 });
}
