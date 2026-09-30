"use client";

import { lazy, Suspense } from "react";
import { useCart } from "./cart-provider";

const CartDrawer = lazy(() =>
  import("./cart-view").then((module) => ({ default: module.CartDrawer })),
);

export function LazyCartDrawer() {
  const cart = useCart();
  if (!cart.drawerOpen) return null;

  return (
    <Suspense fallback={null}>
      <CartDrawer />
    </Suspense>
  );
}
