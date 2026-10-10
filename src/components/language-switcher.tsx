"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";
import { useLanguage } from "./language-provider";

/** Uses a necessary preference cookie; leaves the URL, checkout and cart intact. */
export function LanguageSwitcher({ mobile = false }: { mobile?: boolean }) {
  const { locale, setLocale, t } = useLanguage();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const onChange = (next: string) => {
    if (!isLocale(next) || next === locale) return;
    const value: Locale = next;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setLocale(value);
    startTransition(() => router.refresh());
  };
  return (
    <label className={mobile ? "kultura-language-switcher mobile" : "kultura-language-switcher"}>
      <span className="sr-only">{t("Language")}</span>
      <select aria-label={t("Language")} value={locale} disabled={pending} onChange={(e) => onChange(e.target.value)}>
        <option value="en">EN</option>
        <option value="ka">ქართული</option>
      </select>
    </label>
  );
}
