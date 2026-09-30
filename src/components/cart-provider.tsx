"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { refreshCart } from "@/app/cart/actions";
import {
  CART_KEY,
  addLine,
  changeQuantity,
  removeLine,
  readStoredCart,
  type CartLine,
  type CartQuote,
} from "@/lib/cart/model";

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

const EMPTY_QUOTE: CartQuote = { lines: [], subtotal: 0 };
const FOCUS_REFRESH_INTERVAL = 30_000;
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const stored = useRef<CartLine[]>([]);
  const lock = useRef(false);
  const lastServerRefresh = useRef(0);
  const [count, setCount] = useState(0);
  const [quote, setQuote] = useState<CartQuote>(EMPTY_QUOTE);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const persist = useCallback((lines: CartLine[]) => {
    stored.current = lines;
    setCount(lines.reduce((sum, line) => sum + line.quantity, 0));
    try {
      const serialized = JSON.stringify({ version: 1, items: lines });
      if (localStorage.getItem(CART_KEY) !== serialized)
        localStorage.setItem(CART_KEY, serialized);
    } catch {
      setError(
        "Browser storage is unavailable. Your bag will last only for this visit.",
      );
    }
  }, []);

  const resolve = useCallback(
    async (lines: CartLine[]) => {
      if (lock.current) return false;

      if (!lines.length) {
        persist([]);
        setQuote(EMPTY_QUOTE);
        setError("");
        setBusy(false);
        setReady(true);
        return true;
      }

      lock.current = true;
      setBusy(true);
      setError("");
      try {
        const result = await refreshCart(lines);
        if (!result.ok) {
          setError(result.message);
          return false;
        }
        lastServerRefresh.current = Date.now();
        setQuote(result.quote);
        persist(
          result.quote.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            size: line.size,
            color: line.color,
            quantity: line.quantity,
            observedPrice: line.available ? line.price : line.observedPrice,
          })),
        );
        return true;
      } catch {
        setError("We could not refresh your bag. Please try again.");
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
        setReady(true);
      }
    },
    [persist],
  );

  const refresh = useCallback(() => resolve(stored.current), [resolve]);

  useEffect(() => {
    try {
      stored.current = readStoredCart(localStorage.getItem(CART_KEY));
    } catch {
      stored.current = [];
    }

    setCount(stored.current.reduce((sum, line) => sum + line.quantity, 0));
    if (stored.current.length) {
      // Keep the global shell fast. Product/stock validation is deferred until
      // the user opens the bag or mounts a cart UI that actually needs a quote.
      setReady(false);
      setQuote(EMPTY_QUOTE);
    } else {
      setReady(true);
      setQuote(EMPTY_QUOTE);
    }

    const sync = (event: StorageEvent) => {
      if (event.key !== CART_KEY || lock.current) return;
      stored.current = readStoredCart(event.newValue);
      setCount(stored.current.reduce((sum, line) => sum + line.quantity, 0));
      setQuote(EMPTY_QUOTE);
      setError("");
      setReady(!stored.current.length);
    };

    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const add = async (line: CartLine) => {
    if (lock.current) return false;
    const next = addLine(stored.current, line);
    if (next === stored.current) {
      setError("Your bag is full or the selection is invalid.");
      return false;
    }
    const ok = await resolve(next);
    if (ok) setDrawerOpen(true);
    return ok;
  };

  const remove = async (id: string) => {
    if (lock.current) return false;
    const next = removeLine(stored.current, id);
    persist(next);
    setQuote((current) => {
      const lines = current.lines.filter((line) => line.variantId !== id);
      return {
        lines,
        subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0),
      };
    });
    return true;
  };

  const clear = () => {
    persist([]);
    setQuote(EMPTY_QUOTE);
    setError("");
    setReady(true);
    setDrawerOpen(false);
  };

  const open = () => {
    setDrawerOpen(true);
    if (
      stored.current.length &&
      (!ready || Date.now() - lastServerRefresh.current >= FOCUS_REFRESH_INTERVAL)
    )
      void resolve(stored.current);
  };

  return (
    <CartContext.Provider
      value={{
        quote,
        count,
        busy,
        ready,
        error,
        drawerOpen,
        open,
        close: () => setDrawerOpen(false),
        add,
        setQuantity: (id, n) => resolve(changeQuantity(stored.current, id, n)),
        remove,
        refresh,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("Cart provider is missing.");
  return cart;
}
