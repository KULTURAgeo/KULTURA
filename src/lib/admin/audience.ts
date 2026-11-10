import { InputError } from "@/lib/validation";
import { requireActionActor } from "@/lib/auth/guards";

type AdminClient = Awaited<ReturnType<typeof requireActionActor>>["client"];
const slugs = ["shop-x", "shop-y", "shop-unisex"] as const;

export async function resolveAudienceCollections(
  client: AdminClient,
  data: FormData,
  existingIds: string[],
): Promise<string[]> {
  const audience = data.get("audience");
  if (audience !== "x" && audience !== "y" && audience !== "unisex" && audience !== "xys") {
    throw new InputError("Choose X, Y, UNISEX, or XYS.");
  }
  const { data: rows, error } = await client
    .from("collections")
    .select("id,slug")
    .in("slug", [...slugs]);
  if (error || !rows || rows.length !== slugs.length) {
    throw new InputError("Shop divisions are not configured.");
  }

  const categoryId = data.get("category_id");
  if (typeof categoryId !== "string") throw new InputError("Choose a category.");
  const { data: category, error: categoryError } = await client
    .from("categories").select("audience").eq("id", categoryId).maybeSingle();
  if (categoryError || !category) throw new InputError("Category unavailable.");

  // A product shared across all divisions must use a shared category.
  // Legacy, unassigned categories are kept compatible with single divisions.
  if (audience === "xys") {
    if (category.audience !== "xys") {
      throw new InputError("XYS products require a category marked XYS (All 3 divisions).");
    }
  } else if (category.audience && category.audience !== "xys" && category.audience !== audience) {
    throw new InputError("This category belongs to " + category.audience.toUpperCase() + ". Choose a matching shop division or category.");
  }

  const divisionIds = new Set(rows.map((row) => row.id));
  const selectedIds = audience === "xys"
    ? rows.map((row) => row.id)
    : rows.filter((row) => row.slug === "shop-" + audience).map((row) => row.id);
  if (selectedIds.length !== (audience === "xys" ? 3 : 1)) {
    throw new InputError("Shop division unavailable.");
  }
  return [...new Set([...existingIds.filter((id) => !divisionIds.has(id)), ...selectedIds])];
}
