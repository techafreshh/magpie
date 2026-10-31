"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import { ShaderBackground } from "./motion/shader-background";

/** Named-color fallbacks when the token layer resolves empty (SSR/test). */
const FALLBACK_PRIMARY = "teal";
const FALLBACK_SECONDARY = "violet";

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
 * (this `speed 0` gate plus the shader's own reduced-motion freeze).
 */
export default function HeroShader() {
  const reduce = useReducedMotion();
  const colors = useBrandColors();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <ShaderBackground
        variant="mesh-gradient"
        colors={colors}
        speed={reduce ? 0 : 0.4}
        className="opacity-60"
      />
    </div>
  );
}
