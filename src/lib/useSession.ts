import { useEffect, useState } from 'react';
import type { Models } from 'appwrite';
import { getAccount } from './appwrite';

export type SessionState =
  | { status: 'checking' }
  | { status: 'anonymous' }
  | { status: 'user'; user: Models.User<Models.Preferences> };

/**
 * Current Appwrite session, resolved once on mount via `account.get()`.
 * `checking` renders exactly like `anonymous` (see `Header`) so the "Sign in"
 * link never flickers while the session resolves; any failure — missing env,
 * 401, CORS, network — degrades to `anonymous`. StrictMode-safe (no state set
 * after unmount).
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;
    getAccount()
      .get()
      .then((user) => {
        if (!cancelled) setState({ status: 'user', user });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'anonymous' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
