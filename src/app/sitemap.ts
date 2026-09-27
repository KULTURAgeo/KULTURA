import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/lib/site";
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

  return [
    ...staticPages.map(({ path, priority, changeFrequency }) => ({
      url: new URL(path, siteUrl()).href,
      priority,
      changeFrequency,
    })),
    ...categories.map((category) => ({
      url: new URL("/shop/" + category.slug, siteUrl()).href,
      priority: 0.8,
      changeFrequency: "daily" as const,
    })),
    ...products.map((product) => ({
      url: new URL("/product/" + product.slug, siteUrl()).href,
      priority: 0.7,
      changeFrequency: "daily" as const,
    })),
  ];
}
