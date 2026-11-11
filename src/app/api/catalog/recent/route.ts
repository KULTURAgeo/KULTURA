import { NextResponse } from "next/server";
import { getRecentProducts } from "@/lib/catalog/repository";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("slugs") ?? "";
  const slugs = [...new Set(raw.slice(0, 968).split(",").slice(0, 8))]
    .filter((slug) => slug.length <= 120 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug));
  if (!slugs.length) return NextResponse.json({ products: [] });

  const products = await getRecentProducts(slugs);
  if (!products) return NextResponse.json({ products: [] });

  const bySlug = new Map(products.map((product) => [product.slug, product]));
  return NextResponse.json({
    products: slugs.flatMap((slug) => {
      const product = bySlug.get(slug);
      if (!product) return [];
      const { name, price, image, category } = product;
      return [{ slug, name, price, image, category }];
    }),
  });
}
