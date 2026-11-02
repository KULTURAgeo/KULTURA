"use client";

import { MotionConfig } from "motion/react";
import { createContext, useContext, type ReactNode } from "react";

/**
 * Motion+ is the approved storefront experience.
 * This stable context keeps the established reduced-motion handling in each
 * component, without the temporary preview comparison or replay controls.
 */
type MotionState = { enabled: boolean; replay: number };
const motionState: MotionState = { enabled: true, replay: 0 };
const Context = createContext<MotionState>(motionState);

export function useMotionPreview() {
  return useContext(Context);
}

export function MotionPreviewProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return <MotionConfig nonce={nonce}><Context.Provider value={motionState}>{children}</Context.Provider></MotionConfig>;
}
