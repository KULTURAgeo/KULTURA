"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readCookieConsent } from "@/lib/cookie-consent";

type AnalyticsProvider = "google" | "meta";

type MetaPixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
};

const ANALYTICS_READY_EVENT = "kultura:analytics-ready";
let googleSdkReady = false;

function readyMetaPixel() {
  const pixel = window.fbq;
  return typeof pixel?.callMethod === "function" ? pixel : undefined;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: MetaPixel;
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
  const [googleReady, setGoogleReady] = useState(() => googleSdkReady);
  const [metaReady, setMetaReady] = useState(false);

  useEffect(() => {
    if (privatePage || !googleReady || !googleAnalyticsId || !window.gtag) return;
    window.gtag("event", "page_view", {
      page_location: pageLocation(),
      page_title: document.title,
    });
    window.dispatchEvent(new Event(ANALYTICS_READY_EVENT));
  }, [privatePage, pathname, googleReady, googleAnalyticsId]);

  useEffect(() => {
    if (privatePage || !metaReady || !metaPixelId) return;
    readyMetaPixel()?.("track", "PageView");
    window.dispatchEvent(new Event(ANALYTICS_READY_EVENT));
  }, [privatePage, pathname, metaReady, metaPixelId]);

  if (privatePage) return null;

  return (
    <>
      {googleAnalyticsId ? (
        <>
          <Script nonce={nonce} id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${googleAnalyticsId}', {
                cookie_domain: 'none',
                allow_google_signals: false,
                allow_ad_personalization_signals: false,
                send_page_view: false,
                page_location: window.location.origin + window.location.pathname,
                page_referrer: ''
              });
            `}
          </Script>
          <Script
            nonce={nonce}
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
            strategy="afterInteractive"
            onLoad={() => {
              googleSdkReady = true;
              setGoogleReady(true);
            }}
            onError={() => {
              googleSdkReady = false;
              setGoogleReady(false);
            }}
          />
        </>
      ) : null}

      {metaPixelId ? (
        <>
          <Script nonce={nonce} id="meta-pixel-init" strategy="afterInteractive">
            {`
              (function(w) {
                if (w.fbq) return;
                var pixel = w.fbq = function() {
                  if (pixel.callMethod) pixel.callMethod.apply(pixel, arguments);
                  else pixel.queue.push(arguments);
                };
                if (!w._fbq) w._fbq = pixel;
                pixel.push = pixel;
                pixel.loaded = true;
                pixel.version = '2.0';
                pixel.queue = [];
                pixel('set', 'autoConfig', false, '${metaPixelId}');
                pixel('init', '${metaPixelId}');
              })(window);
            `}
          </Script>
          <Script
            nonce={nonce}
            src="https://connect.facebook.net/en_US/fbevents.js"
            strategy="afterInteractive"
            onReady={() => setMetaReady(Boolean(readyMetaPixel()))}
            onError={() => setMetaReady(false)}
          />
        </>
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
}, sent: Set<AnalyticsProvider>) {
  const value = price / 100;
  const consent = readCookieConsent();

  if (consent?.analytics && googleSdkReady && window.gtag && !sent.has("google")) {
    sent.add("google");
    window.gtag("event", "view_item", {
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
  }

  const meta = readyMetaPixel();
  if (consent?.marketing && meta && !sent.has("meta")) {
    sent.add("meta");
    meta("track", "ViewContent", {
      content_ids: [id],
      content_name: name,
      content_type: "product",
      value,
      currency: "GEL",
    });
  }
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

  if (consent?.analytics && googleSdkReady) window.gtag?.("event", "add_to_cart", {
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

  if (consent?.marketing) readyMetaPixel()?.("track", "AddToCart", {
    content_ids: [id],
    content_name: name,
    content_type: "product",
    value,
    currency: "GEL",
  });
}
