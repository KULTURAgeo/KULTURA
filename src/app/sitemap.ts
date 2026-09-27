import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/lib/site";
import { getCatalog } from "@/lib/catalog/repository";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexable()) return [];
  const {products,categories,status} = await getCatalog();
  if (status !== "ready") throw new Error("Sitemap temporarily unavailable.");
  return ["/", "/shop", "/drops", "/about", "/contact",
    ...categories.map(c => "/shop/" + c.slug),
    ...products.map(p => "/product/" + p.slug),
  ].map(path => ({ url: new URL(path, siteUrl()).href }));
}
