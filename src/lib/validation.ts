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
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new InputError("Invalid text characters.");
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
    if (typeof value !== "string")
        return "/account";
    if (value === "/checkout" || value === "/checkout/review")
        return value;
    return /^\/(account|admin)(\/[a-zA-Z0-9-]+)*$/.test(value) ? value : "/account";
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

function optionalMoney(data: FormData, key: string): number | null {
    const raw = text(data, key, 20, false);
    return raw ? price(raw) : null;
}

function utcDateTime(data: FormData, key: string): string | null {
    const raw = text(data, key, 30, false);
    if (!raw)
        return null;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw))
        throw new InputError("Enter a valid UTC date and time.");
    const value = new Date(raw + ":00Z");
    if (!Number.isFinite(value.getTime()))
        throw new InputError("Enter a valid UTC date and time.");
    return value.toISOString();
}

export function promoInput(data: FormData) {
    const code = text(data, "code", 50).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,49}$/.test(code))
        throw new InputError("Promo code may use uppercase letters, numbers, underscores and hyphens.");

    const kind = text(data, "kind", 20);
    if (kind !== "fixed" && kind !== "percentage")
        throw new InputError("Choose a valid discount type.");

    const amount = price(text(data, "amount", 20));
    if (amount <= 0)
        throw new InputError("Discount amount must be greater than zero.");
    if (kind === "percentage" && amount > 10000)
        throw new InputError("Percentage discount cannot exceed 100%.");

    const minimumSubtotal = optionalMoney(data, "minimum_subtotal") ?? 0;
    const maximumDiscount = optionalMoney(data, "maximum_discount");
    if (maximumDiscount !== null && maximumDiscount <= 0)
        throw new InputError("Maximum discount must be greater than zero.");

    const maxUsesRaw = text(data, "max_uses", 12, false);
    const maxUses = maxUsesRaw ? integer(maxUsesRaw, "Maximum uses", 1, 1000000000) : null;

    const startsAt = utcDateTime(data, "starts_at");
    const expiresAt = utcDateTime(data, "expires_at");
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt))
        throw new InputError("Expiry must be later than the start time.");

    return {
        code,
        kind,
        amount,
        currency: kind === "fixed" ? "GEL" : null,
        minimum_subtotal: minimumSubtotal,
        maximum_discount: maximumDiscount,
        starts_at: startsAt,
        expires_at: expiresAt,
        max_uses: maxUses,
        is_active: data.get("is_active") === "on",
    };
}
