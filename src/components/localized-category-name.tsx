"use client";

import { useLanguage } from "./language-provider";
import { categoryDisplayName } from "@/lib/category-i18n";

export function LocalizedCategoryName({ name, slug }: { name: string; slug?: string }) {
  const { locale } = useLanguage();
  return <>{categoryDisplayName(locale, name, slug)}</>;
}
