"use client";

import { useEffect, useState } from "react";

export type Locale = "zh" | "en";
export const localeStorageKey = "campuspulse.locale";
export const localeEventName = "campuspulse-locale-change";

export function readLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  return window.localStorage.getItem(localeStorageKey) === "en" ? "en" : "zh";
}

export function writeLocale(locale: Locale) {
  window.localStorage.setItem(localeStorageKey, locale);
  window.dispatchEvent(new CustomEvent<Locale>(localeEventName, { detail: locale }));
}

export function useAppLocale() {
  const [locale, setLocale] = useState<Locale>("zh");

  useEffect(() => {
    const timer = window.setTimeout(() => setLocale(readLocale()), 0);
    if (!window.localStorage.getItem(localeStorageKey)) fetch("/api/auth/features").then((response) => response.json()).then((data) => { if (!window.localStorage.getItem(localeStorageKey) && data.site?.defaultLocale === "en") writeLocale("en"); }).catch(() => undefined);
    const handleChange = (event: Event) => {
      const next = (event as CustomEvent<Locale>).detail;
      if (next === "zh" || next === "en") setLocale(next);
    };
    window.addEventListener(localeEventName, handleChange);
    return () => { window.clearTimeout(timer); window.removeEventListener(localeEventName, handleChange); };
  }, []);

  return [locale, writeLocale] as const;
}
