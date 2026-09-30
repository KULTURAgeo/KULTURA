"use client";

import dynamic from "next/dynamic";
import { useCart } from "./cart-provider";

const CartDrawer = dynamic(
  () => import("./cart-view").then((module) => module.CartDrawer),
  { ssr: false },
);

export function LazyCartDrawer() {
  const cart = useCart();
  return cart.drawerOpen ? <CartDrawer /> : null;
}
