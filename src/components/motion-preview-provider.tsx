"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type PreviewState = { enabled: boolean; replay: number };
const Context = createContext<PreviewState>({ enabled: true, replay: 0 });

export function useMotionPreview() {
  return useContext(Context);
}

export function MotionPreviewProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.motionPreview = enabled ? "on" : "off";
    return () => { delete document.documentElement.dataset.motionPreview; };
  }, [enabled]);

  const change = (value: boolean) => {
    setEnabled(value);
    if (value) setReplay((count) => count + 1);
  };

  return (
    <Context.Provider value={{ enabled, replay }}>
      {children}
      <aside className="k-motion-lab" aria-label="Motion Preview comparison">
        <div className="k-motion-lab-heading"><span className="k-motion-lab-dot" /> MOTION LAB <span className="k-motion-lab-preview">PREVIEW ONLY</span></div>
        <div className="k-motion-lab-switch" role="group" aria-label="Compare preview motion with original">
          <button type="button" aria-pressed={!enabled} onClick={() => change(false)}>ORIGINAL</button>
          <button type="button" aria-pressed={enabled} onClick={() => change(true)}>MOTION +</button>
        </div>
        <button className="k-motion-lab-replay" type="button" onClick={() => setReplay((count) => count + 1)}
          disabled={!enabled} aria-label="Replay homepage Motion animations">
          ↻ REPLAY ANIMATIONS
        </button>
      </aside>
    </Context.Provider>
  );
}
