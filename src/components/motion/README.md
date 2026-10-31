# src/components/motion — beUI vendored components (issue #41)

Installed via the shadcn CLI against the `@beui` registry
(`https://beui.dev/r/{name}.json`, pinned CLI: `shadcn@4.14.1`):

```
npx -y shadcn@4.14.1 add --yes \
  @beui/shader-background @beui/dock @beui/tilt-card @beui/text-scramble \
  @beui/animated-number @beui/animated-badge @beui/loader @beui/donut-chart \
  @beui/theme-toggle @beui/alert \
  @beui/swipeable-list @beui/drawer @beui/not-found-magnetic
```

> Issue #62: `@beui/animated-toast-stack` and `@beui/select` were evaluated
> but never consumed by any route, so they were removed along with their
> orphaned hooks (`use-listbox.ts`, `use-on-open.ts`, `use-row-cursor.ts`)
> to stop Tailwind v4 source-scanning their class strings into the
> production CSS. Re-consume later via
> `npx -y shadcn@4.14.1 add --yes @beui/animated-toast-stack @beui/select`.

## Issue name → registry slug mapping

The issue names beUI items by their site page name; four differ from the
registry slug. The vendored files carry the slug names so later issues can
consult beui.dev docs (and future CLI updates) by slug:

| Issue name       | Registry slug         | Evidence                                                     |
| ---------------- | --------------------- | ------------------------------------------------------------ |
| text-animation   | `text-scramble`       | page "Text Animation"; vendored header reads `…/motion/text-animation` |
| number           | `animated-number`     | vendored header reads `…/motion/number`; brings `digit-swap.tsx` |
| animated-alert   | `alert`               | registry title is "Animated Alert"                           |
| not-found        | `not-found-magnetic`  | variant chosen because the alternatives (glitch/spotlight/terminal) ship decorative hex literals the zero-hex gate forbids |

Transitive files the CLI pulled in as dependencies of the above:
`action-swap.tsx` (theme-toggle), `digit-swap.tsx` (animated-number),
`magnetic.tsx` + `not-found/` (not-found-magnetic), plus the shared libs
`src/lib/utils.ts` (`cn`), `src/lib/ease.ts`, `src/lib/presence-gate.tsx`,
`src/lib/touch.ts`, and the consumed hooks in `src/lib/hooks/`
(`use-focus-trap.ts` for the drawer, `use-hover-capable.ts` for
magnetic/tilt-card/donut-chart).

## Relocation

`donut-chart.tsx` + `donut-chart/` target `src/components/charts/` upstream,
but the issue mandates installation into `src/components/motion/` — both were
moved here after install; all internal imports are relative, so no code edits.

## Vendored edits (hex-literal removals)

The zero-hex gate (`src/**/*.ts(x)` must contain no `#[0-9a-fA-F]{3,8}`) required
two upstream deviations, both color-identical or comment-only:

1. `theme-toggle.tsx` — mask gradient stop now uses the `black 0` CSS keyword
   stop in place of the old black hex stop (same color).
2. `donut-chart/model.ts` — `DonutSegment.color` doc comment reworded to drop
   the example six-digit blue hex literal (now describes the accepted color
   forms without naming one).

No other vendored file needed touching; everything else is CLI output as-is.

## Vendored edits (#42)

3. `theme-toggle.tsx` — `import { useTheme } from "next-themes"` →
   `import { useTheme } from "@/lib/theme"`. The adapter in `src/lib/theme.ts`
   exposes the next-themes `useTheme()` shape backed by GlassyUI's
   `usePreferences()`, so the persisted `glassy-ui-preferences` key and the
   `<html data-lg-theme>` mirror stay owned by the GlassyUI provider; mounting
   next-themes' own provider would fork a second theme store and let them drift.
