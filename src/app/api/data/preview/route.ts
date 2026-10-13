import { NextResponse } from "next/server";
import { workspaceAccess, apiFailure, ApiError } from "@/lib/access";
import { ingestFile } from "@/lib/ingestion";
export async function POST(request: Request) {
  try {
    await workspaceAccess(true);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 20 * 1024 * 1024) throw new ApiError(400,"Invalid file");
    const data = await ingestFile(file,form.get("locale")==="en"?"en":"zh");
    return NextResponse.json({ status: "READY", rowCount: data.rows.length, columnCount: data.columns.length, preview: { rows: data.rows.slice(0,8), columns: data.columns }, sourceType: data.sourceType, aiSummary: data.summary, healthScore: data.profile.qualityScore, aiMode: data.mode });
  } catch (error) { return apiFailure(error); }
}
