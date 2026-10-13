import { NextResponse } from "next/server";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { storageClient } from "@/lib/storage";
import { aiConfig } from "@/lib/system-config";
export async function GET() {
  if (process.env.NODE_ENV !== "production" || process.env.DEMO_AUTH_ENABLED === "true") return NextResponse.json({ ok: true, service: "campuspulse-ai", mode: "development" });
  try {
    await prisma.$queryRaw`SELECT 1`;
    if (!storageClient) throw new Error("Storage unavailable");
    await storageClient.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }), { abortSignal: AbortSignal.timeout(5000) });
    const ai = await aiConfig();
    return NextResponse.json({ ok: true, service: "campuspulse-ai", database: "ready", storage: "ready", aiConfigured: Boolean(ai.enabled && ai.apiKey && ai.model) });
  } catch { return NextResponse.json({ ok: false, service: "campuspulse-ai" }, { status: 503 }); }
}
