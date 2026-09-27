"use server";
import { normalizeLines, quoteLines, type CartQuote } from "@/lib/cart/model";
import { getProductsByIds } from "@/lib/catalog/repository";
export async function refreshCart(input: unknown): Promise<{
    ok: true;
    quote: CartQuote;
} | {
    ok: false;
    message: string;
}> {
    const lines = normalizeLines(input);
    if (!lines.length)
        return { ok: true, quote: { lines: [], subtotal: 0 } };
    const result = await getProductsByIds([...new Set(lines.map(line => line.productId))]);
    if (result.status !== "ready")
        return { ok: false, message: "We cannot refresh your bag right now. Your saved items are safe; try again shortly." };
    return { ok: true, quote: quoteLines(lines, result.products) };
}
