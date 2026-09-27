export class InputError extends Error {
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function text(data: FormData, key: string, max: number, required = true): string {
    const value = data.get(key);
    if (typeof value !== "string") {
        if (!required && value === null)
            return "";
        throw new InputError(key + " is required.");
    }
    const result = value.trim();
    if ((required && !result) || result.length > max)
        throw new InputError(key + " must be " + (required ? "1–" : "at most ") + max + " characters.");
    return result;
}
export function id(value: unknown, label = "ID"): string {
    if (typeof value !== "string" || !UUID.test(value))
        throw new InputError("Invalid " + label + ".");
    return value;
}
export function integer(value: unknown, label: string, min = 0, max = 2147483647): number {
    if (typeof value !== "string" && typeof value !== "number")
        throw new InputError("Invalid " + label + ".");
    if (typeof value === "string" && !/^\d+$/.test(value))
        throw new InputError(label + " must be a whole number.");
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min || n > max)
        throw new InputError(label + " must be between " + min + " and " + max + ".");
    return n;
}
export function price(value: string): number {
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(value))
        throw new InputError("Enter a valid GEL price with at most two decimal places.");
    const [whole, fraction = ""] = value.split(".");
    const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    if (result > 2147483647)
        throw new InputError("Price is too large.");
    return result;
}
export function email(data: FormData): string {
    const value = text(data, "email", 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
        throw new InputError("Enter a valid email address.");
    return value;
}
export function password(data: FormData, strong = true): string {
    const value = data.get("password");
    if (typeof value !== "string" || value.length < (strong ? 12 : 1) || value.length > 128)
        throw new InputError(strong ? "Use a password of 12–128 characters." : "Enter your password.");
    if (strong && data.get("confirm_password") !== value)
        throw new InputError("Passwords do not match.");
    return value;
}
export function version(data: FormData): string {
    const value = text(data, "updated_at", 60);
    if (!/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value)))
        throw new InputError("Reload this record before saving.");
    return value;
}
export function safeNext(value: unknown): string {
    return typeof value === "string" && /^\/(account|admin)(\/[a-zA-Z0-9-]+)*$/.test(value) ? value : "/account";
}
export function productInput(data: FormData) {
    const slug = text(data, "slug", 160);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
        throw new InputError("Slug must contain lowercase letters, numbers and single hyphens.");
    const amount = price(text(data, "price", 20));
    const compare = text(data, "compare_at_price", 20, false);
    const comparePrice = compare ? price(compare) : null;
    if (comparePrice !== null && comparePrice < amount)
        throw new InputError("Compare-at price must be at least the selling price.");
    const status = text(data, "status", 20);
    if (status !== "active" && status !== "draft" && status !== "archived")
        throw new InputError("Choose a valid product status.");
    const collectionIds = [...new Set(data.getAll("collections").map(value => id(value, "collection")))];
    if (collectionIds.length > 100)
        throw new InputError("Too many collections.");
    return { product: { name: text(data, "name", 200), slug, description: text(data, "description", 10000, false), price: amount, compare_at_price: comparePrice, status, featured: data.get("featured") === "on", is_drop: data.get("is_drop") === "on", category_id: id(data.get("category_id"), "category"), seo_title: text(data, "seo_title", 200, false) || null, seo_description: text(data, "seo_description", 500, false) || null }, collectionIds };
}
export function variantInput(data: FormData) {
    const sku = text(data, "sku", 100);
    if (!/^[A-Z0-9][A-Z0-9_-]{0,99}$/.test(sku))
        throw new InputError("SKU must use uppercase letters, numbers, underscores or hyphens.");
    return { sku, size: text(data, "size", 40), color: text(data, "color", 80), stock_quantity: integer(data.get("stock_quantity"), "Stock", 0, 1000000), is_active: data.get("is_active") === "on" };
}
