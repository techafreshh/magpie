/**
 * Primary navigation dock (issue #42): one beUI `Dock` instance owning all
 * five routes — Check `/`, Map `/map`, Browse `/browse`, Report `/report`,
 * Health `/health`. The active item is driven by the react-router location
 * (exact match for `/`, prefix match otherwise so Report stays active on
 * `/report/success`), rendered with the dock's gliding `layoutId` pill.
 *
 * Responsive by CSS on this single instance: fixed bottom-center below 640px
 * (thumb reach, beUI `size={44}` for the 44px minimum target), static in the
 * header row from 640px up. One instance (not two swapped at a breakpoint)
 * keeps a single tab stop per item and lets the pill glide.
 *
 * Items are icon-only with `sr-only` labels (macOS-dock idiom); the nav stays
 * keyboard-navigable through the underlying react-router links.
 *
 * Public surface: `NavDock`.
 */
import type { ComponentType, SVGProps } from 'react';
import { Link, useLocation } from 'react-router';
import { Activity, Map, Megaphone, Newspaper, ScanSearch } from 'lucide-react';
import { Dock, DockItem } from './motion/dock';

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

interface NavEntry {
  label: string;
  to: string;
  Icon: IconType;
}

const NAV_ITEMS: readonly NavEntry[] = [
  { label: 'Check', to: '/', Icon: ScanSearch as unknown as IconType },
  { label: 'Map', to: '/map', Icon: Map as unknown as IconType },
  { label: 'Browse', to: '/browse', Icon: Newspaper as unknown as IconType },
  { label: 'Report', to: '/report', Icon: Megaphone as unknown as IconType },
  { label: 'Health', to: '/health', Icon: Activity as unknown as IconType },
];

function isActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(to + '/');
}

export function NavDock() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Primary"
      data-testid="nav-dock"
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 sm:static sm:bottom-auto sm:left-auto sm:translate-x-0"
    >
      <Dock size={44}>
        {NAV_ITEMS.map(({ label, to, Icon }) => {
          const active = isActive(pathname, to);
          return (
            <DockItem key={to} active={active}>
              <Link
                to={to}
                aria-current={active ? 'page' : undefined}
                className="flex size-full items-center justify-center rounded-full text-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Icon aria-hidden className="size-5" />
                <span className="sr-only">{label}</span>
              </Link>
            </DockItem>
          );
        })}
      </Dock>
    </nav>
  );
}
