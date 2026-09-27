import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
export function Container({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`container ${className}`} {...props}>
      {children}
    </div>
  );
}
export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`} {...props} />;
}
export function ButtonLink({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={`button ${secondary ? "secondary" : ""}`} href={href}>
      {children}
    </Link>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function SectionHeading({
  eyebrow,
  title,
  href,
  link = "Explore all",
}: {
  eyebrow: string;
  title: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {href && (
        <Link className="text-link" href={href}>
          {link} <span aria-hidden="true">↗</span>
        </Link>
      )}
    </div>
  );
}
export function Icon({
  name,
}: {
  name: "search" | "account" | "bag" | "menu" | "close";
}) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      {name === "search" ? (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <path d="m15 15 6 6" />
        </>
      ) : name === "account" ? (
        <>
          <circle cx="12" cy="7" r="3.5" />
          <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
        </>
      ) : name === "bag" ? (
        <>
          <path d="M5 7h14l1 15H4L5 7Z" />
          <path d="M8 8V5a4 4 0 0 1 8 0v3" />
        </>
      ) : name === "menu" ? (
        <>
          <path d="M3 8h18M3 16h18" />
        </>
      ) : (
        <path d="m5 5 14 14M19 5 5 19" />
      )}
    </svg>
  );
}
