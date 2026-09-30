"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth/guards";
import { createSessionClient } from "@/lib/supabase/session";
import { id, InputError, text } from "@/lib/validation";
import { safeFailure, type ActionState } from "@/lib/actions";

export type WishlistState = {
  authenticated: boolean;
  saved: boolean;
};

export async function getWishlistState(productId: string): Promise<WishlistState> {
  try {
    const safeProductId = id(productId, "product");
    const client = await createSessionClient();
    if (!client) return { authenticated: false, saved: false };

    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user)
      return { authenticated: false, saved: false };

    const { data, error } = await client
      .from("wishlist_items")
      .select("product_id")
      .eq("profile_id", auth.user.id)
      .eq("product_id", safeProductId)
      .maybeSingle();
    if (error) return { authenticated: true, saved: false };

    return { authenticated: true, saved: Boolean(data) };
  } catch {
    return { authenticated: false, saved: false };
  }
}

export async function setWishlist(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  try {
    const { client, user } = await requireActor();
    const productId = id(data.get("product_id"), "product");
    const slug = text(data, "product_slug", 160);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
      throw new InputError("Invalid product.");
    const mode = text(data, "mode", 10);
    if (mode !== "add" && mode !== "remove")
      throw new InputError("Invalid wishlist action.");

    if (mode === "remove") {
      const { error } = await client
        .from("wishlist_items")
        .delete()
        .eq("profile_id", user.id)
        .eq("product_id", productId);
      if (error) throw error;
    } else {
      const { data: existing, error: lookupError } = await client
        .from("wishlist_items")
        .select("product_id")
        .eq("profile_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!existing) {
        const { error } = await client.from("wishlist_items").insert({
          profile_id: user.id,
          product_id: productId,
        });
        if (error) throw error;
      }
    }

    // Wishlist state is now personalized client UI, so changing it should not
    // invalidate the shared static product page cache.
    revalidatePath("/account/wishlist");
    return {
      ok: true,
      message:
        mode === "add"
          ? "Saved to your wishlist."
          : "Removed from your wishlist.",
    };
  } catch (error) {
    return safeFailure(error);
  }
}
