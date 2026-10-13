"use client";
import { useEffect, useState } from "react";
export function useSiteSettings() {
  const [site, setSite] = useState({ name: "CampusPulse AI", description: "", announcement: "", supportEmail: "", defaultLocale: "zh" });
  useEffect(() => { let active = true; fetch("/api/auth/features", { cache: "no-store" }).then((response) => response.json()).then((data) => { if (active && data.site) { setSite(data.site); document.title = data.site.name + " · Campus data workspace"; } }).catch(() => undefined); return () => { active = false; }; }, []);
  return site;
}
