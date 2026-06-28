"use client";

/**
 * useMinimumLoading — CAM-246 (LOAD-2)
 *
 * Anti-flicker hook for client-fetch skeletons (loading-ui-standard §S4).
 *
 * Returns `showSkeleton: boolean` that:
 *  - becomes `true` only after `isLoading` has been continuously `true`
 *    for at least `delay` ms (delay-before-show — fast loads never flash a skeleton).
 *  - stays `true` for at least `minDisplay` ms once shown, even if `isLoading`
 *    flips to `false` before that window elapses (min-display — no flicker-off).
 *
 * Consumed by LOAD-3 (dashboard, profile, bookings client-fetch routes).
 *
 * SSR-safe: no window/DOM access at module import time.
 * Memory-leak-safe: all timers are cleared on unmount and on `isLoading` transitions.
 *
 * @param isLoading   Current loading state from the data-fetch layer.
 * @param opts.delay       ms to wait before showing the skeleton (default 300).
 * @param opts.minDisplay  ms the skeleton stays visible once shown (default 400).
 */

import { useState, useEffect, useRef } from "react";

export interface UseMinimumLoadingOptions {
  /** ms of continuous loading before the skeleton appears. Default: 300 */
  delay?: number;
  /** ms the skeleton stays visible after it appears, even if loading finishes. Default: 400 */
  minDisplay?: number;
}

export function useMinimumLoading(
  isLoading: boolean,
  opts?: UseMinimumLoadingOptions
): boolean {
  const delay = opts?.delay ?? 300;
  const minDisplay = opts?.minDisplay ?? 400;

  const [showSkeleton, setShowSkeleton] = useState(false);

  // Track when the skeleton became visible so we can enforce minDisplay.
  const shownAtRef = useRef<number | null>(null);

  // Ref so the cleanup effect always sees the current timer id without re-subscribing.
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading) {
      // Clear any pending hide timer from a previous load cycle.
      if (minDisplayTimerRef.current !== null) {
        clearTimeout(minDisplayTimerRef.current);
        minDisplayTimerRef.current = null;
      }

      // Start the delay-before-show timer.
      delayTimerRef.current = setTimeout(() => {
        shownAtRef.current = Date.now();
        setShowSkeleton(true);
        delayTimerRef.current = null;
      }, delay);

      return () => {
        // Loading became false (or component unmounted) before delay elapsed.
        // Cancel the show timer — a fast load never flashes the skeleton.
        if (delayTimerRef.current !== null) {
          clearTimeout(delayTimerRef.current);
          delayTimerRef.current = null;
        }
      };
    } else {
      // isLoading just became false.
      // Cancel the delay timer in case it was still pending.
      if (delayTimerRef.current !== null) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }

      if (!showSkeleton) {
        // Skeleton was never shown — nothing to hide.
        return;
      }

      // Skeleton is currently shown. Enforce minDisplay.
      const elapsed = shownAtRef.current !== null ? Date.now() - shownAtRef.current : 0;
      const remaining = Math.max(0, minDisplay - elapsed);

      minDisplayTimerRef.current = setTimeout(() => {
        shownAtRef.current = null;
        setShowSkeleton(false);
        minDisplayTimerRef.current = null;
      }, remaining);

      return () => {
        if (minDisplayTimerRef.current !== null) {
          clearTimeout(minDisplayTimerRef.current);
          minDisplayTimerRef.current = null;
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Cleanup on unmount — clear any outstanding timers to prevent memory leaks
  // and state updates on an unmounted component.
  useEffect(() => {
    return () => {
      if (delayTimerRef.current !== null) {
        clearTimeout(delayTimerRef.current);
      }
      if (minDisplayTimerRef.current !== null) {
        clearTimeout(minDisplayTimerRef.current);
      }
    };
  }, []);

  return showSkeleton;
}
