import type { Metadata } from "next";
import type { Locale } from "./i18n";

export function siteUrl(): URL {
  const configured = process.env.SITE_URL;
  if (!configured && process.env.VERCEL) throw new Error("SITE_URL is required on Vercel.");
  const url = new URL(configured || "http://localhost:3000");
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      (process.env.VERCEL && local)) throw new Error("SITE_URL must be a public HTTPS origin on Vercel.");
  return url;
}
export function isIndexable(): boolean {
  return process.env.SITE_INDEXABLE === "true" &&
    (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production") &&
    !["localhost", "127.0.0.1"].includes(siteUrl().hostname);
}
export const privateMetadata: Metadata = { robots: { index: false, follow: false } };
export function languageUrls(path: string) {
  const origin = siteUrl();
  const en = new URL(path, origin);
  const ka = new URL(path, origin);
  en.searchParams.set("lang", "en");
  ka.searchParams.set("lang", "ka");
  return { en: en.href, ka: ka.href, "x-default": new URL(path, origin).href };
}

export function localizedPageMetadata(
  locale: Locale, title: string, path: string, description?: string, georgianDescription?: string,
): Metadata {
  const copy = locale === "ka"
    ? georgianDescription ?? "KULTURA — დამოუკიდებელი ქუჩის სტილი საქართველოდან. აღმოაჩინე კოლექციები და შეარჩიე შენი ყოველდღიური სამოსი."
    : description;
  const languages = languageUrls(path);
  const result = pageMetadata(title, languages[locale], copy);
  return {
    ...result,
    alternates: { canonical: languages[locale], languages },
    openGraph: { ...result.openGraph, locale: locale === "ka" ? "ka_GE" : "en_US" },
  };
}
export function pageMetadata(title: string, path: string, description = "Independent streetwear. Strong silhouettes. An everyday uniform for those who move differently."): Metadata {
  return {
    title, description, alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: "KULTURA", type: "website", images: [{ url: "/social-card.png", width: 1200, height: 630, alt: "KULTURA — Step Into Kultura" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/social-card.png"] },
  };
}
