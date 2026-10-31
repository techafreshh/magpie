"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ShaderBackground } from "./motion/shader-background";

/** Named-color fallbacks when the token layer resolves empty (SSR/test). */
const FALLBACK_PRIMARY = "teal";
const FALLBACK_SECONDARY = "violet";

/** Below this viewport width the hero is a pure CSS gradient (no canvas):
 * the animated shader's continuous rAF/WebGL loop costs seconds of
 * main-thread time on a throttled mid-range phone, and even the STATIC
 * canvas paints late enough to become the LCP element. The gradient reads
 * identically; the animated mesh stays a desktop flourish. */
const STATIC_VIEWPORT_MAX = 767;

/**
 * Read the brand pair live from the token layer (`src/index.css`): the
 * shader library needs computed color values — neither a hex literal nor a
 * `var()` string survives the uniform — so resolve
 * `--color-primary`/`--color-secondary` via `getComputedStyle`, falling back
 * to named colors when empty. Memoized per mount; the light theme flips the
 * tokens, so a remount picks the theme up.
 */
function useBrandColors(): [string, string, string, string] {
  return useMemo(() => {
    if (typeof document === "undefined") {
      return [FALLBACK_PRIMARY, FALLBACK_SECONDARY, FALLBACK_PRIMARY, FALLBACK_SECONDARY] as [
        string,
        string,
        string,
        string,
      ];
    }
    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--color-primary").trim() || FALLBACK_PRIMARY;
    const secondary = css.getPropertyValue("--color-secondary").trim() || FALLBACK_SECONDARY;
    return [primary, secondary, primary, secondary];
  }, []);
}

/**
 * Hero band behind the home headline: a slow mesh-gradient in the brand
 * pair. Rendered through React.lazy from home.tsx so the shader library
 * never lands in the critical render path; frozen under reduced motion
 * (the shader's own reduced-motion freeze) and rendered as the STATIC mesh
 * on narrow viewports — the animated rAF/WebGL loop is a desktop flourish,
 * not something a throttled phone should pay for.
 */
export default function HeroShader() {
  const reduce = useReducedMotion();
  const colors = useBrandColors();
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${STATIC_VIEWPORT_MAX}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${STATIC_VIEWPORT_MAX}px)`);
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const animated = !reduce && !narrow;
  if (!animated) {
    // CSS gradient — paints with the first frame, never an LCP wait, no JS.
    return <div aria-hidden="true" className="hero-gradient pointer-events-none absolute inset-0 opacity-60" />;
  }
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <ShaderBackground variant="mesh-gradient" colors={colors} speed={0.4} className="opacity-60" />
    </div>
  );
}
