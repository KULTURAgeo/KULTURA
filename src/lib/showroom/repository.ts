import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createCatalogClient } from "@/lib/supabase/server";
import { CATALOG_CACHE_TAG, CATALOG_REVALIDATE_SECONDS } from "@/lib/catalog/cache-config";
import { isShowroomNotInstalled, MAX_SHOWROOM_ITEMS, SHOWROOM_CACHE_TAG, showroomImage, type ShowroomCard } from "./model";

const productColumns = "id,name,slug,status,category_id,product_images(image_url,storage_path,sort_position)" as const;

export async function loadHomepageShowroom(): Promise<ShowroomCard[] | undefined> {
  const client = createCatalogClient();
  if (!client) return undefined;
  const { data: settings, error: settingsError } = await client
    .from("homepage_showroom_settings").select("use_custom_items").eq("singleton", true).maybeSingle();
  if (isShowroomNotInstalled(settingsError)) return undefined;
  if (settingsError) {
    console.error("[showroom] Settings unavailable.");
    return undefined;
  }
  if (!settings?.use_custom_items) return undefined;

  const { data: items, error } = await client.from("homepage_showroom_items")
    .select("*").eq("is_active", true).order("sort_position").order("id").limit(MAX_SHOWROOM_ITEMS);
  if (error) {
    console.error("[showroom] Cards unavailable.");
    return [];
  }
  if (!items.length) return [];

  const productIds = [...new Set(items.flatMap(item => [item.product_id, item.image_product_id]).filter((id): id is string => Boolean(id)))];
  const categoryIds = [...new Set(items.flatMap(item => item.category_id ? [item.category_id] : []))];
  const [productResult, categoryResult] = await Promise.all([
    productIds.length ? client.from("products").select(productColumns).eq("status", "active").in("id", productIds) : Promise.resolve({ data: [], error: null }),
    categoryIds.length ? client.from("categories").select("id,name,slug,description").eq("is_active", true).in("id", categoryIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (productResult.error || categoryResult.error) return [];

  const products = new Map(productResult.data.map(product => [product.id, product]));
  const categories = new Map(categoryResult.data.map(category => [category.id, category]));
  const sourceCategories = [...new Set(productResult.data.map(product => product.category_id))];
  const { data: activeCategories, error: activeError } = sourceCategories.length
    ? await client.from("categories").select("id").eq("is_active", true).in("id", sourceCategories)
    : { data: [], error: null };
  if (activeError) return [];
  const activeCategoryIds = new Set(activeCategories.map(category => category.id));
  const cards: ShowroomCard[] = [];

  for (const item of items) {
    const product = item.product_id ? products.get(item.product_id) : undefined;
    const category = item.category_id ? categories.get(item.category_id) : undefined;
    if (item.source_kind === "product" && (!product || !activeCategoryIds.has(product.category_id))) continue;
    if (item.source_kind === "category" && !category) continue;

    const selectedImage = item.image_product_id ? products.get(item.image_product_id) : undefined;
    let image = selectedImage && activeCategoryIds.has(selectedImage.category_id)
      ? showroomImage(selectedImage.product_images, process.env.SUPABASE_URL)
      : null;
    if (!image && product) image = showroomImage(product.product_images, process.env.SUPABASE_URL);
    if (!image && category) {
      const result = await client.from("products").select(productColumns)
        .eq("status", "active").eq("category_id", category.id)
        .order("featured", { ascending: false }).order("created_at", { ascending: false }).order("id").limit(12);
      if (result.error) continue;
      for (const candidate of result.data) {
        image = showroomImage(candidate.product_images, process.env.SUPABASE_URL);
        if (image) break;
      }
    }
    const name = product?.name ?? category!.name;
    const title = item.title || name;
    cards.push({
      id: item.id,
      title,
      titleKa: item.title_ka || title,
      description: item.description || category?.description.slice(0, 500) || "",
      descriptionKa: item.description_ka || item.description || category?.description.slice(0, 500) || "",
      image,
      imageAlt: title,
      href: product ? `/product/${product.slug}` : `/shop/${category!.slug}`,
      kind: product ? "product" : "category",
    });
  }
  return cards;
}

export const getHomepageShowroom = cache(unstable_cache(loadHomepageShowroom, ["homepage-showroom-v1"], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: [SHOWROOM_CACHE_TAG, CATALOG_CACHE_TAG],
}));
