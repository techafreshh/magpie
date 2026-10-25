/**
 * Site-wide session-aware header (issue #7).
 *
 * Anonymous / unresolved (`checking`) renders the pinned "Sign in" link; a
 * confirmed session (`account.get()`) renders the user's email plus the
 * pinned "Sign out" button. Sign out deletes every Appwrite session, then
 * hard-reloads home — the header sits above `<Routes>` and never remounts on
 * route change, so a reload is the only way it re-runs `account.get()`.
 *
 * Contract strings (`Sign in`, `Sign out`, `header-user`) are pinned by the
 * issue's acceptance — keep them verbatim. `checking` renders exactly like
 * anonymous so "Sign in" never disappears between the pre-hydration shell
 * (`index.html`) and auth resolution.
 *
 * Public surface: `Header`.
 */
import { useEffect } from 'react';
import { Link } from 'react-router';
import { GlassButton } from './glassyui/glass-button';
import { usePreferences } from './glassyui/glass-provider';
import { getAccount } from '../lib/appwrite';
import { useSession } from '../lib/useSession';

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
  const session = useSession();

  async function handleSignOut() {
    try {
      // Deletes all sessions (including current) and clears the session cookie.
      await getAccount().deleteSessions();
    } catch {
      // Missing env or unreachable Appwrite still means "not signed in" — fall
      // through: the reload re-runs account.get() and the header settles.
    }
    window.location.assign('/');
  }

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[40rem] items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="text-lg font-bold tracking-tight text-slate-100">
          Magpie
        </Link>
        {/* flex-wrap keeps a 360px viewport inside the no-horizontal-scroll
            contract (issue #18): a row that cannot fit grows downward, never
            sideways; the email truncates so the row normally stays single-line. */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ThemeToggle />
          {session.status === 'user' ? (
            <>
              <span
                data-testid="header-user"
                className="min-w-0 max-w-[7rem] truncate text-sm text-slate-300"
              >
                {session.user.email || 'signed in'}
              </span>
              <button
                type="button"
                data-testid="sign-out"
                onClick={handleSignOut}
                className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-700 px-4 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Sign out
              </button>
            </>
          ) : (
            // `checking` renders like anonymous — the link never flickers while account.get() resolves.
            <Link
              to="/login"
              data-testid="sign-in"
              className="inline-flex min-h-[44px] items-center text-sm text-sky-400 underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
