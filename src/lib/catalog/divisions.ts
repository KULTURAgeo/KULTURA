export const SHOP_DIVISIONS = [
  { slug: "x", label: "X" },
  { slug: "y", label: "Y" },
  { slug: "unisex", label: "UNISEX" },
] as const;
export type ShopDivision = (typeof SHOP_DIVISIONS)[number]["slug"];
export function isShopDivision(value: string): value is ShopDivision {
  return value === "x" || value === "y" || value === "unisex";
}

export function shopCategorySlug(value: unknown): string | undefined {
  if (typeof value === "string" && value.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return value;
  }
}

export function shopHref(division?: ShopDivision, category?: string): string {
  const path = division ? "/shop/" + division : "/shop";
  return category ? path + "?category=" + encodeURIComponent(category) : path;
}
