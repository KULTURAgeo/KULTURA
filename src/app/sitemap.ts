import type { MetadataRoute } from "next";
import { isIndexable, languageUrls, siteUrl } from "@/lib/site";
import {
  isSearchIndexableCategorySlug,
  isSearchIndexableProductSlug,
} from "@/lib/seo-indexing";
import { getCatalog } from "@/lib/catalog/repository";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexable()) return [];

  const { products, categories, status } = await getCatalog();
  if (status !== "ready")
    throw new Error("Sitemap temporarily unavailable.");

  const staticPages = [
    { path: "/", priority: 1, changeFrequency: "weekly" as const },
    { path: "/shop", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/drops", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.5, changeFrequency: "monthly" as const },
  ];

  const localized = (path: string, priority: number, changeFrequency: "daily" | "weekly"): MetadataRoute.Sitemap => {
    const languages = languageUrls(path);
    return [languages.en, languages.ka].map(url => ({
      url, priority, changeFrequency, alternates: { languages },
    }));
  };
  return [
    ...staticPages.flatMap(({ path, priority, changeFrequency }): MetadataRoute.Sitemap =>
      changeFrequency === "monthly"
        ? [{ url: new URL(path, siteUrl()).href, priority, changeFrequency }]
        : localized(path, priority, changeFrequency)),
    ...["x", "unisex", "y"].flatMap(division => localized("/shop/" + division, 0.8, "daily")),
    ...categories
      .filter((category) => isSearchIndexableCategorySlug(category.slug))
      .filter(category => !["x", "unisex", "y"].includes(category.slug))
      .flatMap(category => localized("/shop/" + category.slug, 0.8, "daily")),
    ...products
      .filter((product) => isSearchIndexableProductSlug(product.slug))
      .flatMap(product => localized("/product/" + product.slug, 0.7, "daily")),
  ];
}
