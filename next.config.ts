import type { NextConfig } from "next";
import { siteUrl, isIndexable } from "./src/lib/site";

const origin = process.env.SUPABASE_URL;
if (process.env.VERCEL) siteUrl();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Run the full TypeScript API checker and page workers in worker threads.
  experimental: {
    useTypeScriptCli: false,
    workerThreads: true,
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    deviceSizes: [384, 480, 640, 750, 828, 1080, 1200, 1440, 1920],
    imageSizes: [32, 48, 64, 96, 128, 192, 256, 320],
    remotePatterns: origin
      ? [new URL("/storage/v1/object/public/product-images/**", origin)]
      : [],
    formats: ["image/avif", "image/webp"],
    qualities: [65, 75, 90],
    minimumCacheTTL: 86_400,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
          ...(!isIndexable()
            ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
