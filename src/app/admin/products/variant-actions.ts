"use server";

import { revalidatePath } from "next/cache";
import { requireActionActor } from "@/lib/auth/guards";
import { safeFailure, type ActionState } from "@/lib/actions";
import { invalidateStorefrontCatalog } from "@/lib/catalog/invalidate";
import { strictForm, strictObject } from "@/lib/security/input";
import { id, InputError, integer, text, variantInput, version } from "@/lib/validation";

function parseRow(row: FormDataEntryValue, keys: readonly string[]) {
  if (typeof row !== "string") throw new InputError("Invalid variant data.");
  try {
    return strictObject(JSON.parse(row), keys);
  } catch {
    throw new InputError("Invalid variant data.");
  }
}

export async function saveVariantMatrix(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    strictForm(form, ["product_id", "updated_at", "base_sku", "color", "variant"], ["color", "variant"]);
    const { client } = await requireActionActor(true);
    const productId = id(form.get("product_id"), "product");
    const baseSku = text(form, "base_sku", 40);
    if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(baseSku))
      throw new InputError("Base SKU must use uppercase letters, numbers, hyphens or underscores.");

    const colorFields = form.getAll("color");
    const variantFields = form.getAll("variant");
    if (colorFields.length > 60 || variantFields.length > 180)
      throw new InputError("Save up to 60 colors and 180 variant changes at a time.");

    const colors = colorFields.map((entry) => {
      const color = parseRow(entry, ["name", "hex", "sort_position"]);
      const fields = new FormData();
      if (typeof color.name === "string") fields.set("name", color.name);
      const name = text(fields, "name", 80);
      if (color.hex !== null && (typeof color.hex !== "string" || !/^#[a-f0-9]{6}$/i.test(color.hex)))
        throw new InputError("Choose a six-digit color.");
      return { name, hex: color.hex, sort_position: integer(color.sort_position, "Color order", 0, 1000000) };
    });

    const variants = variantFields.map((entry) => {
      const row = parseRow(entry, ["id", "updated_at", "sku", "size", "color", "stock_quantity", "is_active", "sort_position"]);
      const fields = new FormData();
      for (const key of ["sku", "size", "color", "updated_at"] as const) {
        if (typeof row[key] === "string") fields.set(key, row[key]);
      }
      fields.set("stock_quantity", String(integer(row.stock_quantity, "Stock", 0, 1000000)));
      if (typeof row.is_active !== "boolean") throw new InputError("Choose a variant status.");
      if (row.is_active) fields.set("is_active", "on");
      return {
        ...variantInput(fields),
        id: row.id === null ? null : id(row.id, "variant"),
        updated_at: row.id === null ? null : version(fields),
        sort_position: integer(row.sort_position, "Variant order", 0, 1000000),
      };
    });
    const { data: count, error } = await client.rpc("admin_save_variant_matrix", {
      p_product_id: productId, p_expected_updated_at: version(form), p_base_sku: baseSku,
      p_colors: colors, p_variants: variants,
    });
    if (error) throw error;
    invalidateStorefrontCatalog();
    revalidatePath("/admin/products/" + productId);
    revalidatePath("/admin/inventory");
    return { ok: true, message: count ? `Saved ${count} variant changes.` : "Variant options saved." };
  } catch (error) {
    return safeFailure(error);
  }
}
