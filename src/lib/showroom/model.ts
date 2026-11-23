export type ShowroomCard = {
  id: string;
  title: string;
  titleKa: string;
  description: string;
  descriptionKa: string;
  image: string | null;
  href: string;
  imageAlt: string;
  kind: "product" | "category";
};

export const SHOWROOM_CACHE_TAG = "homepage-showroom";
export const MAX_SHOWROOM_ITEMS = 12;

export function isShowroomNotInstalled(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export function showroomUploadUrl(path: string | null | undefined, supabaseUrl?: string): string | null {
  if (!supabaseUrl || !path || !/^showroom\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/.test(path)) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/${path}`;
}

export function showroomImage(
  images: { image_url: string | null; storage_path: string | null; sort_position: number }[],
  supabaseUrl?: string,
): string | null {
  for (const image of [...images].sort((a, b) => a.sort_position - b.sort_position)) {
    const base = supabaseUrl?.replace(/\/$/, "");
    const source = image.storage_path && base
      ? `${base}/storage/v1/object/public/product-images/${image.storage_path.split("/").map(encodeURIComponent).join("/")}`
      : image.image_url;
    if (!source) continue;
    const local = /^\/images\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|avif)$/.test(source);
    const storage = base && source.startsWith(`${base}/storage/v1/object/public/product-images/`);
    if (local || storage) return source;
  }
  return null;
}
