import type { Product } from "../catalog";
import { optionKey } from "../variant-options";
import type { Database } from "../supabase/database.types";
type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
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
  colors?: Pick<Row<"product_colors">, "name" | "hex" | "sort_position">[];
  variants: Pick<
    Row<"product_variants">,
    "id" | "sku" | "size" | "color" | "stock_quantity" | "is_active" | "sort_position"
  >[];
  images: Pick<
    Row<"product_images">,
    "image_url" | "storage_path" | "alt_text" | "sort_position"
  >[];
};
export function mapProduct(row: CatalogRow, supabaseUrl?: string): Product {
  const colors = [...(row.colors ?? [])].sort((a, b) => a.sort_position - b.sort_position || a.name.localeCompare(b.name));
  const colorNames = new Map(colors.map((color) => [optionKey(color.name), color.name]));
  const images = [...row.images]
    .sort((a, b) => a.sort_position - b.sort_position)
    .flatMap((image, index) => {
      let src = image.image_url;
      if (image.storage_path && supabaseUrl)
        src =
          supabaseUrl.replace(/\/$/, "") +
          "/storage/v1/object/public/product-images/" +
          image.storage_path.split("/").map(encodeURIComponent).join("/");
      if (!src) return [];
      // Only local catalog assets and this project's product-images bucket are rendered.
      const local =
        /^\/images\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|avif)$/.test(src);
      const storage = supabaseUrl
        ? src.startsWith(
            supabaseUrl.replace(/\/$/, "") +
              "/storage/v1/object/public/product-images/",
          )
        : false;
      if (!local && !storage) return [];
      const alt = image.alt_text?.trim();
      const name = row.name.trim().toLowerCase() === "lukachemia"
        ? `KULTURA ${row.category?.name ?? "collection"}` : row.name;
      return [{ src, alt: alt && alt.toLowerCase() !== "lukachemia" ? alt : `${name} — product photo ${index + 1}` }];
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
