import { useEffect, useState } from 'react';
import { checkAppwrite } from './appwrite';
import type { AppwriteHealth } from './appwrite';

const initial: AppwriteHealth = { configured: false, ok: false, detail: 'checking' };

/** Runs checkAppwrite() once on mount; StrictMode-safe (no state set after unmount). */
export function useAppwriteHealth(): AppwriteHealth {
  const [health, setHealth] = useState<AppwriteHealth>(initial);

  useEffect(() => {
    let cancelled = false;
    checkAppwrite().then((result) => {
      if (!cancelled) setHealth(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return health;
}
