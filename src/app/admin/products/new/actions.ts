"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth/guards";
import { productInput, text, InputError } from "@/lib/validation";
import { safeFailure, type ActionState } from "@/lib/actions";
import { processProductImage } from "@/lib/admin/image";

function refreshCatalog() {
  revalidatePath("/", "page");
  revalidatePath("/shop", "page");
  revalidatePath("/shop/[category]", "page");
  revalidatePath("/product/[slug]", "page");
  revalidatePath("/drops", "page");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/products");
}

export async function createProductWithImage(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  try {
    const { client } = await requireActor(true);
    const { product, collectionIds } = productInput(data);

    const file = data.get("image");
    let imageBuffer: Buffer | null = null;
    let imageAlt = "";

    if (file instanceof File && file.size > 0) {
      imageBuffer = await processProductImage(file);
      imageAlt = text(data, "image_alt_text", 500, false);
    } else if (file && !(file instanceof File)) {
      throw new InputError("Choose a valid image file.");
    }

    const { data: productId, error } = await client.rpc("admin_save_product", {
      p_id: null,
      p_expected_updated_at: null,
      p_product: product,
      p_collection_ids: collectionIds,
    });

    if (error) throw error;
    if (!productId) throw new InputError("Product could not be created.");

    if (imageBuffer) {
      const path = `${productId}/${randomUUID()}.webp`;
      const uploaded = await client.storage.from("product-images").upload(path, imageBuffer, {
        contentType: "image/webp",
        upsert: false,
        cacheControl: "3600",
      });

      if (uploaded.error) {
        refreshCatalog();
        return {
          ok: true,
          message: "Product created, but the image could not be uploaded. Add it from Media.",
          redirectTo: `/admin/products/${productId}`,
        };
      }

      const attached = await client.rpc("admin_attach_image", {
        p_product_id: productId,
        p_storage_path: path,
        p_alt_text: imageAlt || null,
      });

      if (attached.error) {
        await client.storage.from("product-images").remove([path]);
        refreshCatalog();
        return {
          ok: true,
          message: "Product created, but the image could not be attached. Add it from Media.",
          redirectTo: `/admin/products/${productId}`,
        };
      }
    }

    refreshCatalog();
    return {
      ok: true,
      message: imageBuffer ? "Product and main image created." : "Product created.",
      redirectTo: `/admin/products/${productId}`,
    };
  } catch (error) {
    return safeFailure(error);
  }
}
