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

    // The wishlist query can run at the same time as the auth verification.
    // RLS restricts wishlist_items to the current session owner.
    const [authResult, wishlistResult] = await Promise.all([
      client.auth.getUser(),
      client
        .from("wishlist_items")
        .select("product_id")
        .eq("product_id", safeProductId)
        .maybeSingle(),
    ]);

    const { data: auth, error: authError } = authResult;
    if (authError || !auth.user)
      return { authenticated: false, saved: false };

    return {
      authenticated: true,
      saved: !wishlistResult.error && Boolean(wishlistResult.data),
    };
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
      // The composite primary key makes this idempotent, so one upsert replaces
      // the old lookup-then-insert two-request sequence.
      const { error } = await client
        .from("wishlist_items")
        .upsert(
          { profile_id: user.id, product_id: productId },
          { onConflict: "profile_id,product_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    }

    // Wishlist state is personalized client UI, so changing it should not
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
