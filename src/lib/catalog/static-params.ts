import "server-only";

import { unstable_cache } from "next/cache.js";
import { cache } from "react";
import { createCatalogClient } from "../supabase/server";
import {
  CATALOG_CACHE_TAG,
  CATALOG_REVALIDATE_SECONDS,
} from "./cache-config";

async function loadActiveProductSlugs(): Promise<string[]> {
  try {
    const client = createCatalogClient();
    if (!client) return [];

    const slugs: string[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("products")
        .select("slug")
        .eq("status", "active")
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      slugs.push(...data.map((row) => row.slug));
      if (data.length < 500) break;
    }
    return slugs;
  } catch {
    console.error(
      "[catalog] Product static params failed. Check server configuration and Supabase availability.",
    );
    return [];
  }
}

export const getActiveProductSlugs = cache(
  unstable_cache(loadActiveProductSlugs, ["catalog-product-slugs-v1"], {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAG],
  }),
);
