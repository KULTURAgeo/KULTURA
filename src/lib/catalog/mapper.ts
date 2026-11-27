import type { Product } from "../catalog";
import { optionKey } from "../variant-options";
import type { Database } from "../supabase/database.types";
type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
type ImageRow = Pick<Row<"product_images">, "image_url" | "storage_path" | "alt_text" | "sort_position"> &
  Partial<Pick<Row<"product_images">, "color_id">>;
export type CatalogRow = Pick<
  Row<"products">,
  | "id"
  | "slug"
  | "name"
  | "price"
  | "compare_at_price"
  | "description"
  | "featured"
  | "is_drop"
  | "created_at"
  | "seo_title"
  | "seo_description"
> & {
  category: Pick<Row<"categories">, "name" | "slug"> | null;
  colors?: (Pick<Row<"product_colors">, "name" | "hex" | "sort_position"> &
    Partial<Pick<Row<"product_colors">, "id">>)[];
  variants: Pick<
    Row<"product_variants">,
    "id" | "sku" | "size" | "color" | "stock_quantity" | "is_active" | "sort_position"
  >[];
  images: ImageRow[];
};

export function productImageSource(image: Pick<ImageRow, "image_url" | "storage_path">, supabaseUrl?: string) {
  const bucket = supabaseUrl && supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/product-images/";
  const src = image.storage_path && bucket
    ? bucket + image.storage_path.split("/").map(encodeURIComponent).join("/")
    : image.image_url;
  if (!src) return null;
  // Only local catalog assets and this project's product-images bucket are rendered.
  const local = /^\/images\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|avif)$/.test(src);
  return local || (bucket && src.startsWith(bucket)) ? src : null;
}

export function mapProduct(row: CatalogRow, supabaseUrl?: string): Product {
  const colors = [...(row.colors ?? [])].sort((a, b) => a.sort_position - b.sort_position || a.name.localeCompare(b.name));
  const colorNames = new Map(colors.map((color) => [optionKey(color.name), color.name]));
  const imageColors = new Map(colors.map((color) => [color.id, color.name]));
  const images = [...row.images]
    .sort((a, b) => a.sort_position - b.sort_position)
    .flatMap((image, index) => {
      const src = productImageSource(image, supabaseUrl);
      if (!src) return [];
      const alt = image.alt_text?.trim();
      const name = row.name.trim().toLowerCase() === "lukachemia"
        ? `KULTURA ${row.category?.name ?? "collection"}` : row.name;
      const color = image.color_id ? imageColors.get(image.color_id) : undefined;
      return [{ src, alt: alt && alt.toLowerCase() !== "lukachemia" ? alt : `${name} — product photo ${index + 1}`,
        ...(color ? { color } : {}) }];
    });
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.price,
    compareAt: row.compare_at_price ?? undefined,
    category: row.category?.name ?? "Uncategorized",
    categorySlug: row.category?.slug ?? "uncategorized",
    image: images[0]?.src ?? "/images/product-placeholder.svg",
    images: images.length
      ? images
      : [
          {
            src: "/images/product-placeholder.svg",
            alt: "Product photograph coming soon",
          },
        ],
    colors: colors.map(({ name, hex }) => ({ name, hex })),
    description: row.description,
    featured: row.featured,
    drop: row.is_drop,
    createdAt: row.created_at,
    seoTitle: row.seo_title ?? undefined,
    seoDescription: row.seo_description ?? undefined,
    variants: [...row.variants]
      .filter((v) => v.is_active)
      .sort((a, b) => a.sort_position - b.sort_position)
      .map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: colorNames.get(optionKey(v.color)) ?? v.color,
        stock: v.stock_quantity,
      })),
  };
}
