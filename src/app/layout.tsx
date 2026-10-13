import type { Metadata } from "next";
import "animate.css";
import "./globals.css";
import { siteConfig } from "@/lib/system-config";
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await siteConfig().catch(() => ({ name: "CampusPulse AI", description: "AI-powered data analysis and decision workspace for university clubs." }));
  return { title: site.name + " — Campus intelligence, made actionable", description: site.description, icons: { icon: "/campuspulse-icon.svg" } };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
