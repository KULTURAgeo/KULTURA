"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import styles from "@/app/drops/drops.module.css";

export function DropCountdown({ time, initialNow, locale }: { time: string; initialNow: number; locale: Locale }) {
  const launch = Date.parse(time);
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((launch - initialNow) / 1000)));
  const router = useRouter();
  useEffect(() => {
    const started = performance.now();
    const tick = () => {
      const next = Math.max(0, Math.ceil((launch - initialNow - (performance.now() - started)) / 1000));
      setSeconds(next);
      if (next === 0) {
        window.clearInterval(timer);
        router.refresh();
      }
    };
    const timer = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(timer);
  }, [initialNow, launch, router]);

  const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
  const labels = locale === "ka" ? ["დღე", "საათი", "წუთი", "წამი"] : ["Days", "Hours", "Minutes", "Seconds"];
  return (
    <dl className={styles.countdown} aria-label={locale === "ka" ? "დარჩენილი დრო" : "Time until launch"}>
      {labels.map((label, index) => <div key={label}>
        <dt>{label}</dt><dd>{String(values[index]).padStart(2, "0")}</dd>
      </div>)}
    </dl>
  );
}
