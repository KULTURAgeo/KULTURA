import { AuthSession } from "@/components/auth-session";
import { StructuredData } from "@/components/structured-data";
import { CookieConsent } from "@/components/cookie-consent";
import { supabaseConfig } from "@/lib/supabase/config";
import type { Metadata } from "next";
import { siteUrl, isIndexable } from "@/lib/site";
import { Header } from "@/components/header";
import { CartProvider } from "@/components/cart-provider";
import { LazyCartDrawer } from "@/components/lazy-cart-drawer";
import { Footer } from "@/components/footer";
import "./globals.css";
import "./phase3.css";
import "./commerce-polish.css";
import "./theme.css";

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const googleAnalyticsId = /^G-[A-Z0-9]+$/.test(
  process.env.GOOGLE_ANALYTICS_ID?.trim() ?? "",
)
  ? process.env.GOOGLE_ANALYTICS_ID?.trim()
  : undefined;
const metaPixelId = /^\d+$/.test(process.env.META_PIXEL_ID?.trim() ?? "")
  ? process.env.META_PIXEL_ID?.trim()
  : undefined;

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "KULTURA — Step Into Kultura", template: "%s | KULTURA" },
  description:
    "Independent streetwear. Strong silhouettes. An everyday uniform for those who move differently.",
  robots: { index: isIndexable(), follow: isIndexable() },
  verification: googleSiteVerification
    ? { google: googleSiteVerification }
    : undefined,
  icons: {
    icon: [{ url: "/icon.svg?v=kultura-globe-fine-20261009", type: "image/svg+xml" }],
    shortcut: "/icon.svg?v=kultura-globe-fine-20261009",
    apple: "/apple-touch-icon.png",
  },
  twitter: { card: "summary_large_image", images: ["/social-card.png"] },
  openGraph: {
    title: "KULTURA — Step Into Kultura",
    description: "Independent spirit. Everyday uniform.",
    type: "website",
    siteName: "KULTURA",
    images: [
      {
        url: "/social-card.png",
        width: 1200,
        height: 630,
        alt: "KULTURA — Step Into Kultura",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const origin = siteUrl();
  const organizationId = new URL("/#organization", origin).href;
  const websiteId = new URL("/#website", origin).href;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "KULTURA",
        url: origin.href,
        logo: {
          "@type": "ImageObject",
          url: new URL("/icon.svg", origin).href,
        },
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: origin.href,
        name: "KULTURA",
        publisher: { "@id": organizationId },
        inLanguage: "en",
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try { var theme = localStorage.getItem(\"kultura-theme\"); document.documentElement.dataset.theme = theme === \"light\" ? \"light\" : \"dark\"; } catch { document.documentElement.dataset.theme = \"dark\"; }" }} />
      </head>
      <body>
        <StructuredData data={structuredData} />
        <CookieConsent
          googleAnalyticsId={googleAnalyticsId}
          metaPixelId={metaPixelId}
        />
        <AuthSession config={supabaseConfig()} />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <CartProvider>
          <Header />
          <main id="main">{children}</main>
          <LazyCartDrawer />
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
