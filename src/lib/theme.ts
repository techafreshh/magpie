/**
 * next-themes-shaped theme bridge over the GlassyUI preferences provider.
 *
 * beUI's theme toggle (`../components/motion/theme-toggle`) speaks the
 * next-themes `useTheme()` shape (`{ resolvedTheme, setTheme }`), but
 * Magpie's single source of truth is the GlassyUI provider
 * (`../components/glassyui/glass-provider`), which persists the choice to
 * localStorage (key `glassy-ui-preferences`) and mirrors it onto
 * `<html data-lg-theme>`. Mounting next-themes' own provider would fork a
 * second theme store and let the persisted key and the attribute mirror
 * drift — so this adapter exposes the next-themes shape backed entirely by
 * `usePreferences()`.
 *
 * `setTheme` toggles the legacy `dark` class mirror on `<html>`
 * synchronously (the old header toggle's job, kept so the View Transition
 * snapshot sees the landed theme), then calls `setPreferences({ theme })` —
 * the provider writes `data-lg-theme` synchronously and persists. A
 * `useEffect` re-applies the class from `resolvedTheme` so a reload
 * restores the mirror.
 *
 * Public surface: `useTheme`.
 */
import { useEffect } from 'react';
import { usePreferences } from '../components/glassyui/glass-provider';
import type { GlassyUiTheme } from '../components/glassyui/lib/preferences';

export type AppTheme = GlassyUiTheme;

function applyDarkClass(theme: GlassyUiTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function useTheme(): {
  resolvedTheme: GlassyUiTheme;
  setTheme: (theme: GlassyUiTheme) => void;
} {
  const { preferences, setPreferences } = usePreferences();
  const resolvedTheme = preferences.theme;

  // Restore the class mirror after reload (and cover initial mount).
  useEffect(() => {
    applyDarkClass(resolvedTheme);
  }, [resolvedTheme]);

  function setTheme(theme: GlassyUiTheme): void {
    // Synchronous so the View Transition snapshot runs under the new theme.
    applyDarkClass(theme);
    setPreferences({ theme });
  }

  return { resolvedTheme, setTheme };
}
