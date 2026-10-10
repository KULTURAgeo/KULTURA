"use client";
import { useLanguage } from "./language-provider";
import { colorDisplayName } from "@/lib/category-i18n";
export function LocalizedColorNames({ colors }: { colors: string[] }) {
  const { locale } = useLanguage();
  return <>{colors.map((color) => colorDisplayName(locale, color).toUpperCase()).join(" / ") || "—"}</>;
}
