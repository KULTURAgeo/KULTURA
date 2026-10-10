"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useCart } from "./cart-provider";
import { Icon } from "./ui";
import { LanguageSwitcher } from "./language-switcher";
import { useLanguage } from "./language-provider";

export function HeaderInteractions({ theme, onThemeChange }: {
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
}) {
  const cart = useCart();
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = () => {
    dialog.current?.close();
    setOpen(false);
  };

  return (
    <>
      <div className="header-actions">
        <Link
          className="icon-button"
          href="/search"
          aria-label={t("Search products")}
        >
          <Icon name="search" />
        </Link>
        <Link className="icon-button" href="/account" aria-label={t("ACCOUNT")}>
          <Icon name="account" />
        </Link>
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
          aria-label={t("Open navigation")}
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

      <dialog
        id="mobile-navigation"
        aria-label={t("Mobile navigation")}
        ref={dialog}
        className="mobile-dialog"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="mobile-dialog-top">
          <span className="wordmark">KULTURA</span>
          <button className="icon-button" aria-label={t("Close navigation")} onClick={close}>
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
          ].map(([label, href], index) => (
            <Link href={href} key={href} onClick={close}>
              <small>0{index + 1}</small>
              {t(label)}
              <span>↗</span>
            </Link>
          ))}
        </nav>
        <div className="mobile-language-choice"><LanguageSwitcher mobile /></div>
        <div className="mobile-theme-choice" role="group" aria-label={t("Color theme")}>
          <button type="button" aria-pressed={theme === "light"}
            onClick={() => { onThemeChange("light"); close(); }}>
            ☀ {t("LIGHT")}
          </button>
          <button type="button" aria-pressed={theme === "dark"}
            onClick={() => { onThemeChange("dark"); close(); }}>
            ☾ {t("DARK")}
          </button>
        </div>
        <p className="eyebrow">{t("STEP INTO KULTURA")}</p>
      </dialog>
    </>
  );
}
