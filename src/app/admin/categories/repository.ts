import "server-only";

import { requirePage } from "@/lib/auth/guards";

export async function adminCategories() {
  const { client } = await requirePage(true);
  const categories = [];

  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client
      .from("categories")
      .select("id,name,slug,description,is_active,sort_position,updated_at")
      .order("sort_position")
      .order("name")
      .order("id")
      .range(offset, offset + 99);

    if (error) throw new Error("Categories unavailable.");
    categories.push(...data);
    if (data.length < 100) break;
  }

  return categories;
}
