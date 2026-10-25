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

The SPA serves at `http://localhost:5173` (or `$PORT` when set). `/` shows the **Magpie** home page with a live Appwrite connectivity panel; `/health` renders a JSON health panel with `{"status":"ok","appwrite":"reachable"|"unreachable"}` based on a real `listDocuments` call against VectorsDB. A production build is available via `npm run build`.

## Environment

- `.env` — committed, public-by-design client values (`VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT_ID`); these ship in the browser bundle.
- `.env.local` — gitignored, operator-only secrets (Appwrite API keys). Never commit.
- `.env.example` — template documenting every key with empty values. Copy it to `.env` and fill in your project's values.

## Appwrite bootstrap (one-time, Console)

Until this one-time setup is done, `/health` renders `"appwrite":"unreachable"` — that is the graceful, expected state for a fresh environment.

1. In the [Appwrite Console](https://cloud.appwrite.io/console), pick the **fra** region and create (or open) the project, then add a **Web platform** with hostname `http://localhost:5173` so browser calls pass CORS.
2. Under **VectorsDB**, create a database with ID `magpie`.
3. Inside that database, create a collection with ID `reports` and give it **Read** permission `Any`.
4. Copy the endpoint and project ID from the project settings into `.env`, restart the dev server, and reload `/health` — it should now read `"appwrite":"reachable"`.

## Plans

The full product requirements document lives in [`.agents/PRDs/PRD.md`](.agents/PRDs/PRD.md) (architecture, data model, milestones, demo script).

---

*More documentation (architecture deep-dive, "why VectorsDB", dataset attribution) lands here before submission.*
