"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { HeaderInteractions } from "./header-interactions";

type Theme = "light" | "dark";
type Wave = {
  key: number;
  direction: "to-light" | "to-dark";
  left: number;
  top: number;
  width: number;
  travel: number;
  delays: number[];
};

const THEME_KEY = "kultura-theme";
// Small, uneven sound peaks form a compact pulse instead of a continuous line.
// Only one SVG element is animated (GPU transform); these bars never animate individually.
const soundPeaks = [
  3, 5, 4, 7, 5, 11, 8, 15, 9, 18, 12, 25,
  17, 29, 14, 24, 34, 18, 29, 38, 23, 32,
  16, 27, 12, 21, 15, 26, 11, 17, 8, 13,
  5, 9, 4, 6, 3,
];
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
  const [wave, setWave] = useState<Wave | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const sunRef = useRef<HTMLButtonElement>(null);
  const moonRef = useRef<HTMLButtonElement>(null);
  const waveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (waveTimer.current) clearTimeout(waveTimer.current);
      if (themeTimer.current) clearTimeout(themeTimer.current);
    };
  }, []);

  const setMode = (next: Theme) => {
    if (next === theme) return;
    if (waveTimer.current) clearTimeout(waveTimer.current);
    if (themeTimer.current) clearTimeout(themeTimer.current);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && headerRef.current && navRef.current &&
      sunRef.current && moonRef.current && window.innerWidth > 767) {
      const host = headerRef.current.getBoundingClientRect();
      const first = sunRef.current.getBoundingClientRect();
      const last = moonRef.current.getBoundingClientRect();
      const nav = navRef.current.getBoundingClientRect();
      const fromX = first.left + first.width / 2 - host.left;
      const toX = last.left + last.width / 2 - host.left;
      const origin = next === "dark" ? fromX : toX;
      const destination = next === "dark" ? toX : fromX;
      const soundWidth = 180;
      const delays = Array.from(navRef.current.querySelectorAll(".theme-nav-letter"), (letter) => {
        const bounds = letter.getBoundingClientRect();
        const position = bounds.left + bounds.width / 2 - host.left;
        const progress = Math.max(0, Math.min(1, (position - origin) / (destination - origin)));
        return Math.round(80 + 940 * progress);
      });
      setWave({
        key: Date.now(),
        direction: next === "dark" ? "to-dark" : "to-light",
        // Render just a travelling packet: nothing connects the two controls.
        left: origin - soundWidth / 2,
        top: nav.bottom - host.top + 6,
        width: soundWidth,
        travel: destination - origin,
        delays,
      });
      waveTimer.current = setTimeout(() => setWave(null), 1250);
    } else {
      setWave(null);
    }

    if (!reduced) {
      document.documentElement.classList.add("theme-animating");
      themeTimer.current = setTimeout(() => {
        document.documentElement.classList.remove("theme-animating");
      }, 750);
    }
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Local storage can be restricted; the toggle still works for this visit.
    }
    window.dispatchEvent(new Event("kultura-theme-change"));
  };

  return (
    <>
      <div className="announcement">INDEPENDENT SPIRIT. EVERYDAY UNIFORM.</div>
      <header ref={headerRef} className="header theme-header"
        data-wave-direction={wave?.direction}>
        <div className="theme-header-left">
          <Link href="/" className="wordmark" aria-label="KULTURA home">
            KULTURA<span>®</span>
          </Link>
          <button ref={sunRef} type="button"
            className="theme-mode-button theme-light-trigger"
            aria-label="Switch to light mode" title="Light mode"
            aria-pressed={theme === "light"} onClick={() => setMode("light")}>
            <SunIcon />
          </button>
        </div>
        <nav ref={navRef} className="desktop-nav theme-nav" aria-label="Main navigation">
          {links.map(({ href, label }, linkIndex) => {
            const start = links.slice(0, linkIndex).reduce((count, link) => count + link.label.length, 0);
            return (
              <Link key={href} href={href} aria-label={label}>
                {Array.from(label).map((char, index) => {
                  const order = start + index;
                  const delay = wave?.delays[order] ?? 0;
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
          <button ref={moonRef} type="button" className="theme-mode-button theme-dark-trigger"
            aria-label="Switch to dark mode" title="Dark mode"
            aria-pressed={theme === "dark"} onClick={() => setMode("dark")}>
            <MoonIcon />
          </button>
          <HeaderInteractions theme={theme} onThemeChange={setMode} />
        </div>
        {wave ? (
          <svg key={wave.key} className="theme-wave-track" aria-hidden="true"
            style={{
              left: wave.left,
              top: wave.top,
              width: wave.width,
              "--soundwave-travel": `${wave.travel}px`,
            } as CSSProperties}
            viewBox="0 0 180 80" preserveAspectRatio="xMidYMid meet">
            {soundPeaks.map((peak, index) => (
              <rect key={index}
                x={index * 4.8 + 1.2}
                y={40 - peak / 2}
                width="2.8"
                height={peak}
                rx="1.4"
              />
            ))}
          </svg>
        ) : null}
      </header>
    </>
  );
}
