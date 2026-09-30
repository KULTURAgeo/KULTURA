import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { CATALOG_CACHE_TAG } from "./cache-config";

export function invalidateStorefrontCatalog() {
  updateTag(CATALOG_CACHE_TAG);
  revalidatePath("/", "page");
  revalidatePath("/shop", "page");
  revalidatePath("/shop/[category]", "page");
  revalidatePath("/product/[slug]", "page");
  revalidatePath("/drops", "page");
}
