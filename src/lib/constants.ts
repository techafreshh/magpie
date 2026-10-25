/**
 * Central tuning knobs (PRD §"Verdict tiers", §"Thresholds"):
 * HIGH = 0.90, SUSPICIOUS = 0.70, MERGE = 0.95 — thresholds live here and
 * nowhere else, so a tuning pass never touches a call site.
 *
 * SUSPICIOUS was retuned (issue #16) against the corpus's 80 held-out
 * `variant_of` pairs (`npm run tune`): measured variant sim spans 0.30–0.91
 * (median 0.79) while unrelated-text pairs stay ≤ ~0.40, so 0.80 caught only
 * 42.5% of true rewordings; 0.70 — still far above the unrelated-text noise
 * floor — catches 78.75%. HIGH and MERGE are untouched (only 2/80 variants
 * even reach 0.90 and none reach the 0.95 merge band). Final values and the
 * measured evidence: README → "Thresholds".
 *
 * Public surface: `THRESHOLDS`, `CATEGORIES`, `CHANNELS`, the derived
 * `Category`/`Channel`/`VerdictTier` unions, `similarity()`, `verdictTier()`.
 */

/** Similarity cutoffs — validated by `npm run tune` (issue #16) over the
 * committed corpus's held-out `variant_of` pairs; see README → "Thresholds". */
export const THRESHOLDS = { HIGH: 0.90, SUSPICIOUS: 0.70, MERGE: 0.95 } as const;

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
/** Verdict tiers: ≥ 0.90 HIGH RISK · 0.70–0.89 SUSPICIOUS · below → no prior reports. */
export type VerdictTier = 'HIGH_RISK' | 'SUSPICIOUS' | 'NO_REPORTS';

/** VectorsDB returns cosine *distance*; every consumer thinks in similarity. */
export function similarity(distance: number): number {
  return 1 - distance;
}

/** Map a similarity score to its verdict tier (inclusive lower bounds). */
export function verdictTier(similarity: number): VerdictTier {
  if (similarity >= THRESHOLDS.HIGH) return 'HIGH_RISK';
  if (similarity >= THRESHOLDS.SUSPICIOUS) return 'SUSPICIOUS';
  return 'NO_REPORTS';
}
