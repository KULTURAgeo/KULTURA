"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readCookieConsent } from "@/lib/cookie-consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

type AnalyticsProps = {
  nonce?: string;
  googleAnalyticsId?: string;
  metaPixelId?: string;
};

type EcommerceItem = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
};

function pageLocation() {
  return window.location.origin + window.location.pathname;
}

export function Analytics({
  nonce,
  googleAnalyticsId,
  metaPixelId,
}: AnalyticsProps) {
  const pathname = usePathname();
  const privatePage = /^\/(?:auth|login|register|forgot-password|reset-password|account|admin|checkout|order-confirmation)(?:\/|$)/.test(pathname);
  const [googleReady, setGoogleReady] = useState(false);
  const [metaReady, setMetaReady] = useState(false);

  const analyticsReady =
    (!googleAnalyticsId || googleReady) && (!metaPixelId || metaReady);

  useEffect(() => {
    if (analyticsReady) {
      window.dispatchEvent(new Event("kultura:analytics-ready"));
    }
  }, [analyticsReady]);

  useEffect(() => {
    if (privatePage) return;
    if (googleReady && googleAnalyticsId && window.gtag) {
      window.gtag("event", "page_view", {
        page_location: pageLocation(),
        page_title: document.title,
      });
    }

    if (metaReady && metaPixelId && window.fbq) {
      window.fbq("track", "PageView");
    }
  }, [privatePage, pathname, googleReady, metaReady, googleAnalyticsId, metaPixelId]);

  if (privatePage) return null;

  return (
    <>
      {googleAnalyticsId ? (
        <>
          <Script nonce={nonce}
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
            strategy="afterInteractive"
            onLoad={() => setGoogleReady(true)}
          />
          <Script nonce={nonce} id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${googleAnalyticsId}', { send_page_view: false, page_location: window.location.origin + window.location.pathname, page_referrer: '' });
            `}
          </Script>
        </>
      ) : null}

      {metaPixelId ? (
        <Script nonce={nonce}
          id="meta-pixel"
          strategy="afterInteractive"
          onLoad={() => setMetaReady(true)}
        >
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('set', 'autoConfig', false, '${metaPixelId}');
            fbq('init', '${metaPixelId}');
          `}
        </Script>
      ) : null}
    </>
  );
}

export function trackViewItem({
  id,
  name,
  category,
  price,
}: {
  id: string;
  name: string;
  category: string;
  price: number;
}) {
  const value = price / 100;
  const consent = readCookieConsent();

  if (consent?.analytics) window.gtag?.("event", "view_item", {
    currency: "GEL",
    value,
    items: [
      {
        item_id: id,
        item_name: name,
        item_brand: "KULTURA",
        item_category: category,
        price: value,
        quantity: 1,
      } satisfies EcommerceItem,
    ],
  });

  if (consent?.marketing) window.fbq?.("track", "ViewContent", {
    content_ids: [id],
    content_name: name,
    content_type: "product",
    value,
    currency: "GEL",
  });
}

export function trackAddToCart({
  id,
  name,
  category,
  variant,
  price,
  quantity = 1,
}: {
  id: string;
  name: string;
  category: string;
  variant: string;
  price: number;
  quantity?: number;
}) {
  const value = (price * quantity) / 100;
  const consent = readCookieConsent();

  if (consent?.analytics) window.gtag?.("event", "add_to_cart", {
    currency: "GEL",
    value,
    items: [
      {
        item_id: id,
        item_name: name,
        item_brand: "KULTURA",
        item_category: category,
        item_variant: variant,
        price: price / 100,
        quantity,
      } satisfies EcommerceItem,
    ],
  });

  if (consent?.marketing) window.fbq?.("track", "AddToCart", {
    content_ids: [id],
    content_name: name,
    content_type: "product",
    value,
    currency: "GEL",
  });
}
