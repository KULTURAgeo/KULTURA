import Link from "next/link";
import { HeaderInteractions } from "./header-interactions";
import { Icon } from "./ui";

export function Header() {
  return (
    <>
      <div className="announcement">INDEPENDENT SPIRIT. EVERYDAY UNIFORM.</div>
      <header className="header">
        <Link href="/" className="wordmark" aria-label="KULTURA home">
          KULTURA<span>®</span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/shop">SHOP</Link>
          <Link href="/drops">DROPS</Link>
          <Link href="/about">ABOUT</Link>
        </nav>
        <div className="header-actions">
          <Link
            className="icon-button"
            href="/shop#search"
            aria-label="Search products"
          >
            <Icon name="search" />
          </Link>
          <Link className="icon-button" href="/account" aria-label="Account">
            <Icon name="account" />
          </Link>
          <HeaderInteractions />
        </div>
      </header>
    </>
  );
}
