import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceAccess, apiFailure, audit } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function GET() { try { const { space } = await workspaceAccess(); return NextResponse.json({ tasks: await prisma.actionTask.findMany({ where: { spaceId: space.id }, orderBy: { createdAt: "desc" } }) }); } catch (error) { return apiFailure(error); } }
export async function POST(request: Request) { try { const { space, user } = await workspaceAccess(true); const { title } = z.object({ title: z.string().min(1).max(1000) }).parse(await request.json()); const task = await prisma.actionTask.create({ data: { title, userId: user.id, spaceId: space.id } }); await audit(user.id, space.id, "task.create", { title }); return NextResponse.json({ task }, { status: 201 }); } catch (error) { return apiFailure(error); } }
export async function PATCH(request: Request) { try { const { space } = await workspaceAccess(true); const { id, status } = z.object({ id: z.string(), status: z.enum(["OPEN", "DONE"]) }).parse(await request.json()); await prisma.actionTask.updateMany({ where: { id, spaceId: space.id }, data: { status } }); return NextResponse.json({ ok: true }); } catch (error) { return apiFailure(error); } }
