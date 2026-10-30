/**
 * Site-wide header: brand + theme toggle. Reporting is anonymous, so there is
 * no session surface here — the device-local reporter identity
 * (`../lib/reporter`) never renders (it only powers hide-own ownership).
 *
 * Public surface: `Header`.
 */
import { useEffect } from 'react';
import { Link } from 'react-router';
import { GlassButton } from './glassyui/glass-button';
import { usePreferences } from './glassyui/glass-provider';

/** ThemeToggle (issue #17): flips the GlassyUI preference — which the provider
 * persists synchronously to localStorage (key `glassy-ui-preferences`) and
 * mirrors onto `<html data-lg-theme>` — and additionally mirrors the theme onto
 * `documentElement.classList` (contains `dark` ↔ light state). GlassyUI itself
 * never touches classes, so the class mirror is this toggle's job, re-synced on
 * restore (e.g. after a reload with a persisted choice). */
export function ThemeToggle() {
  const { preferences, setPreferences } = usePreferences();
  const dark = preferences.theme === 'dark';

  function toggle() {
    const next = dark ? 'light' : 'dark';
    setPreferences({ theme: next });
    document.documentElement.classList.toggle('dark', next === 'dark');
  }

  // Keep the class in step with the provider state — this is what restores
  // the persisted choice after a reload (and covers the initial mount).
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <GlassButton
      type="button"
      variant="ghost"
      size="sm"
      data-testid="theme-toggle"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className="min-h-[44px] min-w-[44px]"
    >
      {dark ? '☾' : '☀'}
    </GlassButton>
  );
}

export function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[40rem] items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="text-lg font-bold tracking-tight text-slate-100">
          Magpie
        </Link>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
