"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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

export function AdminNavigation() {
  const router = useRouter();

  useEffect(() => {
    // Prefetch a few common destinations only after the page is idle;
    // keep bandwidth-limited users and hidden tabs out of this work.
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean };
    }).connection;
    if (connection?.saveData) return;

    const timeouts: number[] = [];
    const initial = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      ["/admin/products", "/admin/orders", "/admin/inventory"].forEach((href, index) => {
        timeouts.push(window.setTimeout(() => {
          if (document.visibilityState === "visible") router.prefetch(href);
        }, index * 1200));
      });
    }, 1800);

    return () => {
      window.clearTimeout(initial);
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [router]);

  return (
    <nav className="account-nav" aria-label="Administration">
      {adminLinks.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          prefetch={false}
          onMouseEnter={() => router.prefetch(href)}
          onFocus={() => router.prefetch(href)}
        >
          {label}
        </Link>
      ))}
      <Link href="/shop">VIEW STORE ↗</Link>
    </nav>
  );
}
