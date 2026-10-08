"use server";
import { strictForm } from "@/lib/security/input";

import { revalidatePath } from "next/cache";
import { requireActionActor } from "@/lib/auth/guards";
import { id, version, InputError } from "@/lib/validation";
import { safeFailure, type ActionState } from "@/lib/actions";
import { invalidateStorefrontCatalog } from "@/lib/catalog/invalidate";

function stockQuantity(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    throw new InputError("Stock must be a whole number.");
  }

  const stock = Number(value);
  if (!Number.isSafeInteger(stock) || stock < 0 || stock > 1_000_000) {
    throw new InputError("Stock must be between 0 and 1,000,000.");
  }
  return stock;
}

export async function saveInventoryStock(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  try {
    strictForm(data, ["variant_id", "product_id", "stock_quantity", "updated_at"], []);
    const { client } = await requireActionActor(true);
    const variantId = id(data.get("variant_id"), "variant");
    const productId = id(data.get("product_id"), "product");
    const stock = stockQuantity(data.get("stock_quantity"));

    const { data: updated, error } = await client
      .from("product_variants")
      .update({ stock_quantity: stock })
      .eq("id", variantId)
      .eq("product_id", productId)
      .eq("updated_at", version(data))
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!updated) {
      return {
        ok: false,
        message: "This inventory row changed. Reload the page and try again.",
      };
    }

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/products/" + productId);
    invalidateStorefrontCatalog();

    return {
      ok: true,
      message:
        stock === 0
          ? "Stock saved. This variant is now sold out."
          : `Stock saved: ${stock}.`,
    };
  } catch (error) {
    return safeFailure(error);
  }
}
