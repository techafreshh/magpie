# Slice the UI redesign + vector map into factory issues (#21–#30)

Create 10 sequential issues on `techafreshh/magpie` in the exact house format (`## Problem` / `## Behavior` / `## Acceptance` Given-When-Then machine-checkable / `## Notes` + trailing `Depends on: #n` lines, terse spec tone, no labels). Laps verify offline only: `npm run build` exit 0, grep assertions, `npm start` + curl body checks, `npm run smoke -- --local`. Operator-only steps (deploy, Lighthouse-on-prod, live browser pass) are noted per issue as outside the factory.

| # | Title | Depends on |
|---|---|---|
| 21 | Design foundation: shadcn token layer, iridescent magpie palette, display font, motion + beUI install | — |
| 22 | App shell: dock navigation, View-Transition theme toggle, 404 page | #21 |
| 23 | Check page: shader hero, animated headline, accent paste box, loader states | #21, #22 |
| 24 | Verdict card: tilt surface, animated tier badge, count-up similarity | #23 |
| 25 | Browse stats strip: count-up totals + donut-chart category share | #22 |
| 26 | Browse feed: swipe-to-hide on mobile, token-styled chips, loading/empty states | #22, #25 |
| 27 | Vector map backend: zero-dep `GET /api/map` returning points with rounded vectors | — (parallel lane) |
| 28 | Vector map page: canvas force-directed constellation with threshold slider, legend, drawer | #22, #27 |
| 29 | Report flow, success and health restyle: selects, animated alerts, success count-up | #21, #22 |
| 30 | Final integration: cross-page consistency sweep, reduced-motion audit, README + smoke green | #24, #26, #28, #29 |

**Key acceptance patterns per issue** (full GWT bodies written at creation): tokens live only in `src/index.css` (`@theme` vars, grep-able); accent literals banned elsewhere (grep hex outside `index.css` → none); each page greps for its beUI component import; `npm run build` + `npm run smoke -- --local` exit 0 every issue; `/api/map` issue asserts vector length 384, rounding, gzipped response, no new deps in `server.mjs`; map page asserts lazy route (separate chunk in `dist/assets`), d3-force subset only (no full `d3` dep), reduced-motion instant-settle path, canvas DPR handling; final issue re-runs the whole grep suite + records the Lighthouse/operator checklist in README (mirroring issue #20's style).

**Execution steps after approval**
1. `gh api repos/techafreshh/magpie/issues` POST ×10, sequential (title + body only, no labels — matching house style), verifying each returns 201 and capturing numbers as dependencies (adjust `Depends on:` numbers if GitHub assigns anything other than the expected sequence).
2. Sanity-check the wiring: fetch all 10 bodies back, confirm every `Depends on:` points at the intended issue and the graph is acyclic and connected (#21 root, #30 sink).
3. Report the issue list + dependency graph back with links.
4. **Operator handoff (not executed without your say-so):** the factory's runtime/holdout scenarios on the VPS were written for the Appwrite-era app and are now stale relative to main — offer to refresh them via `factory-remote scenario` (e.g. runtime: `npm start` serves `/` 200 + "Magpie", `/api/health` json `ok=true`; holdout: `POST /api/check` with malformed vector → 400 never 500) and fire the first tick when you confirm. Also optional: repo description still says "Appwrite Databases Hackathon 2026" — offer to update it.