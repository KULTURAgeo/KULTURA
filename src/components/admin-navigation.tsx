"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const adminLinks = [
  { href: "/admin", label: "OVERVIEW" },
  { href: "/admin/products", label: "PRODUCTS" },
  { href: "/admin/categories", label: "CATEGORIES" },
  { href: "/admin/inventory", label: "INVENTORY" },
  { href: "/admin/orders", label: "ORDERS" },
  { href: "/admin/returns", label: "RETURNS" },
  { href: "/admin/promos", label: "PROMOS" },
  { href: "/admin/shipping", label: "SHIPPING" },
] as const;

const warmDestinations = new Set(["/admin/products", "/admin/orders"]);

export function AdminNavigation() {
  const [warm, setWarm] = useState(false);
  const [requested, setRequested] = useState<string[]>([]);

  useEffect(() => {
    // Allow the current page to settle before fetching dynamic admin data.
    // Never eagerly run expensive queries for users in data-saver mode.
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean };
    }).connection;
    if (connection?.saveData) return;

    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") setWarm(true);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, []);

  const requestPrefetch = (href: string) => {
    setRequested((current) =>
      current.includes(href) ? current : [...current, href],
    );
  };

  return (
    <nav className="account-nav" aria-label="Administration">
      {adminLinks.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          // Explicit true, unlike router.prefetch(), includes dynamic page
          // content and not only the shared loading boundary.
          prefetch={(warm && warmDestinations.has(href)) || requested.includes(href)}
          onMouseEnter={() => requestPrefetch(href)}
          onFocus={() => requestPrefetch(href)}
          onTouchStart={() => requestPrefetch(href)}
        >
          {label}
        </Link>
      ))}
      <Link href="/shop">VIEW STORE ↗</Link>
    </nav>
  );
}
