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
import { Link } from 'react-router';
import { getAccount } from '../lib/appwrite';
import { useSession } from '../lib/useSession';

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
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="text-lg font-bold tracking-tight text-slate-100">
          Magpie
        </Link>
        {session.status === 'user' ? (
          <div className="flex items-center gap-4">
            <span data-testid="header-user" className="text-sm text-slate-300">
              {session.user.email || 'signed in'}
            </span>
            <button
              type="button"
              data-testid="sign-out"
              onClick={handleSignOut}
              className="rounded-xl border border-slate-700 px-4 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        ) : (
          // `checking` renders like anonymous — the link never flickers while account.get() resolves.
          <Link
            to="/login"
            data-testid="sign-in"
            className="text-sm text-sky-400 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
