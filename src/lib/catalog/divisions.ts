export const SHOP_DIVISIONS = [
  { slug: "x", label: "X" },
  { slug: "y", label: "Y" },
  { slug: "unisex", label: "UNISEX" },
] as const;
export type ShopDivision = (typeof SHOP_DIVISIONS)[number]["slug"];
export function isShopDivision(value: string): value is ShopDivision {
  return value === "x" || value === "y" || value === "unisex";
}
