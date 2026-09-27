import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/lib/site";
export default function robots(): MetadataRoute.Robots {
  return isIndexable()
    ? { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/auth", "/cart", "/login", "/register", "/forgot-password", "/reset-password"] }, sitemap: new URL("/sitemap.xml", siteUrl()).href }
    : { rules: { userAgent: "*", disallow: "/" } };
}
