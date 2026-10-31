# Magpie 🐦‍⬛

**Community scam-message radar.** Paste any SMS, email, or WhatsApp message → it gets embedded **in your browser** and matched against a crowd-sourced corpus of reported scams. Get a verdict, a match score, and the matching reports — even for paraphrased variants that defeat keyword blocking.

> The magpie collects shiny things. This one collects scams.

Originally built for a databases hackathon (Oct 2026); since migrated to a self-hosted **Qdrant** vector database behind a thin own backend, served at **https://magpie.techa.pro**.

## How it works (in one breath)

Your message text never leaves your device: an embedding model (all-MiniLM-L6-v2, 384 dims) runs locally via transformers.js in a Web Worker. Only an opaque vector is sent to the Magpie backend, which runs a cosine kNN search against the community's scam reports in **Qdrant**. High similarity → HIGH RISK verdict, with the matching reports, categories, and report counts.

## Architecture

```
┌──────────────────────────── Browser ─────────────────────────────┐
│  React 19 SPA (Vite + Tailwind v4 + GlassyUI)                    │
│                                                                  │
│  CheckPage ──► embedWorker ──► transformers.js                   │
│     │                         (all-MiniLM-L6-v2, q8, 384 dims)   │
│     │  vector[384]                                               │
│     ▼                                                            │
│  fetch /api/*  (same-origin — no keys, no CORS)                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼───────────────────────────────────┐
│  Caddy edge (shared gateway)  ──►  magpie-web container           │
│  magpie.techa.pro                  server.mjs: static dist/ +     │
│                                    JSON API (zero-dependency Node)│
└──────────────────────────────┬───────────────────────────────────┘
                               │ http://qdrant:6333 (web_gateway)
┌──────────────────────────────▼───────────────────────────────────┐
│  Qdrant — collection magpie_reports                              │
│  384-dim Cosine vectors · payload: text, category, channel,      │
│  region, first_seen, reporter_id, hidden, report_count,          │
│  created_at (the feed's order_by key)                            │
└──────────────────────────────────────────────────────────────────┘
```

Key facts, each enforced in code rather than aspirational:

- **One collection is the whole database.** Every persistent thing is a point in the Qdrant collection `magpie_reports`: the vector powers kNN search and dedupe-merge, the payload powers the feed and stats ([`server.mjs`](server.mjs)).
- **A thin own backend is the only door to Qdrant.** The browser never talks to the vector database: the zero-dependency Node server ([`server.mjs`](server.mjs)) serves the built SPA and the JSON API (`/api/check`, `/api/reports`, `/api/feed`, `/api/stats`, `/api/health`) from one process. No SDK packages — the Qdrant REST API is plain JSON over HTTP via `fetch`.
- **Embedding boundary.** Every embedding goes through [`src/lib/embedder.ts`](src/lib/embedder.ts) (`embed(text)` → 384-dim vector), computed on-device in [`workers/embed.worker.ts`](workers/embed.worker.ts). Message text is only ever published when the user deliberately reports it — check submissions never transmit text at all. The documented one-file swap to a server-side embedder is the only alternative, and embedding sources are never mixed inside one corpus.
- **Similarity semantics.** Qdrant's Cosine distance returns a similarity *score* (1 = identical); the API passes it through as `similarity`, and the client maps it to verdict tiers via `verdictTier()` ([`src/lib/constants.ts`](src/lib/constants.ts)). Metadata filters ride Qdrant payload filters, and the feed sorts on the `created_at` payload field (datetime index) — seeds backdate it to the line's `first_seen` ([`scripts/seed.ts`](scripts/seed.ts)).
- **Reporting is anonymous.** No accounts anywhere: the report form is open, and a device-local random id ([`src/lib/reporter.ts`](src/lib/reporter.ts)) is stamped on each report as `reporter_id` — the backend compares it to gate hide-own-report, the app's only moderation. It binds a report to the browser that made it, nothing more (spoofable by design; see [Limitations](#limitations)).
- **Dedupe-before-write.** The report flow kNN-searches before every write: a new report ≥ 0.95 similar to an existing one *merges* into it (`report_count + 1`), else a new point is created with a deterministic ID (SHA-256 of the text → UUID), so re-submitting the same text rewrites one point instead of duplicating it ([`server.mjs`](server.mjs) `handleCreateReport`).

## Why Qdrant is the right database

1. **kNN is a query, not code.** Paraphrase-resistant scam matching is the product thesis, and Qdrant makes it one cosine query against the collection's HNSW index — no self-hosted vector math, no cosine loop anywhere in the app. The committed 80-variant tuning set is the measured proof: `npm run tune` shows 71/80 reworded scams clear the `SUSPICIOUS` boundary (see [Thresholds](#thresholds)).
2. **The corpus is the database.** The same collection serves check search, dedupe-merge (`handleCreateReport`), the public feed (`handleFeed`) and corpus stats (`handleStats`) — one store for everything persistent.
3. **Payload filters and sorting in-band.** Reports are free-form JSON payloads filtered with payload indexes — `hidden` (bool) powers the hide-own exclusion on feed/stats/search, `category` (keyword) powers the per-category stats counts, and `created_at` (datetime) sorts the feed newest-first. The one quirk — this Qdrant build rejects `offset` together with `order_by` — is designed around by scanning the newest `(page+1)×25` and slicing the page server-side, exact offset semantics in one round-trip.
4. **It was already running.** The VPS hosts a shared Qdrant on the `web_gateway` Docker network; Magpie adds one namespaced collection (`magpie_reports`) and never needs a new datastore provisioned.

What we considered instead: keyword/regex blocklists are defeated by exactly the reworded variants this corpus exists to catch; and client-side brute-force cosine over all 360 × 384 floats would ship the whole corpus to every phone — bandwidth and latency that Qdrant's HNSW does server-side in one query.

## Stack

- **Vite + React 19** + TypeScript + Tailwind CSS v4
- **GlassyUI** (shadcn-style glass component registry)
- **Qdrant** — the corpus *is* the database: embeddings, kNN search, dedupe-merge, feed, stats
- **Zero-dependency Node backend** ([`server.mjs`](server.mjs)) — static files + JSON API in one process, no runtime `node_modules`
- **transformers.js** — client-side embeddings, no LLM, no paid API anywhere

## UI

The redesign (issues #41–#49) is a dark-first glass system on a token layer — every page reads the same tokens, so the light theme flips as a whole and no page drifts.

**Palette.** Dark glass over `#0b0f14` (the `theme-color` meta matches it); iridescent accent pair teal → violet. The light state redefines the tokens on `html[data-lg-theme='light']` via the GlassyUI provider — the pre-hydration shell stays dark.

**Token layer** (`src/index.css`, `@theme static` — hex literals live here and nowhere else):

| Token | Dark | Light | Used for |
|---|---|---|---|
| `background` / `foreground` | `#0b0f14` / slate-200 | slate-100 / slate-900 | page backdrop / body text |
| `card` / `card-foreground` | `#131a24` / slate-200 | white / slate-900 | glass panels, rows, drawers (`bg-card/60` + `border-border`) |
| `border` / `input` | slate-800 | slate-200 | panel/row outlines, form controls |
| `primary` / `secondary` | teal `#2dd4bf` / violet `#a78bfa` | teal-600 / violet-500 | iridescent accents, hero shader (resolved live via `getComputedStyle`) |
| `muted` / `muted-foreground` | `#16202c` / slate-400 | slate-100 / slate-500 | skeleton tracks, similarity track, secondary text |
| `color-category-*` (×7) | fixed red/amber/orange/sky/pink/green/slate | same | per-category color — keys mirror `CATEGORIES` in `src/lib/constants.ts`, read as `var(--color-category-<name>)` by chips, the donut, and the map |

**beUI surface map** (one component per job, every route): panel → `GlassPanel`, button → `GlassButton`, badge → `GlassBadge` / `AnimatedBadge`, skeleton → `GlassSkeleton` (+ `animate-pulse`, settled under reduced motion), toast → `GlassToast` / `Toast`, tilt → `TiltCard`, drawer → `Drawer`.

**Display font.** `--font-display` (Space Grotesk Variable, self-hosted) — brand + headings only: the header brand link and every route `<h1>` carry `font-display`; body text stays on the system stack.

**Reduced motion.** Every animated surface freezes or renders settled under `useReducedMotion`: the shader hero (`speed 0`), the text-scramble headline, tilt/glare, the tier-badge pulse, count-ups, the donut sweep (`duration: 0`), feed swipes (plain Hide button), the map (ticked synchronously once, no frames), and the theme transition — plus a global `prefers-reduced-motion` guard in `src/index.css` that settles CSS-only animation.

## Getting started

```bash
npm install
```

Two processes for development (the browser code always fetches same-origin `/api/*`; Vite proxies it in dev):

```bash
npm run api        # backend on :8787 (reads .env.local for QDRANT_URL)
npm run dev        # Vite dev server on :5173, proxying /api → :8787
```

A production build and server:

```bash
npm run build      # tsc + vite build → dist/
npm start          # node server.mjs — serves dist/ + the API on :8080
```

`/` is the **check screen**: paste a message (capped at 1,000 characters, with a live counter and a truncation note), hit **Check**, and the verdict card answers with a tier badge, the top matches (snippet, category/channel/region chips, report count), and 0–100% similarity bars. `/report` is the open report form (message + category/channel/region, anonymous — stamped with the device-local reporter id) with a merge-aware success screen at `/report/success`. `/check` is the embedder debug surface (on-device embedding with a live progress log); `/health` renders a JSON health panel with `{"status":"ok","qdrant":"reachable"|"unreachable"}` based on a real collection query through the backend. `/browse` is the anonymous recent-reports feed — 25 newest non-hidden reports per page (text snippet, category/channel/region chips, report count, relative age) with Prev/Next pagination, topped by a stats strip showing the corpus total, the last-7-days count, one count per category, and a top-category callout. `/map` is the corpus constellation — a force-directed canvas of reports by pairwise similarity with a threshold slider, category legend, and tap-to-open drawer (see [Vector map](#vector-map)). Reports created from your browser carry a Hide button — the app's only moderation: a confirm-guarded soft-hide that sets the point's `hidden` payload to `true`, removing it from feed and search for everyone without touching the stored vector.

## Environment

The browser app has **no configuration** — every request is same-origin, and embeddings run on-device. Only the backend and operator scripts take variables (none are secrets unless your Qdrant enforces an API key):

- `.env.local` — gitignored operator file (loaded by `npm start`, `npm run api` and the scripts): `QDRANT_URL` (default `http://qdrant:6333`, the compose-network alias), `QDRANT_COLLECTION` (default `magpie_reports`), optional `QDRANT_API_KEY`, optional `MERGE_THRESHOLD` (default 0.95, mirrors `THRESHOLDS.MERGE`).
- `.env.example` — documents every key. Copy it to `.env.local` and fill in what differs from the defaults.

## Database setup (Qdrant)

The app expects a Qdrant instance with the collection `magpie_reports` (384-dim Cosine vectors) and three payload indexes (`category` keyword, `hidden` bool, `created_at` datetime). `npm run setup:db` provisions exactly that and is idempotent (get-first, create only when missing):

```bash
npm install
npm run setup:db   # needs QDRANT_URL in .env.local pointing at your Qdrant
```

On this VPS the shared Qdrant lives on the `web_gateway` Docker network; from the host, point `QDRANT_URL` at its container IP (see `.env.example`). The collection is namespaced — the instance's other collections are untouched.

### Load the seed corpus

Populate the collection with the committed scam corpus ([`data/seeds/corpus.jsonl`](data/seeds/corpus.jsonl), 360 lines):

```bash
npm run seed
```

For every line the script embeds the text **on-device** with the same quantized `Xenova/all-MiniLM-L6-v2` model the browser uses (384 dims, q8, mean pooling, normalized — one shared cosine space), then upserts one point with the vector plus the line's payload (`text`, `category`, `channel`, `region`, `first_seen`, `report_count`, sentinel `reporter_id: "seed"`, `hidden: false`) and **backdates `created_at` to the line's `first_seen`** so the feed's date sort reads realistic ages.

One-time model note: the first run downloads the quantized model weights (~23 MB) into transformers.js's HTTP cache (`.cache/`, gitignored) — the same fetch the browser does on first use.

Seeding is idempotent by construction: point IDs are deterministic UUIDs derived from the SHA-256 of the text, and upsert overwrites — a re-run rewrites the same 360 points and can never duplicate one.

## Seed corpus

The scam corpus the app matches against ships as committed seed data: [`data/seeds/corpus.jsonl`](data/seeds/corpus.jsonl) — **360 anonymized scam texts** (180 dataset-modeled + 100 hand-written Nigerian-context originals + 80 reworded tuning variants). One JSON document per line:

```json
{"text": "GTBANK ALERT: ...", "category": "phishing", "channel": "sms", "region": "Lagos", "first_seen": "2026-08-01T00:00:00.000Z", "report_count": 3, "source": "hand-written Nigerian-context seed (original, no PII)"}
```

- `category` ∈ `phishing | investment | advance_fee | delivery | romance | job_offer | other` and `channel` ∈ `sms | whatsapp | email` — the same vocabularies as [`src/lib/constants.ts`](src/lib/constants.ts).
- `first_seen` is a full ISO-8601 UTC timestamp, 32–220 days old at build time; the seed script backdates `created_at` to it.
- `report_count` is 1–90 and concentrated: 25 flagged "popular" scams carry 25–90, the rest skew low (1–14) — the merge/dedupe flow increments counts from there.
- Variant lines carry one extra key, `"variant_of": <line index>` (0-based, pointing back at the base line they paraphrase). They exist as the paraphrase set for threshold tuning; 80 lines qualify, ≥ 60 required — validated with `npm run tune`, see [Thresholds](#thresholds).
- Privacy: no real addresses (all mails are `…@example.com`), phone numbers only as masked patterns (`+234xxxxxxxxxx`, `0803xxxxxxx`), no quoted headers, each text ≤ 990 chars.
- All texts are **modeled** on the public sources below — no verbatim upstream excerpts are copied, so the committed corpus carries no third-party prose and no PII leak from those datasets. `source` names the dataset each line is modeled on.

Rebuild or validate it with two scripts (`scripts/build-corpus.ts`, deterministic — same UTC day, same output):

```bash
npm run corpus:build   # assemble the sources into data/seeds/corpus.jsonl
npm run corpus:check   # re-run the full acceptance contract + regeneration diff
```

`corpus:check` verifies line counts, key sets, vocabularies, PII rules, variant indexing and the backdating window, and byte-compares every field against a fresh in-memory regeneration. Author new lines in `data/seeds/sources/handwritten.ts` (or extend a dataset pool) — quotas and category splits are asserted at build time.

Per-source names and licenses: see [Dataset attribution](#dataset-attribution).

## Dataset attribution

Framing first, because two properties matter as much as the names:

- All 360 lines are **modeled**, never verbatim upstream prose — no third-party text ships in the repo and no PII leaks from these datasets (rules asserted by `npm run corpus:check`).
- Per-source counts below are **base lines only**: 280 base lines (180 dataset-modeled + 100 hand-written). The 80 reworded tuning variants are not counted in the rows — each variant inherits its parent's `source` ([`scripts/build-corpus.ts`](scripts/build-corpus.ts)), and they split 40/40 between dataset parents and hand-written parents. 280 + 80 = the committed 360.

| Source | Modeled as | License |
|---|---|---|
| UCI SMS Spam Collection | 75 sms prize/lottery/quiz texts | CC BY 4.0 (UCI page) |
| Apache SpamAssassin public corpus | 42 email phish/pump/419 texts, headers stripped | free for research (Apache SpamAssassin) |
| `rokibulroni/Phishing-Email-Dataset` → `Nigerian_Fraud.csv` | 26 classic 419 letters | CC BY-SA 4.0 (repo readme) |
| `rokibulroni/Phishing-Email-Dataset` → `Nazario.csv` | 16 verify-within-24h phish | CC BY-SA 4.0 |
| [`electricsheepafrica/africa-smishing-sms-phishing`](https://huggingface.co/datasets/electricsheepafrica/africa-smishing-sms-phishing) (Hugging Face) | 21 Nigerian bank-app/BVN/promo SMS | repo license (Hugging Face) |
| Hand-written Nigerian-context originals | 100 original texts | original |

## Deploying (self-hosted, Docker + Caddy)

The deployment unit is one container (build + serve) behind the VPS's shared Caddy gateway; see the hosting guide for the gateway model.

1. **Build and run** (hosting-guide Pattern A — portable base + production override):

   ```bash
   docker compose -f compose.yaml -f compose.prod.yaml up -d --build
   ```

   The image is multi-stage: the full toolchain builds the SPA, the runtime ships only `dist/` + `server.mjs` (no `node_modules` at runtime). The override attaches the container to the external `web_gateway` network with alias `magpie` and publishes **no host ports at all** — the Caddy edge reaches it by alias, and operator access from the host goes through the container's `web_gateway` IP directly (same model as the scripts reaching Qdrant):

   ```bash
   docker inspect magpie-web --format '{{(index .NetworkSettings.Networks "web_gateway").IPAddress}}'
   # → e.g. 10.0.1.26; the API answers at http://<that-ip>:8080/api/health
   ```

2. **Verify the upstream before touching the edge:**

   ```bash
   docker exec caddy-gateway-caddy-1 wget -qO- --timeout=3 http://magpie:8080/api/health
   ```

3. **Add the Caddy route** (`~/caddy-gateway/Caddyfile`) and reload:

   ```caddyfile
   magpie.techa.pro {
       encode gzip zstd
       reverse_proxy magpie:8080
   }
   ```

   ```bash
   docker exec caddy-gateway-caddy-1 caddy fmt --overwrite /etc/caddy/Caddyfile
   docker exec caddy-gateway-caddy-1 caddy validate --config /etc/caddy/Caddyfile
   docker exec caddy-gateway-caddy-1 caddy reload --config /etc/caddy/Caddyfile
   ```

   Wildcard DNS (`*.techa.pro`) and TLS are automatic — no DNS work, no cert steps.

4. **Verify end-to-end and run the acceptance probe:**

   ```bash
   curl -I https://magpie.techa.pro
   curl -s https://magpie.techa.pro/api/health
   MAGPIE_API_URL=http://$(docker inspect magpie-web --format '{{(index .NetworkSettings.Networks "web_gateway").IPAddress}}'):8080 npm run smoke    # see [Smoke check](#smoke-check)
   ```

5. **Operator live pass** (outside the factory — after this merge):

   - Re-run the rebuild + deploy in step 1 (`docker compose -f compose.yaml -f compose.prod.yaml up -d --build`) so the container serves the final `dist/`.
   - Browser pass at 390px and desktop, in dark **and** light: check → verdict card, browse feed + stats strip, map constellation + drawer, report flow + success, health panel.
   - Re-run the Lighthouse command in [Performance](#performance) (bar: mobile ≥ 85) and record the new score there.
   - Re-run the online smoke (`npm run smoke`) plus a `GET /api/map` validation (`curl -s https://magpie.techa.pro/api/map | head -c 300).

## Smoke check

One command, two phases, and the operator's checklist before any demo — `scripts/smoke.ts` probes the **live, seeded corpus** exactly the way the deployed app serves it:

```bash
npm run smoke                 # online: probes MAGPIE_API_URL (default http://127.0.0.1:8080) — needs the API running and the corpus seeded
npm run smoke -- --local      # offline gate: no network at all — CI and laps can run it
```

What it checks, in order — every line prints its **measured value and the bar it cleared**, and the script exits 0 only when all run probes pass (final line `SMOKE OK`, or `SMOKE LOCAL OK` for `--local`):

1. **Seed present** (offline + online): the committed corpus (`data/seeds/corpus.jsonl`, 360 lines, 80 `variant_of` pairs) loads and validates; online, the corpus must hold ≥ **300** non-hidden documents — the total probe rides `GET /api/stats`, the same server-exact count the /browse strip renders.
2. **kNN sane for 3 texts** (online, one `POST /api/check` per text — the app's own transport):
   - **Known scam** (corpus line 1) → retrieves its **own** seed document (deterministic UUID, `uuidFromText` in [`scripts/qdrant.ts`](scripts/qdrant.ts)) with similarity ≥ `THRESHOLDS.HIGH` (**0.90**);
   - **Paraphrased variant** → the strongest `variant_of` pair the corpus itself certifies (chosen offline by argmax over all 80 pairs, ties to the lowest line index) retrieves its **source** document in the top-10 with similarity ≥ **0.80** (the issue-pinned retrieval bar, distinct from any `THRESHOLDS` value);
   - **Benign control** → a plain everyday message's top-1 similarity stays **< `THRESHOLDS.SUSPICIOUS` (0.65)** — the guard against false verdicts.
3. **Thresholds recorded**: the run header echoes `THRESHOLDS` — `HIGH=0.90 · SUSPICIOUS=0.65 · MERGE=0.95` — read live from [`src/lib/constants.ts`](src/lib/constants.ts), never restated inside the script, so the probe always measures against the currently tuned boundaries.

No key is needed in either mode: the offline phase never leaves the machine, and the online phase probes the same open API the browser uses.

Latest recorded runs: offline gate — strongest pair corpus line 316 → 266, local cosine 0.9078; online (production, `https://magpie.techa.pro` served from the container) — benign 0.3673 < 0.65, own-doc sim 1.0000, paraphrase rank 2 sim 0.9078, corpus total 360, **SMOKE OK**.

## Thresholds

The check flow's verdict boundaries are three constants in [`src/lib/constants.ts`](src/lib/constants.ts) (`THRESHOLDS`) — and they live nowhere else in the browser, so a tuning pass never touches a call site. The backend mirrors `MERGE` in its dedupe-before-write path (a plain-JS file cannot import the TS module — keep the values in sync; grep "must mirror" in [`server.mjs`](server.mjs)):

| Threshold | Value | What gates on it |
|---|---|---|
| `HIGH` | 0.90 | Verdict tier **HIGH RISK** (similarity ≥ 0.90) — a near-verbatim copy of a reported scam |
| `SUSPICIOUS` | 0.65 | Verdict tier **SUSPICIOUS** (0.65–0.89) — the "reworded scam still caught" floor; below it the check card shows the no-prior-reports panel |
| `MERGE` | 0.95 | Dedupe-before-write in the report flow (server-side `handleCreateReport`): a new report ≥ 0.95 similar to an existing one **merges** into it (report count +1) instead of creating a near-duplicate point |

They are tuned against the corpus's held-out reworded variants (issue #16): `npm run tune` embeds all 80 `variant_of` pairs with the same on-device model the browser uses and scores each variant against its source.

Final state after the tuning run:

- **`SUSPICIOUS` 0.80 → 0.65.** Measured variant sims span 0.30–0.91 (median 0.79, p05–p95 = 0.47–0.88) — wider than the PRD's 0.75–0.88 risk estimate — while unrelated-text pairs measure far lower (median ~0.13 in a 240-pair corpus sample; same-category, different-narrative pairs reach only ~0.40). At the original 0.80, only 34/80 (42.5%) of true rewordings score above the boundary. The tuner's mechanical p20 rule — the boundary that keeps at least 80% of pairs, floored to a 0.05 step — measured p20 = 0.69 and suggested **0.65**, still 0.25 above the same-category different-narrative ceiling; at 0.65, 71/80 (**88.75%**) clear it, meeting the issue's ≥ 80% bar with the boundary far from the noise. `HIGH` and `MERGE` stay put: only 2/80 variants reach 0.90 (near-verbatim copies only) and none reach the 0.95 merge band, which is exactly what those tiers mean.
- **Below the boundary by measurement, not massage.** The 9 variants under 0.65 are the corpus's loosest rewrites — mostly pidgin-heavy romance/419 continuations that share the *scenario* with their source but almost none of the wording. Chasing them would push `SUSPICIOUS` toward the unrelated-text noise floor, so the boundary stays at the p20-suggested 0.65 and the tuner's distribution line reports that tail instead.

Re-run the measurement any time — it needs **no backend and no network** (it computes cosines locally), and its first run downloads the quantized model (~23 MB) into the gitignored `.cache/` just like the browser does on first use:

```bash
npm run tune
```

Each variant prints one line — `variant <0-based line index>: sim=<score> tier=<HIGH_RISK\|SUSPICIOUS\|NO_REPORTS>` — followed by a summary line (pass rate against `SUSPICIOUS`), the similarity distribution, the size of the merge band, and a data-driven `suggest:` verdict on the thresholds.

## Vector map

`/map` renders the corpus as a force-directed constellation (canvas + `d3-force`, lazily split so the main chunk never pays for it): one node per report, positioned by pairwise cosine similarity, glowing in its category color.

- **Data.** `GET /api/map` → `{"points":[…]}` — every non-hidden point with its payload plus its rounded 384-dim vector, capped at 2000 points. Pure math (fetch, cosine, edge-building, the cap) lives d3-free in `src/lib/map-graph.ts`.
- **Threshold slider** (`data-testid="map-threshold"`): default `THRESHOLDS.SUSPICIOUS`, range 0.40–0.95 — the edge set rebuilds live off the slider; the simulation restarts only on threshold changes.
- **Legend + drawer.** The category legend toggles dim categories without re-simulation (layout stays put); tapping a node opens the beUI drawer (`data-testid="map-drawer"`) with the full report text and a `Check this message` CTA into `/?text=<encoded>`.
- **Motion.** Pan via drag, zoom via wheel (at cursor) and pinch. Under reduced motion the layout ticks synchronously once and renders settled — no animation frames.

Validate the endpoint against the deployment:

```bash
curl -s https://magpie.techa.pro/api/map | head -c 300
```

## Performance

The quality bar is a **Lighthouse mobile performance score ≥ 85** for the core loop (load → check → verdict), measured against the production build.

Operator command (Lighthouse CLI defaults to mobile emulation on a throttled Slow 4G network):

```bash
npm start                                          # serves dist/ + api on :8080 (host-run; the container publishes nothing)
npx --yes lighthouse http://127.0.0.1:8080/ \
  --only-categories=performance \
  --output=json --output-path=lighthouse.json \
  --chrome-flags="--headless --no-sandbox"
```

**Latest recorded run:** performance **88 / 100** (Lighthouse 13.5.0, mobile emulation + Slow 4G throttling, against the redesigned UI build — FCP 0.9 s, LCP 2.3 s, TBT 410 ms, CLS 0). The 2026-10-31 UI redesign initially measured 65 (the animated hero shader's rAF/WebGL loop plus the on-mount model warmup stacked seconds of main-thread blocking into the throttled load window); it was brought back over the bar with three levers, each measured:

- **Animated shader is a desktop flourish.** On viewports ≤ 767px (and under reduced motion) the hero renders a pure CSS gradient (`.hero-gradient`) — the animated `mesh-gradient` canvas stays desktop-only. The static canvas variant was tried first and rejected: it still painted late enough to become the LCP element.
- **Model warmup never starts inside the load window.** The on-mount `embed('warmup')` began a 23 MB download on throttled Slow 4G, dragging TTI out and pulling every main-thread task of the following seconds into TBT (−2,300 ms). Warmup now fires on the user's first interaction or after 6 s, whichever first.
- **Route-level code splitting.** Only home is in the main chunk; browse/report/health/check/map (donut, swipeable, drawer, d3-force) load per route.

Desktop keeps the animated mesh and the full glass treatment; re-run the command above whenever `dist/` changes (the bar is mobile ≥ 85) and record the new score here.

Levers shipped:

- **Gzip** on text assets, served by the backend itself ([`server.mjs`](server.mjs)); Caddy adds `encode gzip zstd` on top at the edge.
- **Deferred model load**: the ~23 MB quantized model is fetched by the Web Worker only when the embedder first runs (post-load warmup, see `src/lib/embedder.ts`) — it is never in the critical path of first paint or TTI.
- **No blocking webfonts, no blocking images**: the page is system-font text; the only image is a ~500 B inline-icon SVG favicon.
- **Text-only LCP**: the pre-hydration shell in [`index.html`](index.html) is plain HTML, so the largest contentful paint lands from markup alone, before any JS parses.

## Limitations

Stated as shipped — these are the tradeoffs the current build makes, not open bugs.

- **~256-token truncation.** The on-device embedding model reads roughly the first ~256 tokens of a message; the paste box's 1,000-character cap ([`src/routes/home.tsx`](src/routes/home.tsx)) does not guarantee that everything fits, because verbose multi-word scripts tokenize long. Matches past the cut are invisible to the search — and the UI says so on the paste box itself.
- **Reporting and merging are fully open.** There is no auth: anyone can `POST /api/reports`, and the merge path lets any submission bump an existing report's `report_count` — crowd-sourced dedupe without a backend made this tradeoff explicit from day one; the backend form-validation (vector shape, text length, vocabulary checks) is hygiene, not protection, and rate-limiting/Sybil defense is out of scope.
- **Hide-own ownership is spoofable by design.** The only moderation is hide-own, gated on the device-local `reporter_id` — a client-chosen value anyone can read or set. It binds a report to the browser that made it, not to a person; there is no admin surface or takedown flow beyond it.
- **Shared Qdrant trust boundary.** The vector database sits on the shared `web_gateway` Docker network where any container can reach any other's ports; Magpie adds one namespaced collection and the backend is the only public door to it, but the instance itself currently enforces no API key.

The standing honesty rule: "no prior reports" always means *unseen*, never *safe*.

## Plans

The full product requirements document lives in [`.agents/PRDs/PRD.md`](.agents/PRDs/PRD.md) — note its database/auth sections describe the original pre-migration design (kept as history); this README is the source of truth for the shipped architecture.
