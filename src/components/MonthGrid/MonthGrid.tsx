import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { monthModel } from '../../data/pipeline';
import { addDaysToKey, diffDayKeys, formatLongDay, startOfDayKey } from '../../data/time';
import type { CalEvent } from '../../data/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The Monday on or before `dayKey`. */
function mondayOf(dayKey: string, tz: string): string {
  const d = startOfDayKey(dayKey, tz);
  const js = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d);
  const idx = WEEKDAYS.indexOf(js);
  return addDaysToKey(dayKey, -(idx === -1 ? 0 : idx));
}

/**
 * Cell background is a five-step tidewater heat scale rather than coloured
 * event blocks, so a busy day reads at a glance without the grid shouting.
 */
function heatFor(count: number, max: number): string {
  if (count === 0) return 'var(--heat-0)';
  const ratio = max > 0 ? Math.sqrt(count / max) : 0;
  if (ratio > 0.75) return 'var(--heat-4)';
  if (ratio > 0.55) return 'var(--heat-3)';
  if (ratio > 0.35) return 'var(--heat-2)';
  return 'var(--heat-1)';
}

export type MonthGridProps = {
  events: CalEvent[];
  tz: string;
  todayKey: string;
  onPickDay: (dayKey: string) => void;
};

export function MonthGrid({ events, tz, todayKey, onPickDay }: MonthGridProps) {
  // The grid starts at the current week and moves in four-week pages.
  const firstWeek = useMemo(() => mondayOf(todayKey, tz), [todayKey, tz]);
  const [page, setPage] = useState(0);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [focusKey, setFocusKey] = useState<string>(todayKey);

  const model = useMemo(() => monthModel(events), [events]);
  const max = useMemo(() => {
    let m = 0;
    for (const cell of model.values()) m = Math.max(m, cell.count);
    return m;
  }, [model]);

  const start = addDaysToKey(firstWeek, page * 28);
  const cells = useMemo(
    () => Array.from({ length: 28 }, (_, i) => addDaysToKey(start, i)),
    [start],
  );

  const rangeLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long', year: 'numeric' });
    const a = fmt.format(startOfDayKey(start, tz));
    const b = fmt.format(startOfDayKey(cells[27]!, tz));
    return a === b ? a : `${a} to ${b}`;
  }, [start, cells, tz]);

  const move = (deltaDays: number) => {
    const next = addDaysToKey(focusKey, deltaDays);
    // Follow the focus onto the next or previous page when it leaves this one.
    const offset = diffDayKeys(start, next);
    if (offset < 0) setPage((p) => Math.max(0, p - 1));
    else if (offset > 27) setPage((p) => p + 1);
    setFocusKey(next);
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLElement>(`[data-cell="${next}"]`)?.focus();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      PageUp: -28,
      PageDown: 28,
    };
    const delta = map[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    move(delta);
  };

  return (
    <div className="px-4 pb-8">
      <div className="flex items-center justify-between gap-3 py-3">
        <h2 className="t-day" style={{ color: 'var(--ink)' }}>
          {rangeLabel}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous four weeks"
            className="flex items-center justify-center rounded-[var(--r-cell)] border"
            style={{
              borderColor: 'var(--line)',
              color: 'var(--ink-2)',
              minWidth: 44,
              minHeight: 44,
              opacity: page === 0 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={18} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPage(0)}
            className="t-meta rounded-[var(--r-cell)] border px-3"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)', minHeight: 44 }}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next four weeks"
            className="flex items-center justify-center rounded-[var(--r-cell)] border"
            style={{ borderColor: 'var(--line)', color: 'var(--ink-2)', minWidth: 44, minHeight: 44 }}
          >
            <ChevronRight size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label="Events by day"
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-1"
      >
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            role="columnheader"
            className="t-caption pb-1 text-center"
            style={{ color: 'var(--ink-2)' }}
          >
            {w}
          </div>
        ))}

        {cells.map((dayKey) => {
          const cell = model.get(dayKey);
          const count = cell?.count ?? 0;
          const isToday = dayKey === todayKey;
          const isPast = dayKey < todayKey;

          return (
            <button
              key={dayKey}
              type="button"
              role="gridcell"
              data-cell={dayKey}
              tabIndex={dayKey === focusKey ? 0 : -1}
              aria-label={`${formatLongDay(dayKey, tz)}, ${count === 1 ? '1 event' : `${count} events`}`}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => onPickDay(dayKey)}
              onFocus={() => setFocusKey(dayKey)}
              className="flex min-h-[104px] flex-col items-stretch gap-1 rounded-[var(--r-cell)] p-2 text-left"
              style={{
                background: heatFor(count, max),
                opacity: isPast ? 0.5 : 1,
                border: `1px solid ${isToday ? 'var(--accent)' : 'transparent'}`,
              }}
            >
              <span className="flex items-baseline justify-between gap-1">
                <span
                  className="t-tide-num"
                  style={{ color: isToday ? 'var(--accent)' : 'var(--ink)' }}
                >
                  {Number(dayKey.slice(8, 10))}
                </span>
                <span className="t-caption tnum" style={{ color: 'var(--ink-2)' }}>
                  {count > 0 ? count : ''}
                </span>
              </span>

              {cell && cell.sectors.length > 0 && (
                <span aria-hidden className="flex gap-1">
                  {cell.sectors.map((s) => (
                    <span
                      key={s}
                      className="h-[6px] w-[6px] rounded-full"
                      style={{ background: `var(--sector-${s})` }}
                    />
                  ))}
                </span>
              )}

              {cell?.titles.map((t) => (
                <span
                  key={t}
                  aria-hidden
                  className="t-caption clamp-1"
                  style={{ color: 'var(--ink-2)' }}
                >
                  {t}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
