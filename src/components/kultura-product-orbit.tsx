"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useLanguage } from "./language-provider";
import type { Category, Product } from "@/lib/catalog";
import styles from "./kultura-product-orbit.module.css";

type SceneItem = {
  id: string;
  en: string;
  ka: string;
  eyebrow: string;
  enDescription: string;
  kaDescription: string;
  aliases: string[];
  shape: string;
};

const ITEMS: SceneItem[] = [
  {
    id: "hoodie", en: "HOODIES", ka: "ჰუდები", eyebrow: "01 / THE SILHOUETTE",
    enDescription: "An everyday form, reimagined in KULTURA's visual world.",
    kaDescription: "ყოველდღიური სილუეტი KULTURA-ს ვიზუალურ სამყაროში.",
    aliases: ["hoodies", "hoodie", "sweatshirts"],
    shape: "M92 57 Q103 30 120 30 Q137 30 148 57 L172 70 211 108 190 139 169 121 170 218 70 218 71 121 50 139 29 108 68 70Z M102 53 Q120 87 138 53 M94 171 L146 171",
  },
  {
    id: "shoes", en: "SHOES", ka: "ფეხსაცმელი", eyebrow: "02 / THE MOVEMENT",
    enDescription: "Explore footwear through motion, light and perspective.",
    kaDescription: "დაათვალიერე ფეხსაცმლის სამყარო მოძრაობით, შუქითა და პერსპექტივით.",
    aliases: ["shoes", "footwear", "sneakers", "boots"],
    shape: "M36 151 C54 139 76 134 91 108 L121 126 150 140 198 153 Q213 158 213 179 L211 196 Q163 212 86 207 L28 193 Q23 170 36 151Z M59 172 Q128 184 193 177 M105 123 L124 141 M120 130 L140 147",
  },
  {
    id: "bag", en: "BAGS", ka: "ჩანთები", eyebrow: "03 / THE ESSENTIAL",
    enDescription: "Carry your essentials. Discover the collection.",
    kaDescription: "შენი ყოველდღიური ნივთები — აღმოაჩინე კოლექცია.",
    aliases: ["bags", "bag", "handbags", "backpacks"],
    shape: "M52 91 Q52 77 69 77 L171 77 Q188 77 188 91 L197 210 43 210Z M85 82 L85 63 Q85 26 120 26 Q155 26 155 63 L155 82 M58 120 L181 120",
  },
  {
    id: "jacket", en: "JACKETS", ka: "ქურთუკები", eyebrow: "04 / THE LAYER",
    enDescription: "Outer layers with a strong presence.",
    kaDescription: "ზედა ტანსაცმელი გამოკვეთილი ხასიათით.",
    aliases: ["jackets", "jacket", "outerwear", "coats"],
    shape: "M93 43 L120 69 147 43 178 58 211 117 185 135 171 113 174 220 66 220 69 113 55 135 29 117 62 58Z M120 69 L120 220 M94 46 L110 117 120 69 130 117 146 46",
  },
  {
    id: "accessories", en: "ACCESSORIES", ka: "აქსესუარები", eyebrow: "05 / THE DETAIL",
    enDescription: "Small pieces, distinct character.",
    kaDescription: "მცირე დეტალები, გამორჩეული ხასიათი.",
    aliases: ["accessories", "accessory", "caps", "hats", "jewelry", "belts"],
    shape: "M58 134 Q47 81 120 72 Q193 81 182 134 L176 155 64 155Z M65 154 Q112 146 194 163 Q213 171 204 184 Q164 190 120 172 L65 167 M86 111 Q120 98 154 111",
  },
  {
    id: "toys", en: "TOYS", ka: "სათამაშოები", eyebrow: "06 / THE PLAY",
    enDescription: "Objects made for discovery, play and imagination.",
    kaDescription: "აღმოჩენის, თამაშისა და წარმოსახვის სამყარო.",
    aliases: ["toys", "toy", "collectibles", "figures", "designer-toys"],
    shape: "M120 36 C153 36 173 57 173 88 C173 108 162 121 149 129 L163 147 185 154 199 204 169 213 155 175 152 222 88 222 85 175 71 213 41 204 55 154 77 147 91 129 C78 121 67 108 67 88 C67 57 87 36 120 36Z M96 87 L101 87 M139 87 L144 87 M105 109 Q120 122 135 109",
  },
];

function CategorySculpture({ item, index }: { item: SceneItem; index: number }) {
  const gradientId = "orbit-metal-" + index;
  return (
    <svg className={styles.sculpture} viewBox="0 0 240 260" role="img" aria-label={item.en + " illustration"}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8f8f6" />
          <stop offset=".22" stopColor="#8b98a5" />
          <stop offset=".48" stopColor="#f0f5fa" />
          <stop offset=".7" stopColor="#505762" />
          <stop offset="1" stopColor="#e0e8ee" />
        </linearGradient>
      </defs>
      <path d={item.shape} fill={`url(#${gradientId})`} fillRule="evenodd" stroke="#eff5fb" strokeWidth="3"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function KulturaProductOrbit({ products, categories }: {
  products: Product[];
  categories: Category[];
}) {
  const { locale } = useLanguage();
  const isKa = locale === "ka";
  const [selected, setSelected] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [inView, setInView] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{
    startX: number; angle: number; lastX: number; lastTime: number;
    velocity: number; capturedBy: HTMLElement | null;
  } | null>(null);
  const angleRef = useRef(0);
  const targetRef = useRef(0);
  const velocityRef = useRef(0);
  const tiltRef = useRef(0);
  const tiltTargetRef = useRef(0);
  const movedRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(query.matches);
    updateMotion();
    query.addEventListener("change", updateMotion);
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "100px 0px", threshold: 0.05 },
    );
    observer.observe(root);
    return () => {
      query.removeEventListener("change", updateMotion);
      observer.disconnect();
    };
  }, []);

  // RAF springs provide inertial movement without loading a heavy 3D runtime.
  // Runs only while the scene is visible; never affects the LCP hero.
  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    if (reducedMotion) {
      angleRef.current = targetRef.current;
      velocityRef.current = 0;
      wheel.style.transform = "rotateX(-9deg) rotateY(" + angleRef.current + "deg)";
      return;
    }
    if (!inView) return;
    let raf = 0;
    let previous = 0;
    const tick = (time: number) => {
      const dt = Math.min(2, Math.max(0.2, (time - (previous || time - 16.67)) / 16.67));
      previous = time;
      const distance = targetRef.current - angleRef.current;
      velocityRef.current += distance * 0.052 * dt;
      velocityRef.current *= Math.pow(0.76, dt);
      angleRef.current += velocityRef.current * dt;
      if (Math.abs(distance) < 0.01 && Math.abs(velocityRef.current) < 0.01) {
        angleRef.current = targetRef.current;
        velocityRef.current = 0;
      }
      tiltRef.current += (tiltTargetRef.current - tiltRef.current) * Math.min(1, 0.095 * dt);
      wheel.style.transform = "rotateX(" + (-9 + tiltRef.current).toFixed(3) + "deg) rotateY(" + angleRef.current.toFixed(3) + "deg)";
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [inView, reducedMotion]);

  function snapTo(index: number, isAutomatic = false) {
    const normalized = (index + ITEMS.length) % ITEMS.length;
    const base = -normalized * 60;
    // Auto advance always travels forward, including the last-to-first edge.
    const target = isAutomatic
      ? targetRef.current - 60
      : base + 360 * Math.round((targetRef.current - base) / 360);
    targetRef.current = target;
    setSelected(normalized);
    if (!isAutomatic) setAutoPlay(false);
    if (reducedMotion && wheelRef.current) {
      angleRef.current = target;
      wheelRef.current.style.transform = "rotateX(-9deg) rotateY(" + target + "deg)";
    }
  }

  useEffect(() => {
    if (!inView || isHovering || !autoPlay || reducedMotion) return;
    const timer = window.setInterval(() => {
      targetRef.current -= 60;
      setSelected((index) => (index + 1) % ITEMS.length);
    }, 6200);
    return () => window.clearInterval(timer);
  }, [inView, isHovering, autoPlay, reducedMotion]);

  function choose(index: number) {
    snapTo(index);
  }

  function updateSceneLighting(event: PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    const x = (event.clientX - box.left) / Math.max(box.width, 1);
    const y = (event.clientY - box.top) / Math.max(box.height, 1);
    stage.style.setProperty("--light-x", (x * 100).toFixed(1) + "%");
    stage.style.setProperty("--light-y", (y * 100).toFixed(1) + "%");
    tiltTargetRef.current = (0.5 - y) * 13;
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const clicked = event.target as Element;
    const button = clicked.closest("button");
    const capturer = button instanceof HTMLElement ? button : event.currentTarget;
    pointerRef.current = {
      startX: event.clientX,
      angle: targetRef.current,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      capturedBy: capturer,
    };
    movedRef.current = false;
    capturer.setPointerCapture(event.pointerId);
    updateSceneLighting(event);
  }

  function drag(event: PointerEvent<HTMLDivElement>) {
    updateSceneLighting(event);
    const pointer = pointerRef.current;
    if (!pointer) return;
    const distance = event.clientX - pointer.startX;
    if (Math.abs(distance) > 6) movedRef.current = true;
    const elapsed = Math.max(8, event.timeStamp - pointer.lastTime);
    const instantVelocity = (event.clientX - pointer.lastX) / elapsed;
    pointer.velocity = pointer.velocity * 0.64 + instantVelocity * 0.36;
    pointer.lastX = event.clientX;
    pointer.lastTime = event.timeStamp;
    targetRef.current = pointer.angle + distance * 0.33;
    if (movedRef.current) setAutoPlay(false);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!pointer) return;
    pointerRef.current = null;
    const distance = event.clientX - pointer.startX;
    if (Math.abs(distance) > 6) {
      // Gentle inertial projection, then a magnetic snap to the nearest face.
      const projected = targetRef.current + Math.max(-26, Math.min(26, pointer.velocity * 42));
      const snapped = Math.round(projected / 60) * 60;
      targetRef.current = snapped;
      velocityRef.current += Math.max(-5.5, Math.min(5.5, pointer.velocity * 4.5));
      setSelected(((-Math.round(snapped / 60)) % ITEMS.length + ITEMS.length) % ITEMS.length);
      setAutoPlay(false);
    } else {
      targetRef.current = pointer.angle;
    }
    if (pointer.capturedBy?.hasPointerCapture(event.pointerId)) {
      pointer.capturedBy.releasePointerCapture(event.pointerId);
    }
  }

  function resetStage() {
    tiltTargetRef.current = 0;
    setIsHovering(false);
    stageRef.current?.style.removeProperty("--light-x");
    stageRef.current?.style.removeProperty("--light-y");
  }

  function moveCard(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "touch") return;
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
    const y = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
    card.style.setProperty("--lean-x", (-y * 12).toFixed(2) + "deg");
    card.style.setProperty("--lean-y", (x * 12).toFixed(2) + "deg");
    card.style.setProperty("--glint-x", ((x + 0.5) * 100).toFixed(1) + "%");
    card.style.setProperty("--glint-y", ((y + 0.5) * 100).toFixed(1) + "%");
  }

  function resetCard(event: PointerEvent<HTMLButtonElement>) {
    const card = event.currentTarget;
    card.style.removeProperty("--lean-x");
    card.style.removeProperty("--lean-y");
    card.style.removeProperty("--glint-x");
    card.style.removeProperty("--glint-y");
  }

  function moveText(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    const target = event.currentTarget;
    const box = target.getBoundingClientRect();
    const x = (event.clientX - box.left) / Math.max(box.width, 1) - 0.5;
    const y = (event.clientY - box.top) / Math.max(box.height, 1) - 0.5;
    target.style.setProperty("--text-tilt-x", (-y * 7).toFixed(2) + "deg");
    target.style.setProperty("--text-tilt-y", (x * 8).toFixed(2) + "deg");
    target.style.setProperty("--text-glow-x", ((x + 0.5) * 100).toFixed(1) + "%");
  }

  function resetText(event: PointerEvent<HTMLElement>) {
    const target = event.currentTarget;
    target.style.removeProperty("--text-tilt-x");
    target.style.removeProperty("--text-tilt-y");
    target.style.removeProperty("--text-glow-x");
  }

  function moveButton(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "touch") return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--glint-x", ((event.clientX - rect.left) / Math.max(rect.width, 1) * 100).toFixed(1) + "%");
  }

  function resetButton(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.style.removeProperty("--glint-x");
  }

  const current = ITEMS[selected];
  const category = categories.find((candidate) =>
    current.aliases.includes(candidate.slug.toLowerCase()),
  );
  const currentProduct = category
    ? products.find((product) => product.categorySlug === category.slug)
    : undefined;
  const categoryHref = category ? "/shop/" + encodeURIComponent(category.slug) : "/shop";

  return (
    <section ref={rootRef} data-kultura-showroom className={styles.section} aria-label={isKa ? "KULTURA 3D კოლექციები" : "KULTURA interactive 3D collections"}>
      <div className={styles.backgroundGrid} aria-hidden="true" />
      <div className={styles.haze} aria-hidden="true" />
      <div className={styles.heading} onPointerMove={moveText} onPointerLeave={resetText}>
        <span className={styles.overline}>KULTURA / INTERACTIVE SHOWROOM / 2026</span>
        <h2>{isKa ? "აღმოაჩინე შენი ფორმა." : "EXPLORE THE FORM."}</h2>
        <p>{isKa ? "გადაატრიალე 3D ორბიტა და აირჩიე კატეგორია." : "Drag the 3D orbit. Select a collection. Discover the details."}</p>
      </div>

      <div className={styles.layout}>
        <div ref={stageRef} className={styles.stage} onPointerDown={startDrag} onPointerMove={drag}
          onPointerUp={endDrag} onPointerCancel={endDrag}
          onPointerEnter={() => setIsHovering(true)} onPointerLeave={resetStage}
          aria-label={isKa ? "კატეგორიების 3D ორბიტა" : "Interactive 3D category orbit"}>
          <div className={styles.halo} aria-hidden="true" />
          <div className={styles.spotlight} aria-hidden="true" />
          <div className={styles.floorGlow} aria-hidden="true" />
          <div className={styles.core} aria-hidden="true">
            <Image src="/images/kultura-globe-scene.webp" alt="" fill sizes="(max-width: 750px) 230px, 380px" loading="lazy" />
          </div>
          <div ref={wheelRef} className={styles.wheel}>
            {ITEMS.map((item, index) => {
              const match = categories.find((candidate) => item.aliases.includes(candidate.slug.toLowerCase()));
              const product = match ? products.find((entry) => entry.categorySlug === match.slug) : undefined;
              return (
                <div key={item.id} className={styles.orbitItem}
                  style={{ "--slot-angle": `${index * 60}deg` } as CSSProperties}>
                  <button className={styles.orbitCard + (selected === index ? " " + styles.currentCard : "")}
                    type="button" aria-label={(isKa ? item.ka : item.en) + " / " + (isKa ? "არჩევა" : "select")}
                    aria-pressed={selected === index}
                    onPointerMove={moveCard}
                    onPointerLeave={resetCard}
                    onClick={(event) => {
                      if (movedRef.current) { event.preventDefault(); movedRef.current = false; return; }
                      choose(index);
                    }}>
                    <span className={styles.cardGlint} aria-hidden="true" />
                    <span className={styles.cardArt}>
                      {product ? (
                        <Image src={product.image} alt={product.name} fill
                          sizes="(max-width: 750px) 190px, 270px" loading="lazy" />
                      ) : (
                        <CategorySculpture item={item} index={index} />
                      )}
                    </span>
                    <span className={styles.cardLogo} aria-hidden="true">KULTURA / 2026</span>
                    <span className={styles.cardFooter}>
                      <span>0{index + 1}</span>
                      <strong>{isKa ? item.ka : item.en}</strong>
                      <span className={styles.cardArrow}>↗</span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className={styles.sceneHint} aria-hidden="true">{isKa ? "გადაატრიალე ↔" : "DRAG TO ROTATE ↔"}</div>
        </div>

        <div className={styles.info} onPointerMove={moveText} onPointerLeave={resetText} aria-live="polite" aria-atomic="true">
          <span className={styles.infoIndex}>{String(selected + 1).padStart(2, "0")} <span>/ 06</span></span>
          <span className={styles.infoEyebrow}>{current.eyebrow}</span>
          <h3>{isKa ? current.ka : current.en}</h3>
          <p>{isKa ? current.kaDescription : current.enDescription}</p>
          {currentProduct && (
            <span className={styles.productLabel}>
              {isKa ? "კოლექციიდან" : "FROM THE COLLECTION"} / {currentProduct.name}
            </span>
          )}
          <Link className={styles.explore} href={categoryHref}>
            {category ? (isKa ? "კოლექციის ნახვა" : "EXPLORE COLLECTION") : (isKa ? "მაღაზიის ნახვა" : "BROWSE SHOP")}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>

      <div className={styles.controls} aria-label={isKa ? "აირჩიე კატეგორია" : "Select collection"}>
        <div className={styles.tabs}>
          {ITEMS.map((item, index) => (
            <button key={item.id} type="button" className={styles.tab}
              aria-pressed={selected === index}
              onPointerMove={moveButton} onPointerLeave={resetButton}
              onClick={() => choose(index)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {isKa ? item.ka : item.en}
            </button>
          ))}
        </div>
        <button type="button" className={styles.autoplay}
          aria-pressed={autoPlay}
          onPointerMove={moveButton} onPointerLeave={resetButton}
          onClick={() => setAutoPlay((value) => !value)}>
          {autoPlay ? "Ⅱ" : "▶"} <span>{autoPlay ? (isKa ? "პაუზა" : "PAUSE") : (isKa ? "ავტომატური ბრუნვა" : "AUTO ROTATE")}</span>
        </button>
      </div>
      <p className={styles.disclaimer}>{isKa
        ? "3D სექციის პირველი ვერსია: პროდუქტის ფოტოები კატალოგიდან; დანარჩენი ფორმები ილუსტრაციებია."
        : "Interactive preview. Product photography is from the catalog; other forms are conceptual illustrations."}</p>
    </section>
  );
}
