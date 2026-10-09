"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

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
