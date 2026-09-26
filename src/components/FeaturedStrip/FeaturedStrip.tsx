import { formatLongDay, formatTime } from '../../data/time';
import type { CalEvent } from '../../data/types';

/**
 * Large image cards are reserved for this module. It renders nothing at all
 * when no Code Collective events fall in range, which is the case for the
 * whole current Baltimore feed.
 */
export function FeaturedStrip({
  events,
  tz,
  onOpen,
}: {
  events: CalEvent[];
  tz: string;
  onOpen: (key: string) => void;
}) {
  if (events.length === 0) return null;

  return (
    <section className="px-4 pt-4 pb-2" aria-labelledby="featured-heading">
      <h2 id="featured-heading" className="t-day mb-3" style={{ color: 'var(--ink)' }}>
        From Code Collective
      </h2>
      <ul className="no-scrollbar m-0 flex list-none gap-4 overflow-x-auto p-0 pb-2">
        {events.map((e) => (
          <li key={e.key} className="w-[260px] shrink-0">
            <button type="button" onClick={() => onOpen(e.key)} className="w-full text-left">
              <span
                className="block aspect-[4/3] w-full rounded-[var(--r-image)] bg-cover bg-center"
                style={{
                  background: e.image
                    ? `var(--surface-2) url(${JSON.stringify(e.image)}) center/cover no-repeat`
                    : 'var(--surface-2)',
                }}
              />
              <span className="t-caption tnum mt-2 block" style={{ color: 'var(--ink-2)' }}>
                {formatLongDay(e.dayKey, tz)}, {formatTime(e.start, tz)}
              </span>
              <span className="t-row-title clamp-2 mt-1 block" style={{ color: 'var(--ink)' }}>
                {e.title}
              </span>
              <span className="t-meta mt-1 block truncate" style={{ color: 'var(--ink-2)' }}>
                {[e.venue, e.locality].filter(Boolean).join(', ') || 'Location not listed'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
