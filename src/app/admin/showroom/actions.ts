"use server";

import { revalidatePath, updateTag } from "next/cache";
import { safeFailure, type ActionState } from "@/lib/actions";
import { requireActionActor } from "@/lib/auth/guards";
import { strictForm } from "@/lib/security/input";
import { id, integer, text, version, InputError } from "@/lib/validation";
import { MAX_SHOWROOM_ITEMS, SHOWROOM_CACHE_TAG } from "@/lib/showroom/model";
import type { Database } from "@/lib/supabase/database.types";

function refreshShowroom() {
  updateTag(SHOWROOM_CACHE_TAG);
  revalidatePath("/admin/showroom");
  revalidatePath("/", "page");
}

export async function saveShowroomSettings(_state: ActionState, data: FormData): Promise<ActionState> {
  try {
    strictForm(data, ["updated_at", "use_custom_items"]);
    const { client } = await requireActionActor(true);
    const { error } = await client.from("homepage_showroom_settings")
      .update({ use_custom_items: data.get("use_custom_items") === "on" })
      .eq("singleton", true).eq("updated_at", version(data)).select("singleton").single();
    if (error) throw error;
    refreshShowroom();
    return { ok: true, message: "3D showroom display updated.", reload: true };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function saveShowroomItem(_state: ActionState, data: FormData): Promise<ActionState> {
  try {
    strictForm(data, ["id", "updated_at", "source_kind", "product_id", "category_id", "image_product_id", "title", "title_ka", "description", "description_ka", "sort_position", "is_active"]);
    const { client } = await requireActionActor(true);
    const rawId = data.get("id");
    const itemId = rawId ? id(rawId, "showroom card") : null;
    const sourceKind = text(data, "source_kind", 10);
    if (sourceKind !== "product" && sourceKind !== "category") throw new InputError("Choose a product or category.");

    const productId = sourceKind === "product" ? id(data.get("product_id"), "product") : null;
    const categoryId = sourceKind === "category" ? id(data.get("category_id"), "category") : null;
    const rawImageId = text(data, "image_product_id", 40, false);
    const imageProductId = rawImageId ? id(rawImageId, "image product") : null;
    const values: Database["public"]["Tables"]["homepage_showroom_items"]["Insert"] = {
      source_kind: sourceKind,
      product_id: productId,
      category_id: categoryId,
      image_product_id: imageProductId,
      title: text(data, "title", 120, false),
      title_ka: text(data, "title_ka", 120, false),
      description: text(data, "description", 500, false),
      description_ka: text(data, "description_ka", 500, false),
      sort_position: integer(data.get("sort_position"), "Sort position", 0, 1000000),
      is_active: data.get("is_active") === "on",
    };

    if (productId) {
      const selected = await client.from("products").select("id").eq("id", productId).maybeSingle();
      if (selected.error) throw selected.error;
      if (!selected.data) throw new InputError("This product is unavailable. Reload the page.");
    }
    if (categoryId) {
      const selected = await client.from("categories").select("id").eq("id", categoryId).maybeSingle();
      if (selected.error) throw selected.error;
      if (!selected.data) throw new InputError("This category is unavailable. Reload the page.");
    }
    if (imageProductId) {
      const selected = await client.from("products").select("id").eq("id", imageProductId).maybeSingle();
      if (selected.error) throw selected.error;
      if (!selected.data) throw new InputError("This image product is unavailable. Reload the page.");
    }

    const result = itemId
      ? await client.from("homepage_showroom_items").update(values)
        .eq("id", itemId).eq("updated_at", version(data)).select("id").single()
      : await client.from("homepage_showroom_items").insert(values).select("id").single();
    if (result.error?.code === "23514") {
      return { ok: false, message: `Use up to ${MAX_SHOWROOM_ITEMS} cards. Remove a card before adding another.` };
    }
    if (result.error) throw result.error;
    refreshShowroom();
    return { ok: true, message: itemId ? "Showroom card updated." : "Showroom card added.", reload: true };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function deleteShowroomItem(_state: ActionState, data: FormData): Promise<ActionState> {
  try {
    strictForm(data, ["id", "updated_at"]);
    const { client } = await requireActionActor(true);
    const { error } = await client.from("homepage_showroom_items").delete()
      .eq("id", id(data.get("id"), "showroom card")).eq("updated_at", version(data)).select("id").single();
    if (error) throw error;
    refreshShowroom();
    return { ok: true, message: "Card removed from the 3D showroom.", reload: true };
  } catch (error) {
    return safeFailure(error);
  }
}
