import type { NextConfig } from "next";
import { siteUrl, isIndexable } from "./src/lib/site";
const origin = process.env.SUPABASE_URL;
if (process.env.VERCEL) siteUrl();
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Run the full TypeScript API checker and page workers in worker threads.
  experimental: { useTypeScriptCli: false, workerThreads: true, serverActions: { bodySizeLimit: "4mb" } },
  images: {
    remotePatterns: origin ? [new URL("/storage/v1/object/public/product-images/**", origin)] : [],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ...(!isIndexable() ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
      ],
    }];
  },
};
export default nextConfig;
