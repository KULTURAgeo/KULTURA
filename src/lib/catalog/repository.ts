import "server-only";
import { cache } from "react";
import { createCatalogClient } from "../supabase/server";
import { mapProduct } from "./mapper";
import type { Category, Product } from "../catalog";
export type CatalogStatus = "ready" | "unconfigured" | "unavailable";
export type CatalogResult = {
  status: CatalogStatus;
  products: Product[];
  categories: Category[];
};
const productSelect = `
 id,slug,name,price,compare_at_price,description,featured,is_drop,seo_title,seo_description,
 category:categories!inner(name,slug),
 variants:product_variants(id,sku,size,color,stock_quantity,is_active,sort_position),
 images:product_images(image_url,storage_path,alt_text,sort_position)
` as const;
function reportFailure(operation: string) {
  // Do not log raw SDK exceptions: they can carry request headers or sensitive URLs.
  console.error(
    "[catalog] " +
      operation +
      " failed. Check server configuration and Supabase availability.",
  );
}
export const getCatalog = cache(async (): Promise<CatalogResult> => {
  try {
    const client = createCatalogClient();
    if (!client)
      return { status: "unconfigured", products: [], categories: [] };
    const products: Product[] = [];
    const categories: Category[] = [];
    // PostgREST caps responses; retrieve explicit pages rather than silently truncating.
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client
        .from("products")
        .select(productSelect)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 99);
      if (error) throw error;
      products.push(
        ...data.map((row) => mapProduct(row, process.env.SUPABASE_URL)),
      );
      if (data.length < 100) break;
    }
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client
        .from("categories")
        .select("name,slug")
        .eq("is_active", true)
        .order("sort_position")
        .order("id")
        .range(offset, offset + 99);
      if (error) throw error;
      categories.push(...data);
      if (data.length < 100) break;
    }
    return { status: "ready", products, categories };
  } catch {
    reportFailure("Listing");
    return { status: "unavailable", products: [], categories: [] };
  }
});
export const getProductBySlug = cache(
  async (
    slug: string,
  ): Promise<{ status: CatalogStatus; product: Product | null }> => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
      return { status: "ready", product: null };
    try {
      const client = createCatalogClient();
      if (!client) return { status: "unconfigured", product: null };
      const { data, error } = await client
        .from("products")
        .select(productSelect)
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return {
        status: "ready",
        product: data ? mapProduct(data, process.env.SUPABASE_URL) : null,
      };
    } catch {
      reportFailure("Product detail");
      return { status: "unavailable", product: null };
    }
  },
);

export async function getProductsByIds(ids:string[]):Promise<{status:CatalogStatus;products:Product[]}>{
 try{
 const client=createCatalogClient();if(!client)return {status:"unconfigured",products:[]};
 if(!ids.length)return {status:"ready",products:[]};
 const {data,error}=await client.from("products").select(productSelect).in("id",ids.slice(0,50)).eq("status","active");
 if(error)throw error;
 return {status:"ready",products:data.map(row=>mapProduct(row,process.env.SUPABASE_URL))};
 }catch{return {status:"unavailable",products:[]};}
}
