# Magpie 🐦‍⬛

**Community scam-message radar.** Paste any SMS, email, or WhatsApp message → it gets embedded **in your browser** and matched against a crowd-sourced corpus of reported scams. Get a verdict, a match score, and the matching reports — even for paraphrased variants that defeat keyword blocking.

> The magpie collects shiny things. This one collects scams.

## Status

🚧 **Work in progress** — being built for the [Appwrite Databases Hackathon](https://hackathon.appwrite.io/) (Oct 19–31, 2026). All code in this repository is written during the hackathon window.

## How it works (in one breath)

Your message text never leaves your device: an embedding model (all-MiniLM-L6-v2, 384 dims) runs locally via transformers.js in a Web Worker. Only an opaque vector is sent to **Appwrite VectorsDB**, where an HNSW cosine index ranks the community's scam reports by semantic similarity. High similarity → HIGH RISK verdict, with the matching reports, categories, and report counts.

## Stack

- **Vite + React 19** + TypeScript + Tailwind CSS v4
- **GlassyUI** (shadcn-style glass component registry)
- **Appwrite VectorsDB** — the corpus *is* the database: embeddings, kNN search, dedupe-merge, feed, stats
- **Appwrite Auth** (magic link) — required only to report
- **transformers.js** — client-side embeddings, no LLM, no paid API anywhere

## Getting started

Clone the repo, then:

```bash
npm install
npm run dev
```

The SPA serves at `http://localhost:5173` (or `$PORT` when set). `/` is the **check screen**: paste a message (capped at 1,000 characters, with a live counter and a truncation note), hit **Check**, and the verdict card answers with a tier badge, the top matches (snippet, category/channel/region chips, report count), and 0–100% similarity bars. `/check` is the embedder debug surface (on-device embedding with a live progress log); `/health` renders a JSON health panel with `{"status":"ok","appwrite":"reachable"|"unreachable"}` based on a real `listDocuments` call against VectorsDB.

Two ways to serve:

- `npm run dev` — the Vite dev server (`npm install` first).
- `npm start` — `node server.mjs`, a zero-dependency static server for the committed production build (`dist/`). Answers instantly on a fresh clone with no registry round-trip, which is what CI-style checks use; identical routes and SPA catch-all behavior through the same `index.html`.

A production build is available via `npm run build`.

## Environment

- `.env` — committed, public-by-design client values (`VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT_ID`); these ship in the browser bundle.
- `.env.local` — gitignored, operator-only secrets (Appwrite API keys). Never commit.
- `.env.example` — template documenting every key with empty values. Copy it to `.env` and fill in your project's values.

## Appwrite bootstrap (one-time, Console)

Until this one-time setup is done, `/health` renders `"appwrite":"unreachable"` — that is the graceful, expected state for a fresh environment. The scripted alternative is `npm run setup:db` — see [Database setup](#database-setup) below.

1. In the [Appwrite Console](https://cloud.appwrite.io/console), pick the **fra** region and create (or open) the project, then add a **Web platform** with hostname `http://localhost:5173` so browser calls pass CORS. Any other origin used by a test harness or preview deploy must be registered as a **Web platform** too, or all browser calls fail CORS.
2. Under **VectorsDB**, create a database with ID `magpie`.
3. Inside that database, create a collection with ID `reports` and give it **Read** permission `Any`.
4. Copy the endpoint and project ID from the project settings into `.env`, restart the dev server, and reload `/health` — it should now read `"appwrite":"reachable"`.

## Database setup

The Console steps above can be replaced by an idempotent script: `npm run setup:db` creates everything the app needs and can be re-run safely (it detects existing resources and leaves them untouched).

It provisions:

- VectorsDB database **`magpie`**, collection **`reports`** with vector field **`embeddings`** (dimension **384**, Custom — not the Console's model binding) and an **HNSW index with cosine metric** on it
- collection permissions: **Read: Any**; **Create / Update: users** (plus document security, so reports can carry doc-level `delete("user:<uid>")` permissions — the template is printed by the script and applied per document at write time by the report flow, because doc-level permissions cannot be set by a provisioning script)
- metadata fields per the PRD schema (text, category, channel, region, first_seen, reporter_id, hidden, report_count) live inside each document's JSON payload

### 1. Configure the .env key

The script is the only thing that talks to Appwrite with a key — laps and CI never have one, so this step is operator-only. Copy `.env.example` to `.env.local` (gitignored) and fill in:

```bash
cp .env.example .env.local
# then edit .env.local:
#   APPWRITE_ENDPOINT    https://fra.cloud.appwrite.io/v1
#   APPWRITE_PROJECT_ID  your project id
#   APPWRITE_API_KEY     an API key with the scopes below
```

The `.env` file that is committed is public-by-design (client values only) — **never put the API key in `.env`**; `.env.local` stays gitignored and operator-only.

The key must have the **`vectorsdb`** and **`documents`** scopes (create it in Console → project → *Integrations* → API key).

### 2. Run it

```bash
npm install
npm run setup:db
```

Output shows `created` for every resource the first run makes and `exists` when it is already provisioned; the permission wire strings (`read("any")`, `create("users")`, `update("users")`) and the document-level `delete("user:<uid>")` template are printed at the end for reference.

## Plans

The full product requirements document lives in [`.agents/PRDs/PRD.md`](.agents/PRDs/PRD.md) (architecture, data model, milestones, demo script).

---

*More documentation (architecture deep-dive, "why VectorsDB", dataset attribution) lands here before submission.*
