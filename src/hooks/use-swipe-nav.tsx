import { useEffect, useRef } from "react";

type Options = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal distance in px to count as a swipe. */
  threshold?: number;
  /** Maximum vertical/horizontal ratio (tan of angle). 0.5 ≈ 27°. */
  maxAngleRatio?: number;
  /** Minimum px/ms velocity. */
  minVelocity?: number;
  enabled?: boolean;
};

/**
 * Attach to a ref. Detects horizontal swipes while ignoring vertical scrolls.
 * Touch-only; trackpads use the bottom nav.
 */
export function useSwipeNav<T extends HTMLElement>(opts: Options) {
  const ref = useRef<T | null>(null);
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 60,
    maxAngleRatio = 0.5,
    minVelocity = 0.2,
    enabled = true,
  } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startT = performance.now();
      tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = performance.now() - startT;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < threshold) return;
      if (absY / absX > maxAngleRatio) return;
      if (absX / Math.max(dt, 1) < minVelocity) return;
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [enabled, onSwipeLeft, onSwipeRight, threshold, maxAngleRatio, minVelocity]);

  return ref;
}
