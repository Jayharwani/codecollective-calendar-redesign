import { useState } from 'react';
import { SUBGROUP_PREVIEW, type DaySectionModel, type TimeGroupModel } from '../../data/pipeline';
import { formatDayHeader, formatLongDay } from '../../data/time';
import { EventRow } from './EventRow';

export type DaySectionProps = {
  day: DaySectionModel;
  tz: string;
  todayKey: string;
  selectedKey: string | null;
  flashKey: string | null;
  onOpen: (key: string) => void;
  onHover: (key: string | null) => void;
};

export function countLabel(n: number): string {
  return n === 1 ? '1 event' : `${n} events`;
}

type RowListProps = Omit<DaySectionProps, 'day' | 'todayKey'>;

function RowList({
  events,
  tz,
  selectedKey,
  flashKey,
  onOpen,
  onHover,
}: RowListProps & { events: DaySectionModel['events'] }) {
  return (
    <ul className="row-list">
      {events.map((e) => (
        <EventRow
          key={e.key}
          event={e}
          tz={tz}
          selected={selectedKey === e.key}
          flash={flashKey === e.key}
          onOpen={onOpen}
          onHover={onHover}
        />
      ))}
    </ul>
  );
}

/** A run of rows under one subheading, with the rest behind an expander. */
function TimeGroup({ group, ...rest }: { group: TimeGroupModel } & RowListProps) {
  const [expanded, setExpanded] = useState(false);
  const isLive = group.id === 'now';
  // Live events are never hidden behind an expander.
  const shown = expanded || isLive ? group.events : group.events.slice(0, SUBGROUP_PREVIEW);
  const hidden = group.events.length - shown.length;

  return (
    <div>
      <h3
        className="t-caption flex items-center gap-2 px-4 pt-4 pb-1"
        style={{ color: 'var(--ink-2)' }}
      >
        {isLive && (
          <span
            aria-hidden
            className="live-dot h-2 w-2 rounded-full"
            style={{ background: 'var(--live)' }}
          />
        )}
        <span style={isLive ? { color: 'var(--live)' } : undefined}>{group.label}</span>
        <span className="tnum" style={{ color: 'var(--ink-2)' }}>
          {group.events.length}
        </span>
      </h3>
      <RowList events={shown} {...rest} />
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="t-meta w-full px-4 py-3 text-left"
          style={{ color: 'var(--accent)' }}
        >
          Show {hidden} more {group.label.toLowerCase()} event{hidden === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
}

export function DaySection({ day, tz, todayKey, ...rest }: DaySectionProps) {
  const heading = formatDayHeader(day.dayKey, todayKey, tz);
  const isRelative = heading === 'Today' || heading === 'Tomorrow';

  return (
    <section className="day-section" data-day={day.dayKey} aria-labelledby={`h-${day.dayKey}`}>
      <header
        className="sticky z-10 flex items-baseline justify-between gap-3 border-b px-4 py-2"
        style={{ top: 'var(--chrome-h)', borderColor: 'var(--line)', background: 'var(--bg)' }}
      >
        <h2 id={`h-${day.dayKey}`} className="t-day min-w-0" style={{ color: 'var(--ink)' }}>
          {heading}
          {isRelative && (
            <span className="t-meta ml-2 font-normal" style={{ color: 'var(--ink-2)' }}>
              {formatLongDay(day.dayKey, tz)}
            </span>
          )}
        </h2>
        <span className="t-meta tnum shrink-0" style={{ color: 'var(--ink-2)' }}>
          {countLabel(day.count)}
        </span>
      </header>

      {day.groups ? (
        <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
          {day.groups.map((g) => (
            <TimeGroup key={g.id} group={g} tz={tz} {...rest} />
          ))}
        </div>
      ) : (
        <RowList events={day.events} tz={tz} {...rest} />
      )}
    </section>
  );
}
