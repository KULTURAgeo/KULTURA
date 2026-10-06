import type { NextConfig } from "next";
import { siteUrl, isIndexable } from "./src/lib/site";

const origin = process.env.SUPABASE_URL;
if (process.env.VERCEL) siteUrl();

const contentSecurityPolicy = [
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Run the full TypeScript API checker and page workers in worker threads.
  experimental: {
    useTypeScriptCli: false,
    workerThreads: true,
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: origin
      ? [new URL("/storage/v1/object/public/product-images/**", origin)]
      : [],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86_400,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
