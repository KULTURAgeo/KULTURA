import { id, InputError, UUID } from "../validation";
import type { CartLine } from "../cart/model";

export function strictObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      Object.keys(value).some((key) => !keys.includes(key)))
    throw new InputError("Invalid request fields.");
  return value as Record<string, unknown>;
}

// Cart persistence may repair stale browser data. Submitted purchases must instead
// reject invalid quantities, duplicates and price/owner/status overrides.
export function checkoutLines(value: unknown): CartLine[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50)
    throw new InputError("Choose between 1 and 50 items.");
  const seen = new Set<string>();
  return value.map((entry) => {
    const line = strictObject(entry, ["productId", "variantId", "quantity"]);
    const productId = id(line.productId, "product").toLowerCase();
    const variantId = id(line.variantId, "variant").toLowerCase();
    const quantity = line.quantity;
    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99 || seen.has(variantId))
      throw new InputError("Invalid or duplicate item quantity.");
    seen.add(variantId);
    return { productId, variantId, quantity, size: "", color: "" };
  });
}

export const addressKeys = ["recipient_name", "phone", "city", "address_line_1", "address_line_2", "postal_code"];

export function cartRefreshLines(value: unknown): CartLine[] {
  if (!Array.isArray(value) || value.length > 50) throw new InputError("Invalid bag.");
  if (!value.length) return [];
  const entries = value.map((line) => strictObject(line, ["productId", "variantId", "quantity", "size", "color", "observedPrice"]));
  const lines = checkoutLines(entries.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })));
  return lines.map((line, index) => {
    const entry = entries[index];
    for (const field of ["size", "color"] as const)
      if (entry[field] !== undefined && (typeof entry[field] !== "string" || entry[field].length > 80)) throw new InputError("Invalid variant.");
    const observedPrice = entry.observedPrice;
    if (observedPrice !== undefined && (typeof observedPrice !== "number" || !Number.isSafeInteger(observedPrice) || observedPrice < 0 || observedPrice > 2147483647)) throw new InputError("Invalid bag.");
    return { ...line, size: typeof entry.size === "string" ? entry.size : "", color: typeof entry.color === "string" ? entry.color : "", observedPrice: observedPrice as number | undefined };
  });
}

export function strictForm(data: FormData, fields: readonly string[], repeated: readonly string[] = []) {
  if (!(data instanceof FormData)) throw new InputError("Invalid form.");
  const seen = new Set<string>();
  let count = 0;
  for (const [key, value] of data.entries()) {
    if (++count > 250) throw new InputError("Too many form fields.");
    // React's progressive-enhancement transport metadata is never application data.
    if (/^\$ACTION_(?:ID_[a-f0-9]+|REF_\d+|\d+:\d+|KEY)$/.test(key)) continue;
    const returnQuantity = fields.includes("return_item") && key.startsWith("return_quantity_") && UUID.test(key.slice(16));
    if ((!fields.includes(key) && !returnQuantity) || (seen.has(key) && !repeated.includes(key)))
      throw new InputError("Unexpected or duplicate form field.");
    if (typeof value === "string" && value.length > 10000) throw new InputError("Form field is too long.");
    if (typeof value !== "string" && key !== "image") throw new InputError("Unexpected file.");
    seen.add(key);
  }
}
