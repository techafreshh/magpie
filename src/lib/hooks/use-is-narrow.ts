import { useEffect, useState } from "react";

/**
 * Returns true on viewports under 640px (Tailwind's `sm:` boundary — 640px
 * itself still counts as desktop). Mirrors the `use-hover-capable.ts` idiom:
 * `useState(false)` default, `matchMedia` + `change`-listener in `useEffect`,
 * no `window` access at module or render scope (SSR-safe).
 */
export function useIsNarrow() {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return isNarrow;
}
