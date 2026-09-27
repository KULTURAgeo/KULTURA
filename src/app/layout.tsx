import { AuthSession } from "@/components/auth-session";
import { supabaseConfig } from "@/lib/supabase/config";
import type { Metadata } from "next";
import {siteUrl, isIndexable} from "@/lib/site";
import { Header } from "@/components/header";
import {CartProvider} from "@/components/cart-provider";
import {CartDrawer} from "@/components/cart-view";
import { Footer } from "@/components/footer";
import "./globals.css";
import "./phase3.css";
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "KULTURA — Step Into Kultura", template: "%s | KULTURA" },
  description:
    "Independent streetwear. Strong silhouettes. An everyday uniform for those who move differently.",
  robots: { index: isIndexable(), follow: isIndexable() },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  twitter: { card: "summary_large_image", images: ["/social-card.png"] },
  openGraph: {
    title: "KULTURA — Step Into Kultura",
    description: "Independent spirit. Everyday uniform.",
    type: "website",
    siteName: "KULTURA",
    images: [{url:"/social-card.png",width:1200,height:630,alt:"KULTURA — Step Into Kultura"}],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthSession config={supabaseConfig()} />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <CartProvider><Header />
        <main id="main">{children}</main>
        <CartDrawer/><Footer /></CartProvider>
      </body>
    </html>
  );
}
