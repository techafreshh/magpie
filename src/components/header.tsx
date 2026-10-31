/**
 * Site-wide header: brand + dock navigation + theme toggle. Reporting is
 * anonymous, so there is no session surface here — the device-local reporter
 * identity (`../lib/reporter`) never renders (it only powers hide-own
 * ownership).
 *
 * The nav is the single beUI dock instance (`./nav-dock`); the theme toggle
 * is the vendored beUI View-Transition toggle (`./motion/theme-toggle`),
 * wired to the GlassyUI preferences provider through the `useTheme` adapter
 * in `@/lib/theme` (same persisted `glassy-ui-preferences` key and
 * `<html data-lg-theme>` mirror as before).
 *
 * NOTE: no `backdrop-blur` on this header — a `backdrop-filter` ancestor
 * becomes the containing block for `position: fixed` descendants, which
 * would pin the mobile dock inside the header instead of the viewport.
 *
 * Public surface: `Header`.
 */
import { Link } from 'react-router';
// Vendored beUI View-Transition theme toggle (src/components/motion/theme-toggle).
import { ThemeToggle } from './motion/theme-toggle';
import { NavDock } from './nav-dock';

export function Header() {
  return (
    <header className="border-b border-border bg-card/60">
      <div className="mx-auto flex w-full max-w-[40rem] items-center justify-between gap-4 px-6 py-3">
        <Link to="/" className="text-lg font-bold tracking-tight text-foreground">
          Magpie
        </Link>
        <NavDock />
        <ThemeToggle
          data-testid="theme-toggle"
          className="min-h-[44px] min-w-[44px] rounded-full text-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          iconClassName="size-5"
        />
      </div>
    </header>
  );
}
