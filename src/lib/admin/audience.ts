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
  if (audience !== "x" && audience !== "y" && audience !== "unisex") {
    throw new InputError("Choose X, Y, or UNISEX.");
  }
  const { data: rows, error } = await client
    .from("collections")
    .select("id,slug")
    .in("slug", [...slugs]);
  if (error || !rows || rows.length !== 3) {
    throw new InputError("Shop divisions are not configured.");
  }
  // Categories with an explicit division may only contain matching products.
  // Legacy categories without a division remain usable until assigned.
  const categoryId = data.get("category_id");
  if (typeof categoryId !== "string") throw new InputError("Choose a category.");
  const { data: category, error: categoryError } = await client
    .from("categories").select("audience").eq("id", categoryId).maybeSingle();
  if (categoryError || !category) throw new InputError("Category unavailable.");
  if (category.audience && category.audience !== audience) {
    throw new InputError("This category belongs to " + category.audience.toUpperCase() + ". Choose a matching shop division or category.");
  }
  const chosen = rows.find((row) => row.slug === "shop-" + audience);
  if (!chosen) throw new InputError("Shop division unavailable.");
  const divisionIds = new Set(rows.map((row) => row.id));
  return [...new Set([...existingIds.filter((id) => !divisionIds.has(id)), chosen.id])];
}
