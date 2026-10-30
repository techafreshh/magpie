/**
 * Device-local reporter identity — the anonymous replacement for accounts.
 *
 * Reporting is open (no auth): a random UUID is generated once per browser
 * profile, persisted in localStorage, and stamped on every report created
 * from this device. The backend compares it against the stored document's
 * `reporter_id` to gate hide-own-report (issue #13) — the app's only
 * moderation. It proves nothing about *who* the reporter is (anyone can read
 * or change their local id); it only binds a report to the device that made
 * it, which is exactly the hide-own contract, nothing more.
 *
 * Public surface: `getReporterId()`, `useReporterId()`.
 */
import { useState } from 'react';

const STORAGE_KEY = 'magpie-reporter-id';

/** Read (or lazily create) this device's stable reporter id. */
export function getReporterId(): string {
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (privacy mode, blocked cookies) — fall
    // through and generate an ephemeral id for this page load.
  }
  if (!id) {
    id = crypto.randomUUID();
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Ephemeral identity: reports still work, hide-own just won't survive a reload.
    }
  }
  return id;
}

/**
 * The current device's reporter id, stable across renders (module-level id —
 * localStorage is read at most once per page load).
 */
export function useReporterId(): string {
  return useState(getReporterId)[0];
}
