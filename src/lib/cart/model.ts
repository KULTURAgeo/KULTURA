import { UUID } from "../validation";
import type { Product } from "../catalog";
export const CART_KEY = "kultura.cart.v1";
export const MAX_QUANTITY = 99;
export const MAX_LINES = 50;
export type CartLine = {
    productId: string;
    variantId: string;
    size: string;
    color: string;
    quantity: number;
    observedPrice?: number;
};
export type QuotedLine = CartLine & {
    name: string;
    slug: string;
    image: string;
    price: number;
    stock: number;
    available: boolean;
    lineTotal: number;
    notice?: string;
};
export type CartQuote = {
    lines: QuotedLine[];
    subtotal: number;
};
export function normalizeLines(input: unknown): CartLine[] {
    if (!Array.isArray(input))
        return [];
    const result = new Map<string, CartLine>();
    for (const raw of input.slice(0, MAX_LINES)) {
        if (typeof raw !== "object" || raw === null)
            continue;
        const v: Record<string, unknown> = raw;
        if (typeof v.productId !== "string" || !UUID.test(v.productId) || typeof v.variantId !== "string" || !UUID.test(v.variantId) || typeof v.quantity !== "number" || !Number.isInteger(v.quantity) || v.quantity < 1 || v.quantity > MAX_QUANTITY)
            continue;
        const key = v.variantId.toLowerCase(), existing = result.get(key);
        result.set(key, { productId: v.productId.toLowerCase(), variantId: key, size: typeof v.size === "string" ? v.size.slice(0, 40) : "", color: typeof v.color === "string" ? v.color.slice(0, 80) : "", quantity: Math.min(MAX_QUANTITY, (existing?.quantity ?? 0) + v.quantity), observedPrice: typeof v.observedPrice === "number" && Number.isSafeInteger(v.observedPrice) && v.observedPrice >= 0 ? v.observedPrice : undefined });
    }
    return [...result.values()];
}
export function readStoredCart(raw: string | null): CartLine[] {
    if (!raw || raw.length > 30000)
        return [];
    try {
        const data: unknown = JSON.parse(raw);
        return typeof data === "object" && data !== null && "version" in data && data.version === 1 && "items" in data ? normalizeLines(data.items) : [];
    }
    catch {
        return [];
    }
}
export function changeQuantity(lines: CartLine[], variantId: string, quantity: number): CartLine[] {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY)
        return lines;
    return lines.map(line => line.variantId === variantId ? { ...line, quantity } : line);
}
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
    if (!normalizeLines([line]).length)
        return lines;
    if (!lines.some(item => item.variantId === line.variantId) && lines.length >= MAX_LINES)
        return lines;
    const existing = lines.find(item => item.variantId === line.variantId);
    return existing ? changeQuantity(lines, line.variantId, Math.min(MAX_QUANTITY, existing.quantity + line.quantity)) : [...lines, line];
}
export function removeLine(lines: CartLine[], variantId: string) { return lines.filter(line => line.variantId !== variantId); }
export function quoteLines(input: CartLine[], products: Product[]): CartQuote {
    const lines = input.map((line): QuotedLine => {
        const p = products.find(p => p.id === line.productId);
        const variant = p?.variants.find(v => v.id === line.variantId);
        if (!p || !variant)
            return { ...line, name: "Unavailable item", slug: "", image: "/images/product-placeholder.svg", price: 0, stock: 0, available: false, lineTotal: 0, notice: "This item is no longer available. Remove it from your bag." };
        const available = variant.stock > 0;
        const quantity = available ? Math.min(line.quantity, variant.stock, MAX_QUANTITY) : line.quantity;
        const notices: string[] = [];
        if (!available)
            notices.push("This variant is sold out.");
        if (available && quantity < line.quantity)
            notices.push("Stock changed. Quantity adjusted to " + quantity + ".");
        if (line.observedPrice !== undefined && line.observedPrice !== p.price)
            notices.push("The price has changed. Your bag now shows the current price.");
        return { ...line, quantity, size: variant.size, color: variant.color, name: p.name, slug: p.slug, image: p.image, price: p.price, stock: variant.stock, available, lineTotal: available ? p.price * quantity : 0, notice: notices.join(" ") || undefined };
    });
    return { lines, subtotal: lines.reduce((total, line) => total + line.lineTotal, 0) };
}
