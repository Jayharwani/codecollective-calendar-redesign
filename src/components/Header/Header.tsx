import { CalendarPlus, Menu as MenuIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

const NAV = [
  { label: 'Home', href: 'https://codecollective.us/' },
  { label: 'Platform', href: 'https://codecollective.us/platform' },
  { label: 'Calendar', href: 'https://codecollective.us/calendar', current: true },
  { label: 'Projects', href: 'https://codecollective.us/projects' },
];

export type HeaderProps = {
  /** True once the page has scrolled past the title block. */
  condensed: boolean;
  /** The collapsed search pill, docked into the bar while condensed. */
  docked?: ReactNode;
  onSubscribe: () => void;
};

/**
 * The only translucent surface on the page. Everything else is opaque, so the
 * dense agenda underneath never has to compete with a frosted panel.
 */
export function Header({ condensed, docked, onSubscribe }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{
        background: condensed
          ? 'color-mix(in srgb, var(--bg) 80%, transparent)'
          : 'var(--bg)',
        backdropFilter: condensed ? 'blur(16px) saturate(140%)' : undefined,
        WebkitBackdropFilter: condensed ? 'blur(16px) saturate(140%)' : undefined,
        borderBottom: `1px solid ${condensed ? 'var(--line)' : 'transparent'}`,
      }}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-4 px-4 sm:h-16 sm:px-6">
        <a
          href="https://codecollective.us/"
          className="t-body shrink-0 font-semibold"
          style={{ color: 'var(--ink)' }}
        >
          Code Collective
        </a>

        <nav aria-label="Main" className="hidden flex-1 justify-center md:flex">
          <ul className="flex list-none items-center gap-6 p-0">
            {NAV.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  aria-current={item.current ? 'page' : undefined}
                  className="t-meta"
                  style={{ color: item.current ? 'var(--ink)' : 'var(--ink-2)' }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* The docked pill takes the centre once the title block has gone. */}
        {docked && <div className="flex min-w-0 flex-1 justify-center md:hidden">{docked}</div>}

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onSubscribe}
            // The label is hidden on narrow screens, so the name has to be
            // carried explicitly or the button has none at all.
            aria-label="Subscribe"
            className="t-meta flex items-center justify-center gap-2 rounded-[var(--r-pill)] border px-3 py-2"
            style={{
              borderColor: 'var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              minWidth: 44,
              minHeight: 44,
            }}
          >
            <CalendarPlus size={16} strokeWidth={1.5} aria-hidden />
            <span className="hidden sm:inline">Subscribe</span>
          </button>
          <a
            href="https://codecollective.us/p/"
            className="t-meta hidden sm:inline"
            style={{ color: 'var(--ink-2)' }}
          >
            Log in
          </a>

          {/* On phones the nav collapses into a disclosure rather than vanishing. */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label="Menu"
            className="flex items-center justify-center rounded-[var(--r-pill)] border md:hidden"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)', minWidth: 44, minHeight: 44 }}
          >
            <MenuIcon size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t md:hidden"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          <ul className="m-0 list-none p-2">
            {NAV.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  aria-current={item.current ? 'page' : undefined}
                  className="t-body block rounded-[var(--r-cell)] px-3 py-3"
                  style={{ color: item.current ? 'var(--ink)' : 'var(--ink-2)', minHeight: 44 }}
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href="https://codecollective.us/p/"
                className="t-body block rounded-[var(--r-cell)] px-3 py-3"
                style={{ color: 'var(--ink-2)', minHeight: 44 }}
              >
                Log in
              </a>
            </li>
          </ul>
        </nav>
      )}

      {/* On desktop the pill docks in a second row so the nav keeps its place. */}
      {docked && <div className="mx-auto hidden w-full max-w-[1440px] px-6 pb-3 md:block">{docked}</div>}
    </header>
  );
}
