"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { refreshCart } from "@/app/cart/actions";
import { CART_KEY, addLine, changeQuantity, removeLine, readStoredCart, type CartLine, type CartQuote } from "@/lib/cart/model";
type CartContextValue = {
    quote: CartQuote;
    count: number;
    busy: boolean;
    ready: boolean;
    error: string;
    drawerOpen: boolean;
    open: () => void;
    close: () => void;
    add: (line: CartLine) => Promise<boolean>;
    setQuantity: (id: string, n: number) => Promise<boolean>;
    remove: (id: string) => Promise<boolean>;
    refresh: () => Promise<boolean>;
    clear: () => void;
};
const CartContext = createContext<CartContextValue | null>(null);
export function CartProvider({ children }: {
    children: React.ReactNode;
}) {
    const stored = useRef<CartLine[]>([]);
    const lock = useRef(false);
    const [count, setCount] = useState(0);
    const [quote, setQuote] = useState<CartQuote>({ lines: [], subtotal: 0 });
    const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [drawerOpen, setDrawerOpen] = useState(false);
    const persist = useCallback((lines: CartLine[]) => {
        stored.current = lines;
        setCount(lines.reduce((sum, line) => sum + line.quantity, 0));
        try {
            const serialized = JSON.stringify({ version: 1, items: lines });
            if (localStorage.getItem(CART_KEY) !== serialized)
                localStorage.setItem(CART_KEY, serialized);
        }
        catch {
            setError("Browser storage is unavailable. Your bag will last only for this visit.");
        }
    }, []);
    const resolve = useCallback(async (lines: CartLine[]) => {
        if (lock.current)
            return false;
        lock.current = true;
        setBusy(true);
        setError("");
        try {
            const result = await refreshCart(lines);
            if (!result.ok) {
                setError(result.message);
                return false;
            }
            setQuote(result.quote);
            persist(result.quote.lines.map(line => ({ productId: line.productId, variantId: line.variantId, size: line.size, color: line.color, quantity: line.quantity, observedPrice: line.available ? line.price : line.observedPrice })));
            return true;
        }
        catch {
            setError("We could not refresh your bag. Please try again.");
            return false;
        }
        finally {
            lock.current = false;
            setBusy(false);
            setReady(true);
        }
    }, [persist]);
    useEffect(() => {
        try {
            stored.current = readStoredCart(localStorage.getItem(CART_KEY));
        }
        catch {
            stored.current = [];
        }
        setCount(stored.current.reduce((sum, line) => sum + line.quantity, 0));
        void resolve(stored.current);
        const sync = (event: StorageEvent) => { if (event.key === CART_KEY && !lock.current) {
            stored.current = readStoredCart(event.newValue);
            void resolve(stored.current);
        } };
        const focus = () => { if (!lock.current)
            void resolve(stored.current); };
        window.addEventListener("storage", sync);
        window.addEventListener("focus", focus);
        return () => { window.removeEventListener("storage", sync); window.removeEventListener("focus", focus); };
    }, [resolve]);
    const add = async (line: CartLine) => {
        if (lock.current)
            return false;
        const next = addLine(stored.current, line);
        if (next === stored.current) {
            setError("Your bag is full or the selection is invalid.");
            return false;
        }
        const ok = await resolve(next);
        if (ok)
            setDrawerOpen(true);
        return ok;
    };
    const remove = async (id: string) => {
        if (lock.current)
            return false;
        // Removing local intent does not require a network connection.
        const next = removeLine(stored.current, id);
        persist(next);
        setQuote(current => { const lines = current.lines.filter(line => line.variantId !== id); return { lines, subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0) }; });
        return true;
    };
    const clear = () => {
        persist([]);
        setQuote({ lines: [], subtotal: 0 });
        setError("");
        setDrawerOpen(false);
    };
    return <CartContext.Provider value={{ quote, count, busy, ready, error, drawerOpen, open: () => { setDrawerOpen(true); void resolve(stored.current); }, close: () => setDrawerOpen(false), add, setQuantity: (id, n) => resolve(changeQuantity(stored.current, id, n)), remove, refresh: () => resolve(stored.current), clear }}>{children}</CartContext.Provider>;
}
export function useCart() { const cart = useContext(CartContext); if (!cart)
    throw new Error("Cart provider is missing."); return cart; }
