"use client";
import { useEffect } from "react";
import { CART_KEY } from "@/lib/cart/model";

export function ClearCartAfterTestPayment() {
  useEffect(() => {
    try {
      localStorage.removeItem(CART_KEY);
      window.dispatchEvent(
        new StorageEvent("storage", { key: CART_KEY, newValue: null }),
      );
    } catch {
      // A successful payment should not be hidden just because storage is blocked.
    }
  }, []);
  return null;
}
