import "server-only";
import { getProductsForDrops } from "@/lib/catalog/repository";
import { createCatalogClient } from "@/lib/supabase/server";
import { createSessionClient } from "@/lib/supabase/session";

const releaseColumns = "id,title,title_ka,launches_at,archived" as const;

export async function getDropReleases() {
  const time = Date.now();
  const now = new Date(time).toISOString();
  const client = createCatalogClient();
  if (!client) return { time, next: null, released: [], unavailable: false };
  try {
    const [upcoming, launched] = await Promise.all([
      client.from("drop_releases").select(releaseColumns).eq("published", true).eq("archived", false)
        .gt("launches_at", now).order("launches_at").order("id").limit(1).maybeSingle(),
      client.from("drop_releases").select(releaseColumns).eq("published", true)
        .lte("launches_at", now).order("launches_at", { ascending: false }).order("id").limit(24),
    ]);
    if (upcoming.error || launched.error) throw new Error("Releases unavailable");
    const rows = launched.data;
    const links: { release_id: string; product_id: string }[] = [];
    for (let offset = 0; rows.length > 0; offset += 250) {
      const { data, error } = await client.from("drop_release_products").select("release_id,product_id")
        .in("release_id", rows.map(release => release.id)).order("release_id").order("product_id").range(offset, offset + 249);
      if (error) throw error;
      links.push(...data);
      if (data.length < 250) break;
    }
    const products = new Map((await getProductsForDrops([...new Set(links.map(link => link.product_id))]))
      .map(product => [product.id, product]));
    const released = rows.map(release => ({
      ...release,
      products: links.filter(link => link.release_id === release.id).flatMap(link => {
        const product = products.get(link.product_id);
        return product ? [product] : [];
      }),
    }));
    return { time, next: upcoming.data, released, unavailable: false };
  } catch {
    return { time, next: null, released: [], unavailable: true };
  }
}

export function isDropOpenForAlerts(release: { launches_at: string; published: boolean; archived: boolean }) {
  return release.published && !release.archived && Date.parse(release.launches_at) <= Date.now();
}

export async function getDropAlertPreference(releaseId: string) {
  try {
    const client = await createSessionClient();
    if (!client) return "signed-out";
    const { data: { user } } = await client.auth.getUser();
    if (!user?.email || !user.email_confirmed_at) return "signed-out";
    const { data, error } = await client.from("drop_alerts").select("release_id")
      .eq("release_id", releaseId).eq("user_id", user.id).maybeSingle();
    if (error) return "unavailable";
    return data ? "subscribed" : "available";
  } catch {
    return "unavailable";
  }
}
