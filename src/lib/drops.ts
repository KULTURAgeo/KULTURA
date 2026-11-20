import type { Product } from "./catalog";

export function remainingPieces(product: Product) {
  return product.variants.reduce((total, variant) => total + Math.max(0, variant.stock), 0);
}

export function dropTime(value: string) {
  // datetime-local input is deliberately entered in Georgia time.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value + ":00+04:00");
  if (!Number.isFinite(date.getTime()) || dropTimeInput(date.toISOString()) !== value) return null;
  return date.toISOString();
}

export function dropTimeInput(utc: string) {
  return new Date(Date.parse(utc) + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
