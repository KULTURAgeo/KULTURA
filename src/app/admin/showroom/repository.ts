import "server-only";
import { requirePage } from "@/lib/auth/guards";
import type { Database } from "@/lib/supabase/database.types";
import { isShowroomNotInstalled, showroomImage } from "@/lib/showroom/model";

type Tables = Database["public"]["Tables"];
export type ShowroomItem = Tables["homepage_showroom_items"]["Row"];
export type ShowroomSettings = Tables["homepage_showroom_settings"]["Row"];
export type ShowroomProductOption = {
  id: string;
  name: string;
  slug: string;
  status: Tables["products"]["Row"]["status"];
  image: string | null;
  categoryActive: boolean;
};
export type ShowroomCategoryOption = { id: string; name: string; slug: string; description: string; is_active: boolean; image: string | null };
export type AdminShowroomResult = {
  status: "ready" | "not_installed";
  settings: ShowroomSettings | null;
  items: ShowroomItem[];
  products: ShowroomProductOption[];
  categories: ShowroomCategoryOption[];
};

export async function adminShowroom(): Promise<AdminShowroomResult> {
  const { client } = await requirePage(true);
  const { data: settings, error } = await client.from("homepage_showroom_settings")
    .select("*").eq("singleton", true).maybeSingle();
  if (isShowroomNotInstalled(error)) {
    return { status: "not_installed", settings: null, items: [], products: [], categories: [] };
  }
  if (error || !settings) throw new Error("Showroom settings unavailable.");
  const [itemResult, categories, productData] = await Promise.all([
    client.from("homepage_showroom_items").select("*").order("sort_position").order("id"),
    (async () => {
      const rows: Omit<ShowroomCategoryOption, "image">[] = [];
      for (let offset = 0; ; offset += 100) {
        const result = await client.from("categories").select("id,name,slug,description,is_active")
          .order("name").order("id").range(offset, offset + 99);
        if (result.error) throw new Error("Showroom categories unavailable.");
        rows.push(...result.data);
        if (result.data.length < 100) break;
      }
      return rows;
    })(),
    (async () => {
      const rows: (Omit<ShowroomProductOption, "categoryActive"> & { category_id: string; featured: boolean; created_at: string })[] = [];
      for (let offset = 0; ; offset += 100) {
        const result = await client.from("products")
          .select("id,name,slug,status,category_id,featured,created_at,product_images(image_url,storage_path,sort_position)")
          .order("name").order("id").range(offset, offset + 99);
        if (result.error) throw new Error("Showroom products unavailable.");
        rows.push(...result.data.map(product => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          status: product.status,
          category_id: product.category_id,
          featured: product.featured,
          created_at: product.created_at,
          image: showroomImage(product.product_images, process.env.SUPABASE_URL),
        })));
        if (result.data.length < 100) break;
      }
      return rows;
    })(),
  ]);
  if (itemResult.error) throw new Error("Showroom cards unavailable.");
  const categoryOptions = categories.map(category => {
    const candidates = productData.filter(product => product.category_id === category.id && product.status === "active")
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
      .slice(0, 12);
    return { ...category, image: candidates.find(product => product.image)?.image ?? null };
  });
  const activeCategories = new Set(categories.filter(category => category.is_active).map(category => category.id));
  const products = productData.map(({ id, name, slug, status, image, category_id }) => ({
    id, name, slug, status, image, categoryActive: activeCategories.has(category_id),
  }));
  return { status: "ready", settings, items: itemResult.data, products, categories: categoryOptions };
}
