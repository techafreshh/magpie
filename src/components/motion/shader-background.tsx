"use client";
// beui.dev/components/motion/shader-background
//
// NOTE (issue #63): `@paper-design/shaders-react` is pre-1.0 (pinned to
// exactly 0.0.82), so the surface we import must stay minimal. The app
// renders exactly one shader — the `mesh-gradient` behind the home hero
// (see `src/components/hero-shader.tsx`) — and this wrapper intentionally
// exposes only that variant, so churn in the library's other ~20 components
// cannot break our build.

import { MeshGradient, type MeshGradientProps } from "@paper-design/shaders-react";
import { useReducedMotion } from "motion/react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

type ShaderVariantProps = {
  "mesh-gradient": MeshGradientProps;
};

export type ShaderBackgroundVariant = keyof ShaderVariantProps;

export type ShaderBackgroundProps = {
  [K in ShaderBackgroundVariant]: { variant: K } & ShaderVariantProps[K];
}[ShaderBackgroundVariant];

const VARIANT_COMPONENTS: {
  [K in ShaderBackgroundVariant]: ComponentType<ShaderVariantProps[K]>;
} = {
  "mesh-gradient": MeshGradient,
};

export const SHADER_BACKGROUND_VARIANTS = Object.keys(
  VARIANT_COMPONENTS,
) as ShaderBackgroundVariant[];

/**
 * Reduced motion freezes the mesh at speed 0, whether or not the caller
 * passed `speed`: the shader animates by default when it is left out.
 */
export function ShaderBackground({
  variant,
  className,
  ...rest
}: ShaderBackgroundProps) {
  const reducedMotion = useReducedMotion();
  const Shader = VARIANT_COMPONENTS[variant] as ComponentType<
    Record<string, unknown>
  >;
  const props = rest as Record<string, unknown>;
  const speedProps = reducedMotion ? { speed: 0 } : {};

  return (
    <Shader
      {...props}
      {...speedProps}
      className={cn("h-full w-full", className)}
    />
  );
}
