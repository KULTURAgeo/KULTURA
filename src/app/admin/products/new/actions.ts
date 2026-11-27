"use server";
import { strictForm } from "@/lib/security/input";
import { resolveAudienceCollections } from "@/lib/admin/audience";

import { revalidatePath } from "next/cache";
import { requireActionActor } from "@/lib/auth/guards";
import { productInput, text, InputError } from "@/lib/validation";
import { safeFailure, type ActionState } from "@/lib/actions";
import { attachProductPhotos, prepareProductPhotos } from "@/lib/admin/image";
import { invalidateStorefrontCatalog } from "@/lib/catalog/invalidate";

function refreshCatalog() {
  invalidateStorefrontCatalog();
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/products");
}

export async function createProductWithImage(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  try {
    strictForm(data, ["name", "slug", "description", "price", "compare_at_price", "status", "featured", "is_drop", "category_id", "seo_title", "seo_description", "collections", "audience", "image", "image_alt_text", "id", "updated_at"], ["collections", "image"]);
    const { client } = await requireActionActor(true);
    const { product, collectionIds } = productInput(data);
    const audienceCollectionIds = await resolveAudienceCollections(client, data, collectionIds);
    const photos = await prepareProductPhotos(data);
    const imageAlt = text(data, "image_alt_text", 500, false);

    const { data: productId, error } = await client.rpc("admin_save_product", {
      p_id: null,
      p_expected_updated_at: null,
      p_product: product,
      p_collection_ids: audienceCollectionIds,
    });

    if (error) throw error;
    if (!productId) throw new InputError("Product could not be created.");

    const { uploaded } = photos.length ? await attachProductPhotos(client, productId, photos, imageAlt) : { uploaded: 0 };
    refreshCatalog();
    return {
      ok: true,
      message: uploaded ? `Product created with ${uploaded} ${uploaded === 1 ? "photo" : "photos"}.` : "Product created.",
      redirectTo: `/admin/products/${productId}${uploaded < photos.length ? `?photosRemaining=${photos.length - uploaded}#product-media` : ""}`,
    };
  } catch (error) {
    return safeFailure(error);
  }
}
