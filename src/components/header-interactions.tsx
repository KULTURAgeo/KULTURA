"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useMotionPreview } from "./motion-preview-provider";
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
  const reduced = useReducedMotion();
  const { enabled } = useMotionPreview();
  const active = enabled && !reduced;
  const press = !active ? undefined : { scale: 0.9 };
  const navVariants = { open: { transition: { staggerChildren: 0.074, delayChildren: 0.07 } }, closed: {} };
  const itemVariants = !active ? { open: { opacity: 1, y: 0 }, closed: { opacity: 1, y: 0 } } : {
    open: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 330, damping: 27 } },
    closed: { opacity: 0, y: 18, transition: { duration: 0.12 } },
  };

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
        <motion.button
          whileTap={press}
          className="icon-button bag-button"
          aria-label={`Shopping bag, ${cart.count} items`}
          onClick={cart.open}
        >
          <Icon name="bag" />
          {cart.count > 0 ? <span className="bag-count">{cart.count}</span> : null}
        </motion.button>
        <motion.button
          whileTap={press}
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
        </motion.button>
      </div>

      <dialog
        id="mobile-navigation"
        aria-label={t("Mobile navigation")}
        ref={dialog}
        className="mobile-dialog"
        data-motion-menu
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="mobile-dialog-top">
          <span className="wordmark">KULTURA</span>
          <motion.button whileTap={press} className="icon-button" aria-label={t("Close navigation")} onClick={close}>
            <Icon name="close" />
          </motion.button>
        </div>
        <motion.nav
          aria-label="Mobile navigation"
          initial={active ? "closed" : false}
          animate={open && active ? "open" : "closed"}
          variants={navVariants}
        >
          {[
            ["Shop", "/shop"],
            ["Drops", "/drops"],
            ["About", "/about"],
            ["Account", "/account"],
            ["Your bag", "/cart"],
          ].map(([label, href], index) => (
            <motion.div key={href} variants={itemVariants}>
              <Link href={href} onClick={close}>
                <small>0{index + 1}</small>
                {t(label)}
                <span>↗</span>
              </Link>
            </motion.div>
          ))}
        </motion.nav>
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
