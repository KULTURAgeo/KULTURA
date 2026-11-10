/**
 * Theme-wave enhancement for the elements currently visible in the viewport.
 * The established root left/right wipe stays responsible for the background;
 * named View Transition snapshots bring the same ripple to headings, controls,
 * cards and imagery without mutating React text nodes or changing layout.
 */
export type ThemeWaveDirection = "to-light" | "to-dark";
type Target = HTMLElement | SVGElement;
type Picked = { element: Target; rect: DOMRect };
const SLOT_COUNT = 72;

const SELECTOR = [
  ".theme-header .wordmark",
  ".theme-header button",
  ".theme-header select",
  ".theme-header .header-actions a",
  "#main h1", "#main h2", "#main h3", "#main h4",
  "#main p", "#main a", "#main button",
  "#main input", "#main select", "#main textarea", "#main label",
  "#main summary", "#main li", "#main th", "#main td",
  "#main strong", "#main small", "#main svg", "#main img", "#main video",
  "#main .product-card", "#main .panel", "#main .badge",
  "#main [class*='tile']",
  "footer h2", "footer h3", "footer p", "footer a", "footer button", "footer input",
  ".cart-drawer[open] button", ".cart-drawer[open] a",
  ".mobile-dialog[open] a", ".mobile-dialog[open] button",
].join(", ");

function visibleThemeTargets(): Picked[] {
  const cap = Math.min(SLOT_COUNT, window.innerWidth < 700 ? 44 : SLOT_COUNT);
  const picked: Picked[] = [];
  const alreadyNamed = new Set<Element>();
  for (const element of document.querySelectorAll<Target>(SELECTOR)) {
    if (picked.length >= cap) break;
    if (element.closest(".theme-nav, [data-theme-wave-skip]")) continue;
    if (element.closest("[hidden], [inert], [aria-hidden='true']")) continue;
    const rect = element.getBoundingClientRect();
    if (
      rect.width < 3 || rect.height < 3 ||
      rect.right <= 0 || rect.left >= window.innerWidth ||
      rect.bottom <= 0 || rect.top >= window.innerHeight
    ) continue;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0) continue;
    // Existing named view transitions (e.g. the three header words) keep
    // their own animation and must never acquire a duplicate name.
    if (style.viewTransitionName && style.viewTransitionName !== "none") continue;
    if ([...alreadyNamed].some((parent) => parent.contains(element))) continue;
    picked.push({ element, rect });
    alreadyNamed.add(element);
  }
  return picked;
}

function timing(rect: DOMRect, direction: ThemeWaveDirection, duration: number) {
  const vw = Math.max(1, window.innerWidth);
  const leading = direction === "to-dark" ? rect.left : vw - rect.right;
  const start = Math.max(0, Math.round((Math.max(0, leading) / vw) * duration));
  const width = Math.max(20, Math.round((Math.min(rect.width, vw) / vw) * duration));
  const center = direction === "to-dark" ? rect.left + rect.width / 2 : vw - rect.left - rect.width / 2;
  const ripple = Math.max(0, Math.round((Math.max(0, center) / vw) * duration - 110));
  return { start, width, ripple };
}

export function prepareThemeWave(direction: ThemeWaveDirection, duration: number): () => void {
  const root = document.documentElement;
  const entries = visibleThemeTargets();
  const restores: Array<() => void> = [];

  entries.forEach(({ element, rect }, index) => {
    const name = `kultura-wave-${index}`;
    const previous = element.style.viewTransitionName;
    const { start, width, ripple } = timing(rect, direction, duration);
    element.style.viewTransitionName = name;
    root.style.setProperty(`--k-wave-start-${index}`, `${start}ms`);
    root.style.setProperty(`--k-wave-width-${index}`, `${width}ms`);
    root.style.setProperty(`--k-wave-ripple-${index}`, `${ripple}ms`);
    restores.push(() => {
      // Preserve any other transition which may have subsequently claimed it.
      if (element.style.viewTransitionName === name) {
        element.style.viewTransitionName = previous;
      }
      root.style.removeProperty(`--k-wave-start-${index}`);
      root.style.removeProperty(`--k-wave-width-${index}`);
      root.style.removeProperty(`--k-wave-ripple-${index}`);
    });
  });

  return () => restores.forEach((restore) => restore());
}

/** Progressive fallback for browsers without the View Transitions API. */
export function animateThemeWaveFallback(direction: ThemeWaveDirection, duration: number): void {
  for (const { element, rect } of visibleThemeTargets()) {
    const { ripple } = timing(rect, direction, duration);
    element.animate(
      [
        { transform: "translateY(0) skewX(0deg)" },
        { transform: "translateY(-4px) skewX(-4deg)", offset: 0.33 },
        { transform: "translateY(2px) skewX(3deg)", offset: 0.68 },
        { transform: "translateY(0) skewX(0deg)" },
      ],
      { duration: 380, delay: ripple, easing: "ease-out" },
    );
  }
}
