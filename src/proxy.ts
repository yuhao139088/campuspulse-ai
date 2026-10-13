import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const protectedPrefixes = ["/dashboard", "/datasets", "/analysis", "/canvas", "/reports", "/settings", "/admin"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedApi = pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/") && pathname !== "/api/health";
  if (!protectedApi && !protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return NextResponse.next();
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token?.sub === "demo-user" && process.env.DEMO_AUTH_ENABLED === "true") return NextResponse.next();
  if (token?.sub) {
    try {
      const user = await prisma.user.findUnique({ where: { id: token.sub }, select: { disabled: true, authVersion: true } });
      if (user && !user.disabled && user.authVersion === (token.authVersion ?? 0)) return NextResponse.next();
    } catch { return NextResponse.json({ error: "Authentication service temporarily unavailable" }, { status: 503 }); }
  }
  if (protectedApi) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = { matcher: ["/api/:path*", "/dashboard/:path*", "/datasets/:path*", "/analysis/:path*", "/canvas/:path*", "/reports/:path*", "/settings/:path*", "/admin/:path*"] };

