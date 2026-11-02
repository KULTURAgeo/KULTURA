"use server";
import { protectAction } from "@/lib/security/request";
import { safeFailure } from "@/lib/actions";
import { quoteLines, type CartQuote } from "@/lib/cart/model";
import { cartRefreshLines } from "@/lib/security/input";
import { getProductsByIds } from "@/lib/catalog/repository";
export async function refreshCart(input: unknown): Promise<{
    ok: true;
    quote: CartQuote;
} | {
    ok: false;
    message: string;
}> {
    let lines;
    try { await protectAction("cart"); lines = cartRefreshLines(input); } catch (error) { return {ok:false, message: safeFailure(error).message ?? "Please try again shortly."}; }
    if (!lines.length)
        return { ok: true, quote: { lines: [], subtotal: 0 } };
    const result = await getProductsByIds([...new Set(lines.map(line => line.productId))]);
    if (result.status !== "ready")
        return { ok: false, message: "We cannot refresh your bag right now. Your saved items are safe; try again shortly." };
    return { ok: true, quote: quoteLines(lines, result.products) };
}
