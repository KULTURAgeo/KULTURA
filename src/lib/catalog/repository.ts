import "server-only";
import { unstable_cache } from "next/cache.js";
import { cache } from "react";
import { createCatalogClient } from "../supabase/server";
import { mapProduct } from "./mapper";
import type { Category, Product } from "../catalog";
import {
  CATALOG_CACHE_TAG,
  CATALOG_REVALIDATE_SECONDS,
} from "./cache-config";

export type CatalogStatus = "ready" | "unconfigured" | "unavailable";
export type CatalogResult = {
  status: CatalogStatus;
  products: Product[];
  categories: Category[];
};
export type ShopCategory = Category & { count: number };

type CatalogClient = NonNullable<ReturnType<typeof createCatalogClient>>;
type ProductFilters = {
  categoryId?: string;
  excludeCategoryId?: string;
  excludeSlug?: string;
  featured?: boolean;
  drop?: boolean;
  limit?: number;
};

const productSelect = `
 id,slug,name,price,compare_at_price,description,featured,is_drop,created_at,seo_title,seo_description,
 category:categories!inner(name,slug),
 variants:product_variants(id,sku,size,color,stock_quantity,is_active,sort_position),
 images:product_images(image_url,storage_path,alt_text,sort_position)
` as const;

function reportFailure(operation: string) {
  // Do not log raw SDK exceptions: they can carry request headers or sensitive URLs.
  console.error(
    "[catalog] " +
      operation +
      " failed. Check server configuration and Supabase availability.",
  );
}

async function loadProducts(
  client: CatalogClient,
  filters: ProductFilters = {},
): Promise<Product[]> {
  const products: Product[] = [];
  const maximum = filters.limit ?? Number.POSITIVE_INFINITY;

  for (let offset = 0; offset < maximum; offset += 100) {
    const pageSize = Math.min(100, maximum - offset);
    let query = client
      .from("products")
      .select(productSelect)
      .eq("status", "active");

    if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
    if (filters.excludeCategoryId)
      query = query.neq("category_id", filters.excludeCategoryId);
    if (filters.excludeSlug) query = query.neq("slug", filters.excludeSlug);
    if (filters.featured !== undefined)
      query = query.eq("featured", filters.featured);
    if (filters.drop !== undefined) query = query.eq("is_drop", filters.drop);

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    products.push(
      ...data.map((row) => mapProduct(row, process.env.SUPABASE_URL)),
    );
    if (data.length < pageSize) break;
  }

  return products;
}

async function loadCategories(client: CatalogClient) {
  const categories: { id: string; name: string; slug: string }[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client
      .from("categories")
      .select("id,name,slug")
      .eq("is_active", true)
      .order("sort_position")
      .order("id")
      .range(offset, offset + 99);
    if (error) throw error;
    categories.push(...data);
    if (data.length < 100) break;
  }
  return categories;
}

const loadHomepageCatalog = async (): Promise<CatalogResult> => {
  try {
    const client = createCatalogClient();
    if (!client)
      return { status: "unconfigured", products: [], categories: [] };

    const [categoriesWithIds, featured] = await Promise.all([
      loadCategories(client),
      loadProducts(client, { featured: true, limit: 7 }),
    ]);
    const products = featured.length
      ? featured
      : await loadProducts(client, { limit: 7 });

    return {
      status: "ready",
      products,
      categories: categoriesWithIds.map(({ name, slug }) => ({ name, slug })),
    };
  } catch {
    reportFailure("Homepage listing");
    return { status: "unavailable", products: [], categories: [] };
  }
};

const loadShopCategories = async (): Promise<{
  status: CatalogStatus;
  categories: ShopCategory[];
}> => {
  try {
    const client = createCatalogClient();
    if (!client) return { status: "unconfigured", categories: [] };

    const [categories, productRows] = await Promise.all([
      loadCategories(client),
      client.from("products").select("category_id").eq("status", "active"),
    ]);
    if (productRows.error) throw productRows.error;

    const counts = new Map<string, number>();
    for (const row of productRows.data) {
      if (!row.category_id) continue;
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }

    return {
      status: "ready",
      categories: categories.map(({ id, name, slug }) => ({
        name,
        slug,
        count: counts.get(id) ?? 0,
      })),
    };
  } catch {
    reportFailure("Shop categories");
    return { status: "unavailable", categories: [] };
  }
};

const loadDropProducts = async (): Promise<{
  status: CatalogStatus;
  products: Product[];
}> => {
  try {
    const client = createCatalogClient();
    if (!client) return { status: "unconfigured", products: [] };
    return { status: "ready", products: await loadProducts(client, { drop: true }) };
  } catch {
    reportFailure("Drop listing");
    return { status: "unavailable", products: [] };
  }
};

const loadCategoryCatalog = async (
  slug: string,
): Promise<{
  status: CatalogStatus;
  category: Category | null;
  products: Product[];
}> => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    return { status: "ready", category: null, products: [] };

  try {
    const client = createCatalogClient();
    if (!client)
      return { status: "unconfigured", category: null, products: [] };

    const categories = await loadCategories(client);
    const selected = categories.find((category) => category.slug === slug);
    if (!selected) return { status: "ready", category: null, products: [] };

    return {
      status: "ready",
      category: { name: selected.name, slug: selected.slug },
      products: await loadProducts(client, { categoryId: selected.id }),
    };
  } catch {
    reportFailure("Category listing");
    return { status: "unavailable", category: null, products: [] };
  }
};

const loadRelatedProducts = async (
  categorySlug: string,
  excludeSlug: string,
  limit = 4,
): Promise<Product[]> => {
  try {
    const client = createCatalogClient();
    if (!client) return [];
    const categories = await loadCategories(client);
    const selected = categories.find((category) => category.slug === categorySlug);
    const safeLimit = Math.max(1, Math.min(limit, 8));

    if (!selected)
      return loadProducts(client, { excludeSlug, limit: safeLimit });

    const sameCategory = await loadProducts(client, {
      categoryId: selected.id,
      excludeSlug,
      limit: safeLimit,
    });
    if (sameCategory.length >= safeLimit) return sameCategory;

    const others = await loadProducts(client, {
      excludeCategoryId: selected.id,
      excludeSlug,
      limit: safeLimit - sameCategory.length,
    });
    return [...sameCategory, ...others];
  } catch {
    reportFailure("Related products");
    return [];
  }
};

const cacheOptions = {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: [CATALOG_CACHE_TAG],
};

export const getHomepageCatalog = cache(
  unstable_cache(loadHomepageCatalog, ["catalog-home-v1"], cacheOptions),
);
export const getShopCategories = cache(
  unstable_cache(loadShopCategories, ["catalog-shop-categories-v1"], cacheOptions),
);
export const getDropProducts = cache(
  unstable_cache(loadDropProducts, ["catalog-drops-v1"], cacheOptions),
);
export const getCategoryCatalog = cache(
  unstable_cache(loadCategoryCatalog, ["catalog-category-v1"], cacheOptions),
);
export const getRelatedProducts = cache(
  unstable_cache(loadRelatedProducts, ["catalog-related-v1"], cacheOptions),
);

// Full catalog remains available for internal/tests and fresh callers. Public pages
// use the smaller cached functions above so we do not serialize or query unused data.
export const getCatalog = cache(async (): Promise<CatalogResult> => {
  try {
    const client = createCatalogClient();
    if (!client)
      return { status: "unconfigured", products: [], categories: [] };
    const [products, categoriesWithIds] = await Promise.all([
      loadProducts(client),
      loadCategories(client),
    ]);
    return {
      status: "ready",
      products,
      categories: categoriesWithIds.map(({ name, slug }) => ({ name, slug })),
    };
  } catch {
    reportFailure("Listing");
    return { status: "unavailable", products: [], categories: [] };
  }
});

export const getProductBySlug = cache(
  async (
    slug: string,
  ): Promise<{ status: CatalogStatus; product: Product | null }> => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
      return { status: "ready", product: null };
    try {
      const client = createCatalogClient();
      if (!client) return { status: "unconfigured", product: null };
      const { data, error } = await client
        .from("products")
        .select(productSelect)
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return {
        status: "ready",
        product: data ? mapProduct(data, process.env.SUPABASE_URL) : null,
      };
    } catch {
      reportFailure("Product detail");
      return { status: "unavailable", product: null };
    }
  },
);

// Cart validation intentionally bypasses the storefront cache: price and stock
// must always be checked against current trusted values before checkout.
export async function getProductsByIds(
  ids: string[],
): Promise<{ status: CatalogStatus; products: Product[] }> {
  try {
    const client = createCatalogClient();
    if (!client) return { status: "unconfigured", products: [] };
    if (!ids.length) return { status: "ready", products: [] };
    const { data, error } = await client
      .from("products")
      .select(productSelect)
      .in("id", ids.slice(0, 50))
      .eq("status", "active");
    if (error) throw error;
    return {
      status: "ready",
      products: data.map((row) => mapProduct(row, process.env.SUPABASE_URL)),
    };
  } catch {
    return { status: "unavailable", products: [] };
  }
}
