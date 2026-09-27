import { Switch } from '@base-ui/react/switch';
import { SlidersHorizontal } from 'lucide-react';
import { SectorRail } from '../SectorRail/SectorRail';
import type { LensId } from '../../data/types';

export type ControlBarProps = {
  lens: LensId;
  selected: string[];
  onSelect: (id: string | null) => void;
  onOpenFilters: () => void;
  filterCount: number;
  view: 'agenda' | 'month';
  onView: (view: 'agenda' | 'month') => void;
  mapOn: boolean;
  onMap: (on: boolean) => void;
  isPhone: boolean;
  /** True once the band above has condensed, which frosts this bar. */
  stuck: boolean;
};

/**
 * Layer 2 of three: what am I looking at. One 64px row that absorbs v1's
 * separate rail row and the controls that used to sit beside the tide line.
 */
export function ControlBar({
  lens,
  selected,
  onSelect,
  onOpenFilters,
  filterCount,
  view,
  onView,
  mapOn,
  onMap,
  isPhone,
  stuck,
}: ControlBarProps) {
  return (
    <div
      className="sticky z-30 w-full border-b"
      style={{
        top: 'var(--band-h)',
        borderColor: 'var(--line)',
        background: stuck ? 'color-mix(in srgb, var(--bg) 85%, transparent)' : 'var(--bg)',
        backdropFilter: stuck ? 'blur(16px) saturate(140%)' : undefined,
        WebkitBackdropFilter: stuck ? 'blur(16px) saturate(140%)' : undefined,
      }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <SectorRail lens={lens} selected={selected} onSelect={onSelect} />
        </div>

        <span
          aria-hidden
          className="mx-3 h-8 w-px shrink-0 sm:mx-4"
          style={{ background: 'var(--line)' }}
        />

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenFilters}
            aria-label={filterCount > 0 ? `Filters, ${filterCount} active` : 'Filters'}
            className="t-meta flex items-center justify-center gap-2 rounded-[var(--r-pill)] border px-3"
            style={{
              borderColor: 'var(--line)',
              color: 'var(--ink)',
              minWidth: 44,
              minHeight: 40,
            }}
          >
            <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden />
            <span className="hidden sm:inline">Filters</span>
            {filterCount > 0 && (
              <span
                aria-hidden
                className="t-caption tnum flex h-5 min-w-5 items-center justify-center rounded-full px-1"
                style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
              >
                {filterCount}
              </span>
            )}
          </button>

          {!isPhone && (
            <>
              <div
                role="group"
                aria-label="View"
                className="flex rounded-[var(--r-pill)] border p-[3px]"
                style={{ borderColor: 'var(--line)' }}
              >
                {(['agenda', 'month'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => onView(v)}
                    className="t-meta rounded-[var(--r-pill)] px-3"
                    style={{
                      minHeight: 32,
                      background: view === v ? 'var(--brand)' : 'transparent',
                      color: view === v ? 'var(--brand-ink)' : 'var(--ink-2)',
                      fontWeight: view === v ? 600 : 400,
                    }}
                  >
                    {v === 'agenda' ? 'List' : 'Month'}
                  </button>
                ))}
              </div>

              <label className="flex shrink-0 items-center gap-2" style={{ minHeight: 40 }}>
                <span className="t-meta" style={{ color: 'var(--ink-2)' }}>
                  Map
                </span>
                <Switch.Root
                  checked={mapOn}
                  onCheckedChange={onMap}
                  className="shrink-0 rounded-[var(--r-pill)]"
                  style={{
                    width: 40,
                    height: 24,
                    padding: 3,
                    background: mapOn ? 'var(--brand)' : 'var(--bg-soft)',
                    border: `1px solid ${mapOn ? 'var(--brand)' : 'var(--line)'}`,
                  }}
                >
                  <Switch.Thumb
                    className="block rounded-full"
                    style={{
                      width: 16,
                      height: 16,
                      background: mapOn ? 'var(--brand-ink)' : 'var(--ink-2)',
                      transform: mapOn ? 'translateX(16px)' : 'translateX(0)',
                      transition: 'transform 0.16s ease',
                    }}
                  />
                </Switch.Root>
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
