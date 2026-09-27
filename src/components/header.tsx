"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import {useCart} from "./cart-provider";
import { Icon } from "./ui";
export function Header() {
  const cart=useCart();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
  };
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
          <button className="icon-button bag-button" aria-label={`Shopping bag, ${cart.count} items`} onClick={cart.open}><Icon name="bag"/>{cart.count>0&&<span className="bag-count">{cart.count}</span>}</button>
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => {
              dialog.current?.showModal();
              setOpen(true);
            }}
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>
      <dialog
        id="mobile-navigation"
        aria-label="Mobile navigation"
        ref={dialog}
        className="mobile-dialog"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="mobile-dialog-top">
          <span className="wordmark">KULTURA</span>
          <button
            className="icon-button"
            aria-label="Close navigation"
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Mobile navigation">
          {[
            ["Shop", "/shop"],
            ["Drops", "/drops"],
            ["About", "/about"],
            ["Account", "/account"],
            ["Your bag", "/cart"],
          ].map(([label, href], i) => (
            <Link href={href} key={href} onClick={close}>
              <small>0{i + 1}</small>
              {label}
              <span>↗</span>
            </Link>
          ))}
        </nav>
        <p className="eyebrow">STEP INTO KULTURA</p>
      </dialog>
    </>
  );
}
