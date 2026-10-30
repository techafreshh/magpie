/**
 * Central tuning knobs (PRD §"Verdict tiers", §"Thresholds"):
 * HIGH = 0.90, SUSPICIOUS = 0.65, MERGE = 0.95 — thresholds live here and
 * nowhere else, so a tuning pass never touches a call site.
 *
 * SUSPICIOUS was retuned (issue #16) against the corpus's 80 held-out
 * `variant_of` pairs (`npm run tune`): measured variant sim spans 0.30–0.91
 * (median 0.79) while unrelated-text pairs stay ≤ ~0.40, so 0.80 caught only
 * 42.5% of true rewordings; the tuner's p20 rule suggested 0.65 (measured p20
 * 0.6923, floored to the 0.05 step) — still 0.25 above the same-category
 * different-narrative ceiling — and it catches 88.75% (71/80), clearing the
 * ≥ 80% acceptance bar. HIGH and MERGE are untouched (only 2/80 variants even
 * reach 0.90 and none reach the 0.95 merge band). Final values and the
 * measured evidence: README → "Thresholds".
 *
 * The backend (server.mjs) mirrors MERGE in its dedupe-before-write path and
 * hardcodes the same CATEGORIES/CHANNELS lists — this plain-TS module cannot
 * be imported by the zero-dependency JS server, so those copies must stay in
 * sync by hand (grep for "must mirror" in server.mjs).
 *
 * Public surface: `THRESHOLDS`, `CATEGORIES`, `CHANNELS`, the derived
 * `Category`/`Channel`/`VerdictTier` unions, `verdictTier()`.
 */

/** Similarity cutoffs — validated by `npm run tune` (issue #16) over the
 * committed corpus's held-out `variant_of` pairs; see README → "Thresholds". */
export const THRESHOLDS = { HIGH: 0.90, SUSPICIOUS: 0.65, MERGE: 0.95 } as const;

/** Field-agnostic scam taxonomy (PRD report flow) — order is UI order; phishing first. */
export const CATEGORIES = [
  'phishing',
  'investment',
  'advance_fee',
  'delivery',
  'romance',
  'job_offer',
  'other',
] as const;

/** Delivery channels a report can arrive on. */
export const CHANNELS = ['sms', 'whatsapp', 'email'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Channel = (typeof CHANNELS)[number];

/** Form defaults (report flow) — consumed by `src/routes/report.tsx`, so the
 * last category/channel literals live here too (issue #20: every visible
 * surface reads its vocabulary from this module). */
export const DEFAULT_CATEGORY: Category = 'other';
export const DEFAULT_CHANNEL: Channel = 'sms';

/** Verdict tiers: ≥ 0.90 HIGH RISK · 0.65–0.89 SUSPICIOUS · below → no prior reports. */
export type VerdictTier = 'HIGH_RISK' | 'SUSPICIOUS' | 'NO_REPORTS';

/** Map a similarity score to its verdict tier (inclusive lower bounds). */
export function verdictTier(similarity: number): VerdictTier {
  if (similarity >= THRESHOLDS.HIGH) return 'HIGH_RISK';
  if (similarity >= THRESHOLDS.SUSPICIOUS) return 'SUSPICIOUS';
  return 'NO_REPORTS';
}
