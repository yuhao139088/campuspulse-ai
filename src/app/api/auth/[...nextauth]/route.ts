import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { buildAuthOptions } from "@/lib/auth";

async function handler(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  return NextAuth(request, context, await buildAuthOptions());
}

export { handler as GET, handler as POST };