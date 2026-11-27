"use server";

import { revalidatePath } from "next/cache";
import { safeFailure, type ActionState } from "@/lib/actions";
import { requireActionActor } from "@/lib/auth/guards";
import { invalidateStorefrontCatalog } from "@/lib/catalog/invalidate";
import { strictForm } from "@/lib/security/input";
import { id, InputError, text, version } from "@/lib/validation";

function refreshGallery(productId: string) {
  invalidateStorefrontCatalog();
  revalidatePath(`/admin/products/${productId}`);
}

export async function reorderGalleryPhotos(data: FormData): Promise<ActionState> {
  try {
    strictForm(data, ["product_id", "photo_id", "expected_id"], ["photo_id", "expected_id"]);
    const { client } = await requireActionActor(true);
    const productId = id(data.get("product_id"));
    const photoIds = data.getAll("photo_id").map((value) => id(value));
    const expectedIds = data.getAll("expected_id").map((value) => id(value));
    if (!photoIds.length || photoIds.length > 50 || photoIds.length !== expectedIds.length) {
      throw new InputError("The photo list is invalid. Reload the gallery and try again.");
    }
    const { error } = await client.rpc("admin_reorder_images", {
      p_product_id: productId,
      p_ids: photoIds,
      p_expected_ids: expectedIds,
    });
    if (error) throw error;
    refreshGallery(productId);
    return { ok: true, message: "Photo order saved." };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function saveGalleryPhotoDetails(data: FormData): Promise<ActionState & { updatedAt?: string }> {
  try {
    strictForm(data, ["product_id", "id", "updated_at", "alt_text", "color_id"], []);
    const { client } = await requireActionActor(true);
    const productId = id(data.get("product_id"));
    const colorId = data.get("color_id");
    const { data: saved, error } = await client.from("product_images")
      .update({ alt_text: text(data, "alt_text", 500, false) || null, color_id: colorId ? id(colorId) : null })
      .eq("id", id(data.get("id")))
      .eq("product_id", productId)
      .eq("updated_at", version(data))
      .select("updated_at")
      .single();
    if (error) throw error;
    refreshGallery(productId);
    return { ok: true, message: "Saved ✓", updatedAt: saved.updated_at };
  } catch (error) {
    return safeFailure(error);
  }
}
