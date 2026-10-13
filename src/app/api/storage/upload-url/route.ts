import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Use /api/import: uploads are authenticated and stored privately by the server." }, { status: 410 });
}
