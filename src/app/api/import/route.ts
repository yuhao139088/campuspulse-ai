import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { workspaceAccess, audit, apiFailure, ApiError } from "@/lib/access";
import { ingestFile } from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import { storeObject, removeObject } from "@/lib/storage";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let objectKey: string | undefined;
  try {
    const { user, space } = await workspaceAccess(true);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "File required");
    if (!file.size || file.size > 20 * 1024 * 1024) throw new ApiError(413, "File must be between 1 byte and 20 MB");
    const data = await ingestFile(file, form.get("locale") === "en" ? "en" : "zh");
    objectKey = space.id + "/" + randomUUID() + "." + file.name.split(".").pop();
    await storeObject(objectKey, data.bytes, data.contentType);
    const content = { rows: data.rows, columns: data.columns, dictionary: data.dictionary, profile: data.profile, summary: data.summary, duplicates: data.duplicates, ocr: "ocr" in data ? data.ocr : null, mode: data.mode };
    const dataset = await prisma.dataset.create({ data: { name: file.name.slice(0, 120), description: data.summary.slice(0, 500), sourceType: data.sourceType, rowCount: data.rows.length, columnCount: data.columns.length, healthScore: data.profile.qualityScore, objectKey, ownerId: user.id, spaceId: space.id, evidence: { create: { label: file.name, kind: data.sourceType === "IMAGE" ? "OCR" : "TABLE", content: content as unknown as Prisma.InputJsonValue } } }, include: { evidence: true } });
    await audit(user.id, space.id, "dataset.import", { datasetId: dataset.id, name: dataset.name, rows: dataset.rowCount, mode: data.mode });
    return NextResponse.json({ dataset, persistence: "postgres", aiMode: data.mode }, { status: 201 });
  } catch (error) {
    if (objectKey) await removeObject(objectKey).catch(() => undefined);
    return apiFailure(error);
  }
}
