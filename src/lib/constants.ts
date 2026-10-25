/**
 * Central tuning knobs (PRD §"Verdict tiers", §"Thresholds"):
 * HIGH = 0.90, SUSPICIOUS = 0.80, MERGE = 0.95 — thresholds live here and
 * nowhere else, so a tuning pass never touches a call site.
 *
 * Public surface: `THRESHOLDS`, `CATEGORIES`, `CHANNELS`, the derived
 * `Category`/`Channel`/`VerdictTier` unions, `similarity()`, `verdictTier()`.
 */

/** Similarity cutoffs, tuned on held-out paraphrase pairs in Phase 4. */
export const THRESHOLDS = { HIGH: 0.90, SUSPICIOUS: 0.80, MERGE: 0.95 } as const;

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
/** Verdict tiers: ≥ 0.90 HIGH RISK · 0.80–0.89 SUSPICIOUS · below → no prior reports. */
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
