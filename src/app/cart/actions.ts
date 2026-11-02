"use server";
import { refreshCartQuote } from "@/lib/cart/refresh";

export async function refreshCart(input: unknown) {
  return refreshCartQuote(input);
}
