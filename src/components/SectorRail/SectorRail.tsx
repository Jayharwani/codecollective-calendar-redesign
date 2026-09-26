import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RAIL_ORDER, SECTOR_LABEL } from '../../data/sectors';
import type { LensId, SectorId } from '../../data/types';
import { LENSES } from '../../data/lenses';
import { spring } from '../../motion/tokens';
import { SectorIcon } from '../SectorIcon';

export type SectorRailProps = {
  lens: LensId;
  selected: string[];
  onSelect: (id: string | null) => void;
  onOpenFilters: () => void;
  filterCount: number;
};

type Item = { id: string; label: string; color?: string };

/**
 * Mission-first order, not by volume. Technology is 4% of the listings and
 * leads the rail, because it is why someone opens a calendar branded for
 * technologists.
 */
function itemsFor(lens: LensId): Item[] {
  if (lens === 'community_sectors') {
    return RAIL_ORDER.map((id) => ({ id, label: SECTOR_LABEL[id] }));
  }
  return LENSES[lens].categories.map((c) => ({ id: c.id, label: c.label, color: c.color }));
}

export function SectorRail({
  lens,
  selected,
  onSelect,
  onOpenFilters,
  filterCount,
}: SectorRailProps) {
  const scrollerRef = useRef<HTMLUListElement | null>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });
  const items = itemsFor(lens);
  const allActive = selected.length === 0;

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setOverflow({
      start: el.scrollLeft > 4,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [measure, lens]);

  const nudge = (dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });
  };

  const renderItem = (item: Item | null) => {
    const isAll = item === null;
    const id = isAll ? 'all' : item.id;
    const active = isAll ? allActive : selected.includes(item.id);

    return (
      <li key={id} className="relative shrink-0">
        <button
          type="button"
          aria-pressed={active}
          onClick={() => onSelect(isAll ? null : item.id)}
          className="rail-item flex w-[84px] flex-col items-center gap-1 px-2 pt-2 pb-2"
          style={{ minHeight: 60, color: active ? 'var(--ink)' : 'var(--ink-2)' }}
        >
          <span className="rail-icon flex h-5 items-center justify-center">
            {isAll || item.color === undefined ? (
              <SectorIcon sector={(isAll ? 'all' : item.id) as SectorId | 'all'} size={20} />
            ) : (
              <span
                aria-hidden
                className="h-3 w-3 rounded-full"
                style={{ background: item.color }}
              />
            )}
          </span>
          <span className="t-caption text-center leading-tight">
            {isAll ? 'All' : item.label}
          </span>
        </button>
        {active && (
          <motion.span
            layoutId="rail-underline"
            transition={spring.snappy}
            aria-hidden
            className="absolute right-2 bottom-0 left-2 block h-[2px]"
            style={{ background: 'var(--ink)' }}
          />
        )}
      </li>
    );
  };

  return (
    <div className="relative flex items-center">
      {overflow.start && (
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label="Scroll sectors left"
          className="absolute left-0 z-10 hidden h-full w-8 items-center justify-center md:flex"
          style={{ background: 'linear-gradient(to right, var(--bg) 55%, transparent)', color: 'var(--ink-2)' }}
        >
          <ChevronLeft size={18} strokeWidth={1.5} aria-hidden />
        </button>
      )}

      <ul
        ref={scrollerRef}
        className={`no-scrollbar m-0 flex flex-1 list-none items-stretch gap-0 overflow-x-auto p-0 px-2 ${
          overflow.start || overflow.end ? 'rail-mask' : ''
        }`}
      >
        {renderItem(null)}
        {items.map((item) => renderItem(item))}
      </ul>

      {overflow.end && (
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label="Scroll sectors right"
          className="absolute z-10 hidden h-full w-8 items-center justify-center md:flex"
          style={{
            right: 108,
            background: 'linear-gradient(to left, var(--bg) 55%, transparent)',
            color: 'var(--ink-2)',
          }}
        >
          <ChevronRight size={18} strokeWidth={1.5} aria-hidden />
        </button>
      )}

      <div className="shrink-0 pr-4 pl-2">
        <button
          type="button"
          onClick={onOpenFilters}
          className="t-meta relative flex items-center gap-2 rounded-[var(--r-pill)] border px-3 py-2"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)', color: 'var(--ink)', minHeight: 44 }}
        >
          <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden />
          <span className="hidden sm:inline">Filters</span>
          {filterCount > 0 && (
            <span
              className="t-caption tnum flex h-5 min-w-5 items-center justify-center rounded-full px-1"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              {filterCount}
              <span className="sr-only"> filters active</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
