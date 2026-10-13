"use client";
import { useState } from "react";
import { RoundedSelect } from "./rounded-select";
import { useAppLocale } from "@/lib/locale";

export const phoneCountries = [
  { id: "CN", code: "+86", zh: "中国大陆", en: "China", flag: "🇨🇳" },
  { id: "HK", code: "+852", zh: "中国香港", en: "Hong Kong", flag: "🇭🇰" },
  { id: "MO", code: "+853", zh: "中国澳门", en: "Macao", flag: "🇲🇴" },
  { id: "TW", code: "+886", zh: "中国台湾", en: "Taiwan", flag: "🇹🇼" },
  { id: "US", code: "+1", zh: "美国", en: "United States", flag: "🇺🇸" },
  { id: "GB", code: "+44", zh: "英国", en: "United Kingdom", flag: "🇬🇧" },
  { id: "AU", code: "+61", zh: "澳大利亚", en: "Australia", flag: "🇦🇺" },
  { id: "SG", code: "+65", zh: "新加坡", en: "Singapore", flag: "🇸🇬" },
  { id: "JP", code: "+81", zh: "日本", en: "Japan", flag: "🇯🇵" },
  { id: "KR", code: "+82", zh: "韩国", en: "South Korea", flag: "🇰🇷" },
] as const;

export function PhoneInput({ value, onChange, allowedCountries = ["CN"], disabled, readOnly, label, invalid, describedBy, autoComplete = "tel" }: {
  value: string; onChange: (value: string) => void; allowedCountries?: string[]; disabled?: boolean; readOnly?: boolean; label?: string; invalid?: boolean; describedBy?: string; autoComplete?: string;
}) {
  const [locale] = useAppLocale();
  const [countryId, setCountryId] = useState("CN");
  const parsed = value.startsWith("+") ? [...phoneCountries].sort((left, right) => right.code.length - left.code.length).find((country) => value.startsWith(country.code)) : undefined;
  const country = parsed ?? phoneCountries.find((item) => item.id === countryId) ?? phoneCountries[0];
  const national = parsed ? value.slice(parsed.code.length) : value;
  const countryLabel = locale === "zh" ? country.zh : country.en;
  return <div className={"phone-input " + (invalid ? "phone-input-invalid" : "")}>
    <RoundedSelect aria-label={locale === "zh" ? "国家或地区" : "Country or region"} className="auth-input" value={country.id} disabled={disabled || readOnly} displayValue={<>{country.flag} {countryLabel}</>} onChange={(event) => {
      const next = phoneCountries.find((item) => item.id === event.target.value);
      if (!next) return;
      setCountryId(next.id);
      onChange(national ? next.code + national : "");
    }}>{phoneCountries.map((item) => <option key={item.id} value={item.id} disabled={!allowedCountries.includes(item.id)}>{item.flag} {locale === "zh" ? item.zh : item.en} ({item.code})</option>)}</RoundedSelect>
    <input className="auth-input" aria-label={label ?? (locale === "zh" ? "手机号" : "Phone number")} type="tel" inputMode="tel" autoComplete={autoComplete} placeholder={country.id === "CN" ? "13800138000" : locale === "zh" ? "输入手机号" : "Phone number"} maxLength={18} disabled={disabled} readOnly={readOnly} aria-invalid={invalid || undefined} aria-describedby={describedBy} value={national} onChange={(event) => {
      const entered = event.target.value.replace(/[^\d+]/g, "");
      if (entered.startsWith("+")) { onChange(entered); return; }
      const digits = entered.replace(/\D/g, "");
      onChange(digits ? country.code + digits : "");
    }} />
  </div>;
}
