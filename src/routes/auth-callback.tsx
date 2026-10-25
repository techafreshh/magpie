/**
 * `/auth/callback` (issue #7): turn the magic link's token into a session.
 *
 * Appwrite redirects here with `?userId=…&secret=…` appended to the URL given
 * to `createMagicURLToken`. One guarded `account.updateMagicURLSession({ userId,
 * secret })` call consumes the token and sets the session cookie, then a hard
 * `window.location.assign('/')` reloads home so the route-independent header
 * re-resolves the session (a soft navigate would leave stale header state).
 *
 * Missing params and a consumed/invalid secret render recovery panels instead
 * of redirecting — every other outcome is a redirect home.
 *
 * Contract strings (`callback-invalid`, `callback-error`, `callback-error-copy`)
 * are the acceptance surface for this page.
 *
 * Public surface: default `AuthCallback`.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getAccount } from '../lib/appwrite';

const PANEL = 'rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const userId = params.get('userId');
  const secret = params.get('secret');
  const [error, setError] = useState<string | null>(null);
  // StrictMode double-invokes effects on the same instance: a magic secret
  // consumes on first use, so the second call would 401 and falsely show an
  // error even though sign-in succeeded.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!userId || !secret || firedRef.current) return;
    firedRef.current = true;
    let cancelled = false;
    try {
      // getAccount() throws synchronously when env is missing — before .catch()
      // can attach — so the guarded call must live in try/catch: a sync throw
      // takes the recovery panel instead of escaping the effect and unmounting
      // the tree (same fix as useSession in 2f848e7).
      getAccount()
        .updateMagicURLSession({ userId, secret })
        .then(() => {
          // Redirect regardless of `cancelled`: StrictMode's dev double-invoke
          // (setup -> cleanup -> setup) cancels the only in-flight call while
          // the fire-once guard blocks a re-fire, so gating the redirect on
          // `cancelled` would strand a signed-in user on this page. Redirecting
          // home is safe even post-unmount; only the error state write must
          // respect `cancelled`.
          window.location.assign('/');
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        });
    } catch (err) {
      if (!cancelled) setError(err instanceof Error ? err.message : String(err));
    }
    return () => {
      cancelled = true;
    };
  }, [userId, secret]);

  if (!userId || !secret) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[40rem] flex-col gap-8 px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Sign-in link</h1>
        <section aria-label="Invalid sign-in link" data-testid="callback-invalid" className={PANEL}>
          <p className="text-slate-200">
            This link is incomplete — it should carry <code>userId</code> and <code>secret</code>{' '}
            parameters from your sign-in email.
          </p>
          <div className="mt-4 flex gap-6">
            <Link to="/login" className="text-sky-400 underline-offset-4 hover:underline">
              Try signing in again
            </Link>
            <Link to="/" className="text-sky-400 underline-offset-4 hover:underline">
              ← Back home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[40rem] flex-col gap-8 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Signing you in…</h1>
      {error === null ? (
        <p role="status" className="font-mono text-sm text-slate-400">
          completing your session — redirecting home…
        </p>
      ) : (
        <section aria-label="Sign-in failed" data-testid="callback-error" className={PANEL}>
          <p role="alert" data-testid="callback-error-copy" className="font-mono text-sm text-amber-400">
            {error}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            The link may already have been used or has expired (they last one hour).
          </p>
          <div className="mt-4 flex gap-6">
            <Link to="/login" className="text-sky-400 underline-offset-4 hover:underline">
              Try signing in again
            </Link>
            <Link to="/" className="text-sky-400 underline-offset-4 hover:underline">
              ← Back home
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
