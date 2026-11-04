"use server";
import { strictForm } from "@/lib/security/input";

import { revalidatePath } from "next/cache";
import { requireActionActor } from "@/lib/auth/guards";
import { id, integer, text, version, InputError } from "@/lib/validation";
import { safeFailure, type ActionState } from "@/lib/actions";
import { invalidateStorefrontCatalog } from "@/lib/catalog/invalidate";

function refreshCategories() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products/new");
  revalidatePath("/admin/products/[id]", "page");
  invalidateStorefrontCatalog();
}

export async function saveCategory(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  try {
    strictForm(data, ["id", "updated_at", "name", "slug", "description", "sort_position", "is_active"], []);
    const { client } = await requireActionActor(true);
    const rawId = data.get("id");
    const categoryId = rawId ? id(rawId, "category") : null;
    const slug = text(data, "slug", 120);

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      throw new InputError(
        "Slug must contain lowercase letters, numbers and single hyphens.",
      );
    }

    const values = {
      name: text(data, "name", 120),
      slug,
      description: text(data, "description", 10000, false),
      sort_position: integer(
        data.get("sort_position"),
        "Sort position",
        0,
        1000000,
      ),
      is_active: data.get("is_active") === "on",
    };

    const result = categoryId
      ? await client
          .from("categories")
          .update(values)
          .eq("id", categoryId)
          .eq("updated_at", version(data))
          .select("id")
          .single()
      : await client.from("categories").insert(values).select("id").single();

    if (result.error) {
      if (result.error.code === "23505") {
        return { ok: false, message: "That category slug already exists." };
      }
      if (result.error.code === "PGRST116") {
        return {
          ok: false,
          message: "This category changed. Reload the page and try again.",
        };
      }
      throw result.error;
    }

    refreshCategories();
    return {
      ok: true,
      message: categoryId ? "Category updated." : "Category created.",
      redirectTo: categoryId ? undefined : "/admin/categories",
    };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function deleteCategory(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  try {
    strictForm(data, ["id", "updated_at"]);
    const { client } = await requireActionActor(true);
    const categoryId = id(data.get("id"), "category");
    const expectedUpdatedAt = version(data);

    const { count, error: productsError } = await client
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId);

    if (productsError) throw productsError;
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        message: `This category is used by ${count} product${count === 1 ? "" : "s"}. Move them to another category before deleting it.`,
      };
    }

    const { data: deleted, error } = await client
      .from("categories")
      .delete()
      .eq("id", categoryId)
      .eq("updated_at", expectedUpdatedAt)
      .select("id")
      .maybeSingle();

    if (error?.code === "23503") {
      return {
        ok: false,
        message: "A product still uses this category. Move it to another category before deleting.",
      };
    }
    if (error) throw error;
    if (!deleted) {
      return {
        ok: false,
        message: "This category changed or was removed. Reload the page and try again.",
      };
    }

    refreshCategories();
    return { ok: true, message: "Category deleted." };
  } catch (error) {
    return safeFailure(error);
  }
}
