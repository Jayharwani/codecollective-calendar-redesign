import { memo, useState } from 'react';
import { SECTOR_LABEL } from '../../data/sectors';
import { formatShortDay, formatTime } from '../../data/time';
import type { CalEvent } from '../../data/types';
import { SectorIcon } from '../SectorIcon';

/**
 * Rows are time-first, not image-first. A home listing is chosen by how it
 * looks; an event is chosen by when it happens.
 *
 * The row is an anchor to `?event=<key>` so middle-click and Cmd-click open a
 * tab, while a plain click is intercepted to open the sheet in place.
 */
export type EventRowProps = {
  event: CalEvent;
  tz: string;
  selected: boolean;
  onOpen: (key: string) => void;
  onHover: (key: string | null) => void;
  /** Set when a map pin was just clicked, to flash the row. */
  flash: boolean;
};

function Thumb({ event }: { event: CalEvent }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const showImage = event.image !== null && !imageFailed;
  const showLogo = !showImage && event.orgLogo !== null && !logoFailed;

  if (showImage) {
    return (
      <img
        src={event.image!}
        alt=""
        width={64}
        height={64}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
        className="h-16 w-16 rounded-[var(--r-thumb)] object-cover"
        style={{ background: 'var(--surface-2)' }}
      />
    );
  }

  if (showLogo) {
    return (
      <img
        src={event.orgLogo!}
        alt=""
        width={64}
        height={64}
        loading="lazy"
        decoding="async"
        onError={() => setLogoFailed(true)}
        className="h-16 w-16 rounded-[var(--r-thumb)] object-contain p-2"
        style={{ background: 'var(--surface-2)' }}
      />
    );
  }

  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-[var(--r-thumb)]"
      style={{
        background: `var(--sector-${event.primarySector}-tint)`,
        color: `var(--sector-${event.primarySector})`,
      }}
    >
      <SectorIcon sector={event.primarySector} size={22} />
    </div>
  );
}

function Badge({ tone, children }: { tone: 'danger' | 'quiet' | 'accent'; children: string }) {
  const style =
    tone === 'danger'
      ? { background: 'var(--sector-politics-tint)', color: 'var(--danger)' }
      : tone === 'accent'
        ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
        : { background: 'var(--surface-2)', color: 'var(--ink-2)' };
  return (
    <span
      className="t-caption ml-2 inline-block shrink-0 rounded-[var(--r-pill)] px-2 py-[2px] align-middle"
      style={style}
    >
      {children}
    </span>
  );
}

export const EventRow = memo(function EventRow({
  event,
  tz,
  selected,
  onOpen,
  onHover,
  flash,
}: EventRowProps) {
  // Fall back to the address when there is no venue name, so a row only says
  // "Location not listed" when the feed really gave us nothing.
  const place =
    [event.venue ?? event.address, event.locality].filter(Boolean).join(', ') ||
    'Location not listed';

  // The accessible description carries everything colour and layout imply.
  const sectorNames = event.sectors.map((s) => SECTOR_LABEL[s]).join(', ');
  const timeText = event.allDay
    ? 'All day'
    : event.end
      ? `${formatTime(event.start, tz)} to ${formatTime(event.end, tz)}`
      : formatTime(event.start, tz);
  const description = [
    timeText,
    sectorNames,
    event.orgName,
    place,
    event.cancelled ? 'Cancelled' : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <li>
      <a
        href={`?event=${encodeURIComponent(event.key)}`}
        aria-current={selected ? 'true' : undefined}
        aria-describedby={`d-${event.key}`}
        data-event-key={event.key}
        onClick={(e) => {
          // Leave modified clicks to the browser so a new tab still works.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onOpen(event.key);
        }}
        onPointerEnter={() => onHover(event.key)}
        onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(event.key)}
        onBlur={() => onHover(null)}
        className={`focus-inset grid grid-cols-[76px_1fr_auto] items-start gap-3 px-4 py-4 transition-colors sm:gap-4 ${
          flash ? 'row-flash' : ''
        }`}
        style={{
          background: selected ? 'var(--accent-soft)' : undefined,
        }}
        onMouseEnter={(e) => {
          if (!selected) e.currentTarget.style.background = 'var(--surface-2)';
        }}
        onMouseLeave={(e) => {
          if (!selected) e.currentTarget.style.background = '';
        }}
      >
        <div className="pt-[2px]">
          {event.allDay ? (
            <span className="t-row-time block" style={{ color: 'var(--ink)' }}>
              All day
            </span>
          ) : (
            <>
              <time
                dateTime={event.start.toISOString()}
                className="t-row-time block"
                style={{ color: 'var(--ink)' }}
              >
                {formatTime(event.start, tz)}
              </time>
              {event.end && (
                <time
                  dateTime={event.end.toISOString()}
                  className="t-row-time block font-normal"
                  style={{ color: 'var(--ink-2)' }}
                >
                  {formatTime(event.end, tz)}
                </time>
              )}
            </>
          )}
        </div>

        <div className="min-w-0">
          {/* A cancelled listing is struck through and badged rather than
              faded: 60% opacity took the muted ink to 3.3:1. */}
          <h3
            className="t-row-title clamp-2"
            style={{
              color: event.cancelled ? 'var(--ink-2)' : 'var(--ink)',
              textDecoration: event.cancelled ? 'line-through' : undefined,
            }}
          >
            {event.title}
            {event.cancelled && <Badge tone="danger">Cancelled</Badge>}
            {event.featured && <Badge tone="accent">Code Collective</Badge>}
            {event.recurring && !event.cancelled && <Badge tone="quiet">Repeats</Badge>}
          </h3>

          <p className="t-meta mt-1 flex min-w-0 items-center gap-2" style={{ color: 'var(--ink-2)' }}>
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: `var(--sector-${event.primarySector})` }}
            />
            <span className="truncate">{event.orgName}</span>
          </p>

          <p className="t-meta mt-[2px] truncate" style={{ color: 'var(--ink-2)' }}>
            {place}
          </p>

          {event.endDayKey && (
            <p className="t-caption mt-1" style={{ color: 'var(--ink-2)' }}>
              Until {formatShortDay(event.endDayKey, tz)}
            </p>
          )}

          <span id={`d-${event.key}`} className="sr-only">
            {description}
          </span>
        </div>

        <Thumb event={event} />
      </a>
    </li>
  );
});
