"use client";

import { Component, type ReactNode } from "react";

export interface ShaderErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Failure isolation for the pre-1.0 hero shader (issue #63): the lazy
 * `@paper-design/shaders-react` chunk can break at load (export churn) or at
 * render (WebGL/param churn). Either failure lands here instead of
 * white-screening `/` — the fallback is the same `.hero-gradient` CSS
 * gradient the mobile/reduced-motion path already renders, so the degraded
 * hero reads identically and the headline, paste box, and verdict flow stay
 * mounted and interactive.
 */
export class ShaderErrorBoundary extends Component<
  ShaderErrorBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    // No telemetry by design (out of scope for issue #63): the static
    // gradient is the approved degraded hero, nothing to report.
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div
          aria-hidden="true"
          className="hero-gradient pointer-events-none absolute inset-0 opacity-60"
        />
      );
    }
    return this.props.children;
  }
}
