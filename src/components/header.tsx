"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { HeaderInteractions } from "./header-interactions";
import { flushSync } from "react-dom";

type Theme = "light" | "dark";
type TextRipple = {
  direction: "to-light" | "to-dark";
  delays: number[];
};

const THEME_KEY = "kultura-theme";
const WIPE_MS = 1000;

const links = [
  { href: "/shop", label: "SHOP" },
  { href: "/drops", label: "DROPS" },
  { href: "/about", label: "ABOUT" },
] as const;

function SunIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M19.1 4.9l-1.5 1.5M6.4 17.6l-1.5 1.5" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M20.4 15.6A8.8 8.8 0 0 1 8.4 3.6 8.9 8.9 0 1 0 20.4 15.6Z" />
    </svg>
  );
}

export function Header() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [ripple, setRipple] = useState<TextRipple | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const rippleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionId = useRef(0);

  useEffect(() => {
    const sync = () => {
      const selected = document.documentElement.dataset.theme;
      setTheme(selected === "light" ? "light" : "dark");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_KEY) return;
      const next: Theme = event.newValue === "light" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener("kultura-theme-change", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("kultura-theme-change", sync);
      if (rippleTimer.current) clearTimeout(rippleTimer.current);
      if (themeTimer.current) clearTimeout(themeTimer.current);
    };
  }, []);

  const setMode = (next: Theme) => {
    if (next === theme) return;
    transitionId.current += 1;
    const runId = transitionId.current;
    if (rippleTimer.current) clearTimeout(rippleTimer.current);
    if (themeTimer.current) clearTimeout(themeTimer.current);

    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const direction = next === "dark" ? "to-dark" : "to-light";
    const delayAt = (x: number) => {
      const fraction = Math.max(0, Math.min(1, x / Math.max(1, window.innerWidth)));
      const progress = next === "dark" ? fraction : 1 - fraction;
      return Math.max(0, Math.round(progress * WIPE_MS - 125));
    };

    const nav = navRef.current;
    const letters = Array.from(nav?.querySelectorAll<HTMLElement>(".theme-nav-letter") ?? []);
    const delays = letters.map((letter) => {
      const rect = letter.getBoundingClientRect();
      return delayAt(rect.left + rect.width / 2);
    });

    // Native View Transitions animate each word separately as the wipe reaches
    // its on-screen position; the letter-level ripple is a fallback for older browsers.
    for (const link of Array.from(nav?.querySelectorAll<HTMLAnchorElement>("a") ?? [])) {
      const word = link.getAttribute("data-theme-word");
      if (!word) continue;
      const rect = link.getBoundingClientRect();
      root.style.setProperty(`--theme-${word}-delay`, `${delayAt(rect.left + rect.width / 2)}ms`);
    }

    const nextRipple = reduced ? null : { direction, delays };
    const applyTheme = () => {
      root.dataset.theme = next;
      flushSync(() => {
        setTheme(next);
        setRipple(nextRipple);
      });
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        // Private browsing may block localStorage; the current selection still works.
      }
      window.dispatchEvent(new Event("kultura-theme-change"));
    };

    if (!reduced) {
      rippleTimer.current = setTimeout(() => setRipple(null), WIPE_MS + 360);
    }

    if (!reduced && typeof document.startViewTransition === "function") {
      root.dataset.themeDirection = direction;
      // The old page stays in place while the new themed page is revealed
      // with a directional clip-path. No SVG or waveform is rendered.
      const transition = document.startViewTransition(applyTheme);
      void transition.finished.then(
        () => {
          if (transitionId.current === runId) delete root.dataset.themeDirection;
        },
        () => {
          if (transitionId.current === runId) delete root.dataset.themeDirection;
        },
      );
    } else {
      // Browsers without same-document View Transitions still switch correctly.
      if (!reduced) {
        root.classList.add("theme-animating");
        themeTimer.current = setTimeout(() => root.classList.remove("theme-animating"), 650);
      }
      applyTheme();
    }
  };

  return (
    <>
      <div className="announcement">INDEPENDENT SPIRIT. EVERYDAY UNIFORM.</div>
      <header className="header theme-header"
        data-wave-direction={ripple?.direction}>
        <div className="theme-header-left">
          <Link href="/" className="wordmark" aria-label="KULTURA home">
            KULTURA<span>®</span>
          </Link>
          <button type="button"
            className="theme-mode-button theme-light-trigger"
            aria-label="Switch to light mode" title="Light mode"
            aria-pressed={theme === "light"} onClick={() => setMode("light")}>
            <SunIcon />
            <span className="theme-mode-label">LIGHT</span>
          </button>
        </div>
        <nav ref={navRef} className="desktop-nav theme-nav" aria-label="Main navigation">
          {links.map(({ href, label }, linkIndex) => {
            const start = links.slice(0, linkIndex).reduce((count, link) => count + link.label.length, 0);
            return (
              <Link key={href} href={href} aria-label={label}
                data-theme-word={label.toLowerCase()}
                style={{ viewTransitionName: `kultura-nav-${label.toLowerCase()}` }}>
                {Array.from(label).map((char, index) => {
                  const order = start + index;
                  const delay = ripple?.delays[order] ?? 0;
                  return (
                    <span key={index} aria-hidden="true" className="theme-nav-letter"
                      style={{ "--wave-delay": `${delay}ms` } as CSSProperties}>
                      {char}
                    </span>
                  );
                })}
              </Link>
            );
          })}
        </nav>
        <div className="theme-header-right">
          <button type="button" className="theme-mode-button theme-dark-trigger"
            aria-label="Switch to dark mode" title="Dark mode"
            aria-pressed={theme === "dark"} onClick={() => setMode("dark")}>
            <MoonIcon />
            <span className="theme-mode-label">DARK</span>
          </button>
          <HeaderInteractions theme={theme} onThemeChange={setMode} />
        </div>

      </header>
    </>
  );
}
