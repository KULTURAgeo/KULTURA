"use client";
import { useLanguage } from "./language-provider";
export function LocalizedLabel({ source }: { source: string }) {
 const { t } = useLanguage();
 return <>{t(source)}</>;
}
