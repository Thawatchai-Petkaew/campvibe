"use client";

// CAM-237 LAUNCH-1: Mascot walk-sprite animation for the coming-soon holding page.
// Cycles 2 walk-front-right frames at 350ms per frame.
// Respects prefers-reduced-motion: shows only frame 0, no interval.
// Uses a plain <img> — NOT next/image — so sprites are served directly from
// the immutable-cached /public/status-map/sprites/* path at $0 optimizer cost.

import { useEffect, useRef, useState } from "react";

const FRAMES = [
  "/status-map/sprites/walk-front-right-0.webp",
  "/status-map/sprites/walk-front-right-1.webp",
] as const;

const FRAME_MS = 350;

interface SpriteWalkerProps {
  /** Alt text from the i18n comingSoon.mascotAlt key */
  alt: string;
}

export function SpriteWalker({ alt }: SpriteWalkerProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Do not start the interval when the user prefers reduced motion.
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) return;

    intervalRef.current = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % FRAMES.length);
    }, FRAME_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <img
      src={FRAMES[frameIndex]}
      alt={alt}
      width={96}
      height={96}
      data-testid="img--coming-soon-mascot"
      className="w-24 h-24 md:w-32 md:h-32"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
