"use client";

import { useReducedMotion } from "motion/react";
import { ShaderBackground } from "./motion/shader-background";

/** Brand teal/violet pair — mirrors --color-primary/--color-secondary in src/index.css. */
const BRAND_COLORS = ["#2dd4bf", "#a78bfa", "#2dd4bf", "#a78bfa"];

/**
 * Hero band behind the home headline: a slow mesh-gradient in the brand
 * pair. Rendered through React.lazy from home.tsx so the shader library
 * never lands in the critical render path; frozen under reduced motion.
 */
export default function HeroShader() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <ShaderBackground
        variant="mesh-gradient"
        colors={BRAND_COLORS}
        speed={reduce ? 0 : 0.4}
        className="opacity-60"
      />
    </div>
  );
}
