import { NextResponse } from "next/server";
import { retrieveKnowledge } from "@/lib/ai/knowledge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() || "社团运营";
  const locale = url.searchParams.get("locale") === "en" ? "en" : "zh";
  return NextResponse.json({ query, locale, results: retrieveKnowledge(query, locale) });
}
