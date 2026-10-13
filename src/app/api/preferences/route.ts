import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, apiFailure } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { aiConfig } from "@/lib/system-config";

export async function GET() {
  try { const user = await currentUser(); const preferences = user.demo ? {} : (await prisma.user.findUnique({ where: { id: user.id }, select: { preferences: true } }))?.preferences; const ai = await aiConfig(); return NextResponse.json({ preferences, aiConfigured: Boolean(ai.enabled && ai.apiKey && ai.model), model: ai.model, storageConfigured: Boolean(process.env.S3_ENDPOINT) }); }
  catch (error) { return apiFailure(error); }
}
export async function PUT(request: Request) {
  try { const user = await currentUser(); const preferences = z.object({ locale: z.enum(["zh", "en"]), theme: z.enum(["dark", "light"]), motion: z.boolean(), notifications: z.boolean() }).parse(await request.json()); if (!user.demo) await prisma.user.update({ where: { id: user.id }, data: { preferences } }); return NextResponse.json({ ok: true }); }
  catch (error) { return apiFailure(error); }
}
