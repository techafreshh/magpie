# PRD — Magpie (community scam-message radar)

**Status:** Approved for build · **Owner:** solo hacker · **Last updated:** 2026-10-24
**Target event:** Appwrite Databases Hackathon (hackathon.appwrite.io) — submissions close **Oct 31, 2026, 11:59 PM PT** (= **Nov 1, 7:59 AM WAT**). Build window Oct 19–31; all code written from Oct 24 onward.

---

## 1. Executive Summary

Magpie is a community scam-message radar. Anyone can paste a suspicious SMS, email, or WhatsApp message and instantly get a verdict: **HIGH RISK**, **SUSPICIOUS**, or **no prior reports — unseen is not safe, stay sharp** — together with the matching community reports, their categories, similarity scores, and how many people reported the same scam before.

The core engine is a crowd-sourced corpus of reported scam messages stored in **Appwrite VectorsDB** as text embeddings. A pasted message is embedded **entirely client-side** (transformers.js, all-MiniLM-L6-v2, 384 dims) and matched against the corpus with a cosine kNN search. Because matching is semantic, **paraphrased scam variants that defeat keyword blocking still get caught** — that is the whole point of the product.

Signed-in users (magic-link auth) can report new scam messages. Near-duplicate submissions are **merged** into the existing report (its `report_count` increments) rather than polluting the corpus — so a single widespread scam shows as one report with "48 reports", a signal of how widely it is circulating. A public browse feed shows recent reports and category statistics.

**MVP goal:** a deployed, phone-friendly web app whose check → verdict → report → merge → browse loop works end-to-end on a seeded corpus of 300–500 scam texts, demonstrated in a 2–3 minute video, submitted before the deadline.

### Why this can win (judging alignment)

| Criterion | How Magpie scores it |
|---|---|
| Idea & innovation | Crowd-sourced vector corpus of scams; paraphrase-resistant matching; privacy angle: message text never leaves the device |
| Technical execution | Client-side ML + VectorsDB kNN; zero runtime API keys; merge-on-dedupe corpus hygiene |
| Design & experience | Glassy UI (GlassyUI), dark mode, similarity bars, one-glance verdict card |
| Usage of Appwrite Databases | VectorsDB is load-bearing: it IS the product (corpus, search, dedupe, feed, stats) — deliberately chosen, not incidental |

---

## 2. Mission

**Mission:** let anyone — no account, no install — find out in seconds whether the message on their screen is a known scam, and let the community's reports make every future check smarter.

**Core principles**

1. **Frictionless checking.** Check requires no auth, no download-or-wait beyond the one-time model cache; paste → verdict in seconds.
2. **The corpus is the product.** Every report makes the radar sharper; dedupe-merge keeps it clean and shows momentum (`report_count`).
3. **Privacy by architecture.** Message text is embedded on-device; only an opaque 384-dim vector is ever sent for matching. No LLM, no third-party embedding API, no server secrets in the runtime.
4. **Zero paid dependencies.** Everything runs on Appwrite Cloud free tier + free open-source models. No paid API anywhere in any flow.
5. **Honest uncertainty.** "No prior reports" is never presented as "safe" — unseen is not safe, stay sharp.

---

## 3. Target Users

**Primary persona — Nkechi, 27, Lagos.** Receives 5+ scam SMS/WhatsApp forwards a week (bank "ATS upgrade", fake delivery fees, investment "double your money"). Mid-level smartphone, data-conscious, would never install an app for this but will paste into a website. Wants a yes/no-ish answer and the reason.

**Secondary persona — Chidi, 34, community admin.** Runs a neighborhood WhatsApp group; forwards warnings. Wants evidence to share: matching reports, categories, report counts, recency.

**Tertiary persona — the reporter.** Anyone who just received a fresh scam not yet in the corpus; wants to warn others in <30 seconds (magic-link login, paste, pick category, submit).

Technical comfort: mainstream phone users; the app must work well on a mid-range Android browser (Chrome), remain fully usable on desktop.

---

## 4. MVP Scope

### In Scope

**Core functionality**
- [ ] Check flow (no auth): paste text → client-side embedding → VectorsDB `vectorCosine` kNN (k=10) → verdict card with tier, top matches, similarity bars, categories, report counts
- [ ] Verdict tiers: similarity ≥ 0.90 HIGH RISK · 0.80–0.89 SUSPICIOUS · below → "no prior reports — unseen is not safe, stay sharp" (thresholds centralized, tunable)
- [ ] Report flow (auth via magic link): paste message + category (**phishing · investment · advance_fee · delivery · romance · job_offer · other** — field-agnostic taxonomy, not finance-only) + channel (sms · whatsapp · email) → dedupe check → create or merge
- [ ] Merge logic: if best existing match similarity ≥ 0.95 → `updateDocument` increments `report_count`; UI confirms ("merged — now 48 reports"); else create new doc
- [ ] Browse: recent reports feed (sorted by `$createdAt` desc), category stats (counts via `Query.equal` + `total`), stats strip (total reports, reports this week)
- [ ] "Hide my own report" (the only moderation): reporters can hide documents they created
- [ ] "Report this message" CTA after an empty-result check, pre-filling the report form with the pasted text

**Technical**
- [ ] Client-side embeddings: transformers.js, all-MiniLM-L6-v2 quantized (~23 MB, cached after first load), Web Worker, load progress UI
- [ ] VectorsDB collection (dimension 384 via Custom dimension — **not** the Console's all-minilm model binding), HNSW cosine index
- [ ] Single embedding source everywhere (browser app + Node seed script both use the same transformers.js pipeline); `embed(text) → number[384]` behind one interface for fallback swap
- [ ] Seeding pipeline: Node script, 300–500 scam texts from public datasets + hand-written Nigerian-context variants + reworded variants; PII anonymized; backdated `$createdAt` via timestamp overrides; realistic `report_count` distribution
- [ ] Appwrite Auth magic link (magic URL tokens); session-aware UI states
- [ ] Responsive web only; dark mode by default with light option

**Deployment / submission**
- [ ] Vercel deploy with production domain registered as Appwrite platform
- [ ] Public GitHub repo (created during the hackathon window)
- [ ] README: architecture diagram, "why VectorsDB is the right database", dataset attribution, honest limitations (256-token truncation, permission tradeoffs)
- [ ] Demo video 2–3 min following the beat sheet (§7.4), submitted via hackathon dashboard before Oct 31 11:59 PM PT

### Out of Scope (deliberately NOT built)

- [ ] Admin panel / moderation beyond hide-own-report
- [ ] i18n beyond English
- [ ] Mobile app (responsive web only)
- [ ] LLM calls or any paid API anywhere
- [ ] User profiles, commenting, voting, leaderboards
- [ ] Real-time live updates of the feed
- [ ] Upload of screenshots/attachments (text paste only)
- [ ] Email ingestion/parsing (user pastes the text)

---

## 5. User Stories

1. **As a phone user** who received a suspicious SMS, **I want** to paste it and get a verdict in seconds, **so that** I know whether to reply, pay, or delete.
   *Example:* pastes "Your GTBank ATM has been blocked, click gtbank-verify[.]top" → verdict card: HIGH RISK, 93% match, phishing, 61 reports, top 3 matches with bars.
2. **As a recipient of a reworded scam**, **I want** paraphrased variants of known scams to still match, **so that** trivial rewording doesn't defeat the radar.
   *Example:* known seed says "Your account will be blocked soon"; pasted variant "URGENT!! your acct will be deactived 2day" → SUSPICIOUS (0.84), top matches shown.
3. **As a community member**, **I want** to browse recent scam reports and category stats without an account, **so that** I can see what's circulating this week.
   *Example:* feed shows delivery-fee scam from 2 days ago (143 reports); stats strip: 412 reports, investment 38%, phishing 27%…
4. **As a scam recipient**, **I want** to report a message with a category after a one-tap magic-link login, **so that** others get warned by my report.
   *Example:* signs in with email link, pastes message, picks "advance_fee", submits → appears in feed.
5. **As a reporter**, **I want** my near-duplicate report merged into the existing one with a visible count bump, **so that** the corpus stays clean and shows how widespread a scam is.
   *Example:* submits a message 0.97-similar to an existing report → toast "merged — now 48 reports", no new feed row.
6. **As a reporter who made a mistake**, **I want** to hide my own report, **so that** I can undo my contribution without admin help.
7. **As a check user with no match**, **I want** an honest "unseen is not safe" result plus a one-tap way to report the message, **so that** the corpus grows from exactly the checks that found nothing.
8. **Technical:** embeddings are computed client-side behind a single `embed()` interface, **so that** no message text is transmitted for embedding, no API keys exist in the runtime, and the source can be swapped to Appwrite's built-in Embeddings service with one file change if the spike fails.
9. **Technical:** all runtime data access uses the Appwrite web SDK gated by collection permissions (Read: Any; Create/Update: users), **so that** there is no custom server, no secret keys, and Appwrite's permission model is the security boundary.

---

## 6. Core Architecture & Patterns

```
┌────────────────────────────── Browser ──────────────────────────────┐
│  Vite + React 19 SPA (client-only) + Tailwind v4 + GlassyUI         │
│                                                                     │
│  CheckPage ──► embedWorker ──► transformers.js                      │
│     │                          (all-MiniLM-L6-v2, q8, 384 dims)     │
│     │  vector[384]                                                  │
│     ▼                                                               │
│  appwrite web SDK ──────────────►  Appwrite Cloud (fra)             │
│  · listDocuments(vectorCosine)      · VectorsDB: reports collection │
│  · createDocument/updateDocument    · Auth: magic link              │
└─────────────────────────────────────────────────────────────────────┘
                                        ▲
        Node seed script (offline) ─────┘  node-appwrite + API key
        transformers.js (same pipeline)    bulk create + timestamp
                                           overrides (no runtime key)
```

**Key architectural facts**

- **No custom backend.** The Next.js app is a client-side shell; all data access is Appwrite web SDK from the browser, gated by collection permissions. Zero API keys in the runtime — the only server key lives in the offline seed script's local `.env`.
- **Single database type compliance:** everything persistent lives in **one VectorsDB database** (`magpie` → collection `reports`). Appwrite Auth is not a database; nothing else stores state.
- **Embedding boundary:** all embedding goes through `lib/embedder.ts` (`embed(text) → Promise<number[]>`). Fallback implementation calls Appwrite's built-in `createTextEmbeddings` (server key) — swap is one file. **Never mix embedding sources** in stored vectors.
- **VectorsDB constraints honored:** metadata is free-form JSON filtered with dot-notation string queries (`metadata.category`), but **cannot be ordered** — feed sorts on system field `$createdAt`; seeding backdates timestamps via timestamp overrides. Stats use `Query.equal('metadata.category', …)` + `total`.
- **`$distance` semantics:** cosine distance (0 = identical). `similarity = 1 − $distance`. Thresholds live in one constants module.
- **Dedupe-before-write:** report flow runs the same kNN (k=1 effectively, read top-1 of k=10) before create; ≥0.95 → `updateDocument` increment, else `createDocument` with doc-level `delete:user:<uid>` permission for hide-own-report.

**Directory structure (planned)**

```
magpie/
├─ src/
│  ├─ pages/                # Check (home) · Report · Browse (+ Cluster map stretch)
│  ├─ components/
│  │  ├─ glassyui/          # GlassyUI registry output (shadcn add)
│  │  └─ …verdict-card, similarity-bars, report-form, feed-item…
│  └─ lib/
│     ├─ embedder.ts        # embed() interface + transformers.js impl (+ fallback)
│     ├─ appwrite.ts        # client setup, pinned appwrite@29.1.0
│     ├─ search.ts          # kNN query, similarity mapping, verdict tiers
│     ├─ reports.ts         # create/merge/hide
│     └─ constants.ts       # thresholds, categories, channels
├─ workers/embed.worker.ts  # Web Worker wrapping the pipeline
├─ scripts/seed.ts          # Node seeding (node-appwrite + transformers.js)
├─ data/seeds/              # corpus JSONL (text, category, channel, region, count)
├─ vercel.json              # SPA catch-all rewrite (magic-link callback route)
└─ .agents/PRDs/PRD.md
```

---

## 7. Tools / Features

### 7.1 Check flow (no auth)
- Paste box (Textarea, 1,000-char cap — model truncates at ~256 tokens; UI states it), "Check" button.
- Pipeline: `embed()` in worker → `listDocuments({ queries: [Query.vectorCosine('embeddings', vec), Query.limit(10)] })` (or `createQuery` body form) → map `$distance` → similarity → verdict.
- Verdict card: tier badge + color, headline copy, top 3–5 matches (text snippet, category chip, channel chip, region chip, report_count, similarity bar scaled 0–100%), timestamp ("first reported …").
- Below 0.80: "no prior reports" panel with honest copy + **"Report this message"** pre-filled CTA.

### 7.2 Report flow (auth)
- Magic-link login (email → token → `updateMagicURLSession` on return). Session-aware header.
- Form: message (pre-filled when arriving from check CTA), category select, channel select, region chip (free text w/ suggestions, display-only).
- On submit: embed → kNN top-1 ≥ 0.95 → `updateDocument` (`report_count + 1`, update `$updatedAt` naturally) → toast "merged — now 48 reports". Else `createDocument` (metadata: text, category, channel, region, first_seen ISO, reporter_id, hidden=false; permissions `[delete:user:<uid>]`).

### 7.3 Browse + stats
- Feed: `listDocuments` ordered `orderDesc('$createdAt')`, filter `notEqual('metadata.hidden', 'true')`, 25/page, client pagination.
- Stats strip: total reports (`limit(1)` → `total`), reports this week (`createdAfter`), per-category counts (6 × `equal`+`total`), top category callout.

### 7.4 Demo video beat sheet (2–3 min hard cap)
0:00 real scam SMS on screen → 0:20 paste → verdict + matching reports → 1:00 paste reworded variant → still caught (expect SUSPICIOUS; script it) → 1:30 report flow → merge into existing report ("now 48") → 2:00 feed + stats → 2:20 one-liner on why VectorsDB (+ privacy one-liner: text never left the device).

---

## 8. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Vite + React 19**, TypeScript, SPA | zero backend by design (Option A) — Next.js dropped; shell only. Vercel static deploy + `vercel.json` catch-all rewrite for SPA routes (magic-link callback) |
| Styling | Tailwind CSS v4 | GlassyUI requirement |
| Components | shadcn CLI (`shadcn@4.14.1` pinned) + **GlassyUI registry** (`@glassyui/*`) | glass surfaces, dark/light via GlassProvider |
| Database | **Appwrite VectorsDB** (Cloud, region **fra**) | the one database; dimension 384 via Custom dimension |
| SDK (runtime) | `appwrite@29.1.0` (pinned) | `VectorsDB` service + `Query.vectorCosine` confirmed in this version |
| SDK (seed script) | `node-appwrite` latest + API key (scopes: vectorsdb write, documents write) | offline only |
| Embeddings | `@huggingface/transformers` v3, `Xenova/all-MiniLM-L6-v2`, quantized (~23 MB) | browser worker + Node seed share pipeline |
| Auth | Appwork Auth magic URL | free built-in email |
| Hosting | Vercel | register domain as Appwrite platform |
| Data sources | **Recent/local:** `electricsheepafrica/africa-smishing-sms-phishing` (HF, 10k rows from 2023–2025 African threat reports; synthetic-but-audited, Nigeria + English subsets; ~150 selected) · **Classic anchors:** UCI SMS Spam Collection (CC BY 4.0), SpamAssassin public corpus, `Nigerian_Fraud.csv` + `Nazario.csv` (CC BY-SA 4.0 mirror) · **Hand-written:** Nigerian-context texts + reworded variants | all verified live 2026-10-24; anonymize PII in classic corpora; attribute in README |

---

## 9. Security & Configuration

- **Auth:** Appwrite magic link, required only for report/hide. Check and browse are anonymous (Read permission: `Any`).
- **Authorization model:** collection-level Read:Any; Create/Update: `users` (Update needed so any signed-in user can merge-increment; accepted tradeoff — documented in README). Delete (hide own): **doc-level** `delete:user:<uid>` granted at creation — users can only remove their own reports.
- **Secrets:** none in the app runtime. Seed script's API key in local `.env` (never committed); Vercel env vars are public-by-design values only (`NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, database/collection IDs).
- **Privacy:** message text embedded on-device; only vectors transmitted for search. Report submissions intentionally publish the pasted text to the public corpus (that's the product); users can hide their own submissions.
- **Input hygiene:** paste cap 1,000 chars; render all user text as text (no HTML injection); anonymization pass on seeds.
- **Security out of scope:** rate-limiting beyond Appwrite defaults, spam-resistant Sybil protection on report counts, content moderation.

---

## 10. API Specification

No custom REST endpoints (zero-backend architecture). Runtime surface = Appwrite web SDK:

```ts
// CHECK (anonymous)
const res = await vectorsDB.listDocuments({
  databaseId, collectionId,
  queries: [Query.vectorCosine('embeddings', vec), Query.limit(10)],
});
// doc.$distance → similarity = 1 - doc.$distance

// REPORT — dedupe then create or merge
const top = res.documents[0];
if (top && 1 - top.$distance >= MERGE_THRESHOLD /* 0.95 */) {
  await vectorsDB.updateDocument({ databaseId, collectionId, documentId: top.$id,
    data: { metadata: { ...top.metadata, report_count: top.metadata.report_count + 1 } } });
} else {
  await vectorsDB.createDocument({ databaseId, collectionId, documentId: ID.unique(),
    data: { embeddings: vec, metadata: { text, category, channel, region,
      first_seen: new Date().toISOString(), reporter_id: user.$id, hidden: false } },
    permissions: [`delete:user:${user.$id}`] });
}

// FEED
listDocuments({ queries: [Query.orderDesc('$createdAt'), Query.notEqual('metadata.hidden','true'),
  Query.limit(25), Query.offset(page*25)] });

// STATS (per category c)
listDocuments({ queries: [Query.equal('metadata.category', c), Query.limit(1)] }).total
```

**Seeding (offline, node-appwrite + API key):** bulk create with timestamp overrides to backdate `$createdAt`; embeddings generated by the same transformers.js pipeline; `report_count` sampled 1–90; `first_seen` consistent with backdating; region assigned to Nigerian cities/regions.

**Thresholds:** `HIGH = 0.90`, `SUSPICIOUS = 0.80`, `MERGE = 0.95` — single constants module, tuned in Phase 4 against held-out paraphrase pairs.

---

## 11. Success Criteria

**MVP = shipped before deadline with all demo beats working on a real phone.**

- [ ] Check flow returns verdict + matches < 3 s after paste on a warm cache (model pre-loaded)
- [ ] Identical/near-identical known scam → HIGH RISK (≥ 0.90)
- [ ] Hand-written reworded variant of a seeded scam → ≥ SUSPICIOUS (0.80–0.89+)
- [ ] Truly novel innocuous text → "no prior reports" panel, correct honest copy
- [ ] Report without login blocked; magic-link login → report lands in feed
- [ ] Near-duplicate report merges (count increments, no new row); fresh report creates row
- [ ] Feed + stats reflect seeded + live data; hidden reports excluded
- [ ] Deployed on Vercel; magic link round-trips on the production domain
- [ ] Demo video ≤ 3 min covering all beats; repo public with README + attributions
- [ ] Zero paid APIs; app runtime contains no secrets

**Quality indicators:** Lighthouse mobile ≥ 85; verdict card legible on 5" screen; corpus of ≥ 300 texts; no PII in seeds.

---

## 12. Implementation Phases

**Phase 1 — Foundation & spike (Sat Oct 24 – Sun Oct 25)** — *Goal: prove or kill the architecture in 48h.*
- [ ] Repo + Next.js scaffold (React 19, Tailwind v4, shadcn + GlassyUI install)
- [ ] Appwrite project (fra), VectorsDB `magpie`/`reports` (dimension 384, custom), HNSW cosine index, permissions
- [ ] `lib/embedder.ts` + worker; load-progress UI
- [ ] Spike: embed 50 seeded texts via Node script, `vectorCosine` search from browser, `$distance` on screen
- **Validation:** browser kNN returns sensible neighbors for 3 test texts; model caches across reload

**Phase 2 — Core flows (Mon Oct 26 – Tue Oct 27)** — *Goal: the product's two verbs work.*
- [ ] Verdict card + similarity bars + tier logic
- [ ] Magic-link auth; session states
- [ ] Report flow with dedupe/merge; merge toast
- [ ] Hide-own-report
- **Validation:** full check → report → merge loop on dev; thresholds module in place

**Phase 3 — Browse, stats, polish (Wed Oct 28)** — *Goal: the app looks like something to trust.*
- [ ] Feed + pagination; stats strip; category/channel/region chips; category bar chart
- [ ] Dark mode + glass polish; empty/loading states (Skeleton); mobile pass
- [ ] **Stretch (cut first if time-pressed): cluster-map page** — force-directed similarity graph of the corpus (nodes = reports, edges = similarity ≥ ~0.75, clusters = scam campaigns); precompute edges at seed time, render d3-force in SVG/canvas
- **Validation:** Lighthouse mobile ≥ 85; feed on real phone

**Phase 4 — Data, tune, ship (Thu Oct 29 – Sat Oct 31)** — *Goal: submit early, not at the wire.*
- [ ] Seed 300–500 texts (anonymized, backdated, count distribution); scale to full corpus
- [ ] Threshold tuning vs held-out paraphrase pairs; finalize demo script beats
- [ ] Vercel deploy + platform/redirect config; phone testing; freeze features Fri
- [ ] Record demo video; README (architecture, why VectorsDB, limitations, attribution)
- [ ] Submit via dashboard by **Oct 31 evening WAT** (deadline 7:59 AM Sun WAT — do not use the margin)
- **Validation:** all §11 boxes checked; submission receipt in dashboard

---

## 13. Future Considerations (post-hackathon)

- Multilingual corpus (Appwrite's `embedding-gemma` 768/100+ languages when it ships)
- Channel-aware search boosts; region-aware weighting; trend alerts ("new phishing wave this week")
- URL extraction + known-bad-domain list as a secondary signal
- Browser extension / WhatsApp share-target integration ("share to Magpie")
- Moderation queue + reporter reputation; ODK-style structured collection drives
- Optional server route using Appwrite built-in embeddings for a no-download tier

---

## 14. Risks & Mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | transformers.js first-load/perf on mid-range phones (23 MB, WASM) | quantized model in Web Worker, progress UI, aggressive caching; demo pre-warm; `embed()` interface enables one-file fallback to Appwrite built-in `all-minilm` via a thin server route |
| 2 | Threshold miscalibration (paraphrases often land 0.75–0.88, not ≥ 0.90) | tune on held-out pairs in Phase 4; thresholds in one module; demo script embraces SUSPICIOUS as the "caught reworded variant" beat |
| 3 | Merge beat unreliable in the video (0.95 rarely triggers on reworded paste) | rehearse with near-verbatim resubmission; seeds carry inflated `report_count` (e.g., 47 → "now 48") |
| 4 | VectorsDB is new; SDK/API churn | pin `appwrite@29.1.0`; spike on day 1; Appwrite Discord for blockers; raw query-string fallback if a helper is missing |
| 5 | Magic-link email deliverability on the demo device | test on the actual phone in Phase 3; fallback: pre-created session via console for recording |
| 6 | Time compression (7 days vs planned 9) | demo-critical path first (check → merge → feed); browse/stats are D3; freeze Friday; submit Saturday evening WAT |

---

## 15. Appendix

**Verified references**
- Hackathon: https://hackathon.appwrite.io/ (+ `/rules`) — dates, solo rule, one-database rule, 4 judging criteria, submission mechanics (repo + 2–3 min video)
- VectorsDB docs: overview, vector-search (`Query.vectorCosine`, `$distance`, HNSW, `createQuery` body form), embeddings (`createTextEmbeddings`, server-key requirement, `all-minilm` 384 = $0.05/1M tokens, free 1M tokens/mo), queries (dot-notation metadata filters, values-as-strings), order (**system fields only**), permissions (collection/doc level), bulk ops, timestamp overrides
- Web SDK `appwrite@29.1.0`: `VectorsDB` service + `Query.vectorCosine` verified in shipped type definitions
- Model: https://huggingface.co/Xenova/all-MiniLM-L6-v2 — `model_quantized.onnx` ≈ 23 MB (fp32 ≈ 90 MB)
- GlassyUI: https://glassyui.com — shadcn-registry, React 19 + Tailwind v4, MIT

**Seed corpus sources (all fetched and verified live on 2026-10-24)**

| Source | Channel | Categories | Est. selected | License | Status |
|---|---|---|---|---|---|
| UCI SMS Spam Collection (5,574 SMS, 747 spam) | sms | mostly other/prize; some phishing | ~120 | CC BY 4.0 (UCI page) | mirror verified (747 spam lines) |
| SpamAssassin public corpus (`20021010_spam`, `20030228_spam*`) | email | phishing, investment (pump), advance_fee (419), other | ~120 | free for research (Apache SpamAssassin) | index verified live |
| `rokibulroni/Phishing-Email-Dataset` → `Nigerian_Fraud.csv` | email | advance_fee (classic 419 letters) | ~60 | CC BY-SA 4.0 (repo readme) | CSV header + content verified |
| `rokibulroni/Phishing-Email-Dataset` → `Nazario.csv` | email | phishing | ~40 | CC BY-SA 4.0 | CSV verified (needs noise filtering) |
| Hand-written Nigerian-context texts | sms/whatsapp | phishing (bank "ATS/app upgrade"), investment, delivery-fee, romance | ~100 | original | to write in Phase 4 |
| Hand-written reworded variants of all above | mixed | all | ~80 | original | doubles as threshold-tuning set |

Notes: public corpora are 2002–2012 era — 419/phishing scripts are semantically stable so they still match modern variants, but current local scams (bank app/ATS upgrade SMS, delivery-fee, romance scripts) must come from the hand-written set. Anonymization pass required: scrub real names, phone numbers, emails, quoted reply chains/headers. No public romance-scam *text* corpus exists (only statistics datasets) — romance is hand-written by design.

**Key decisions log**
1. Embeddings: **client-side transformers.js (Option A)** — privacy pitch; fallback to Appwrite built-in behind `embed()` interface. Never mix sources.
2. Appwrite region: **Frankfurt (fra)**.
3. Collection dimension: **384 via Custom dimension** (not Console model binding).
4. Feed ordering: `$createdAt` only (metadata unorderable); seeds backdated.
5. Merge permission: collection-level Update for `users`; delete-own via doc-level permission.
6. Name: **Magpie**. UI: GlassyUI glass, dark-first.
7. **Framework: Vite + React 19 SPA** (not Next.js) — app is client-only; static Vercel deploy + SPA rewrite.
8. **Category taxonomy (field-agnostic):** phishing · investment · advance_fee · delivery · romance · job_offer · other. Matching itself is domain-agnostic (semantic); categories only power chips/filters/stats.
9. **Data layering:** classic corpora = timeless anchors; `africa-smishing` (2023–2025 patterns, synthetic-but-audited, zero PII) = recent/local layer; hand-written + reworded variants = local flavor + tuning set; live user reports = ongoing currency.
10. **Cluster map = stretch goal** (Phase 3, first thing cut under time pressure).

**Compliance check vs hackathon rules**
- Built from scratch in-window: ✓ (all code Oct 24+, libs listed in README)
- Solo: ✓ · One database type (VectorsDB): ✓ · Deadline: submit Oct 31 evening WAT: ✓
