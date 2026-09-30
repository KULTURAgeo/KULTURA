"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useCart } from "./cart-provider";
import { Icon } from "./ui";

const MOBILE_NAV = [
  ["Shop", "/shop"],
  ["Drops", "/drops"],
  ["About", "/about"],
  ["Account", "/account"],
  ["Your bag", "/cart"],
] as const;

export function HeaderInteractions() {
  const cart = useCart();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = () => {
    dialog.current?.close();
    setOpen(false);
  };

  return (
    <>
      <button
        className="icon-button bag-button"
        aria-label={`Shopping bag, ${cart.count} items`}
        onClick={cart.open}
      >
        <Icon name="bag" />
        {cart.count > 0 ? <span className="bag-count">{cart.count}</span> : null}
      </button>
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
      <dialog
        id="mobile-navigation"
        aria-label="Mobile navigation"
        ref={dialog}
        className="mobile-dialog"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
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
          {MOBILE_NAV.map(([label, href], index) => (
            <Link href={href} key={href} onClick={close}>
              <small>0{index + 1}</small>
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
