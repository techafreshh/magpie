/**
 * `/login` (issue #7): request an Appwrite magic-link token by email.
 *
 * Submits `account.createMagicURLToken({ userId, email, url })` with the
 * redirect URL computed from `window.location.origin` so every registered
 * platform (localhost, deployed domain) works unchanged. Success swaps the
 * form for the pinned "Check your inbox" panel; the emailed link lands on
 * `/auth/callback` (`src/routes/auth-callback.tsx`).
 *
 * Contract strings (`login-email`, `login-submit`, `login-sent`, the
 * "Check your inbox — we sent a magic link to" copy) are the acceptance
 * surface for this page.
 *
 * Public surface: default `Login`.
 */
import { useState } from 'react';
import { ID } from 'appwrite';
import { Link } from 'react-router';
import { getAccount } from '../lib/appwrite';

const PANEL = 'rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur';

export default function Login() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter an email address first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await getAccount().createMagicURLToken({
        userId: ID.unique(),
        email: trimmed,
        // Origin-flexible: Appwrite only allows hosts on the project platform list.
        url: `${window.location.origin}/auth/callback`,
      });
      setSentTo(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[40rem] flex-col gap-8 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>

      {sentTo === null ? (
        <form aria-label="Request a magic link" onSubmit={handleSubmit} className={PANEL}>
          <label htmlFor="login-email" className="block text-sm font-medium text-slate-300">
            Email address
          </label>
          <input
            id="login-email"
            data-testid="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-3 min-h-[44px] w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-base text-slate-200 placeholder:text-slate-600"
          />
          <button
            type="submit"
            data-testid="login-submit"
            disabled={busy}
            className="mt-4 min-h-[44px] min-w-[44px] w-fit rounded-xl bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? 'Sending magic link…' : 'Send magic link'}
          </button>
          {error && (
            <p role="alert" data-testid="login-error" className="mt-4 font-mono text-sm text-amber-400">
              {error}
            </p>
          )}
          <p className="mt-4 text-xs text-slate-500">
            No password — we email a one-time link that signs you in. Your email is only sent to
            Appwrite to create the token.
          </p>
        </form>
      ) : (
        <section aria-label="Magic link sent" data-testid="login-sent" className={PANEL}>
          <p data-testid="login-sent-copy" className="text-slate-200">
            Check your inbox — we sent a magic link to {sentTo}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            The link is valid for one hour and opens <code>/auth/callback</code>, which turns it
            into a session.
          </p>
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setEmail('');
            }}
            className="mt-4 min-h-[44px] min-w-[44px] w-fit rounded-xl border border-slate-700 px-4 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            Use a different email
          </button>
        </section>
      )}

      <Link to="/" className="text-sky-400 underline-offset-4 hover:underline">
        ← Back home
      </Link>
    </main>
  );
}
