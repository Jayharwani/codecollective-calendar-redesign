import { Popover } from '@base-ui/react/popover';
import { Clock, CloudOff, WifiOff } from 'lucide-react';
import { relativeTime } from '../../data/time';

/**
 * v1 gave data problems a full-width banner, which cost a whole band above the
 * first event. v2 puts a chip at the end of the meta line instead. No sentence
 * is lost: the full wording opens in a popover.
 */
export type DataStatus =
  | { kind: 'ok' }
  | { kind: 'snapshot'; takenOn: string | null }
  | { kind: 'stale'; newest: Date; now: Date }
  | { kind: 'offline' };

export function dataStatus(args: {
  feedSource: 'live' | 'session' | 'snapshot';
  snapshotDate: string | null;
  newestScrapeAt: Date | null;
  now: Date;
  staleAfterMs: number;
}): DataStatus {
  if (args.feedSource === 'snapshot') return { kind: 'snapshot', takenOn: args.snapshotDate };
  if (args.feedSource === 'session') return { kind: 'offline' };
  if (args.newestScrapeAt && args.now.getTime() - args.newestScrapeAt.getTime() > args.staleAfterMs) {
    return { kind: 'stale', newest: args.newestScrapeAt, now: args.now };
  }
  return { kind: 'ok' };
}

function describe(status: DataStatus): { label: string; body: string; Icon: typeof Clock } | null {
  switch (status.kind) {
    case 'snapshot':
      return {
        label: 'Saved copy',
        Icon: CloudOff,
        body: `The live feed could not be reached, so this is a saved copy${
          status.takenOn ? ` from ${status.takenOn}` : ''
        }. Check the event page before you go.`,
      };
    case 'stale':
      return {
        label: `Updated ${relativeTime(status.newest, status.now)}`,
        Icon: Clock,
        body: `Listings were last updated ${relativeTime(
          status.newest,
          status.now,
        )}. Check the event page before you go.`,
      };
    case 'offline':
      return {
        label: 'Offline',
        Icon: WifiOff,
        body: 'Showing events from your last visit.',
      };
    case 'ok':
    default:
      return null;
  }
}

export function StatusChip({ status }: { status: DataStatus }) {
  const detail = describe(status);
  if (!detail) return null;
  const { label, body, Icon } = detail;

  return (
    <Popover.Root>
      <Popover.Trigger
        className="t-caption ml-2 inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 align-middle"
        style={{
          minHeight: 26,
          background: 'rgb(135 206 235 / 0.14)',
          color: 'var(--sky)',
        }}
      >
        <Icon size={12} strokeWidth={2} aria-hidden />
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="start">
          <Popover.Popup
            className="t-meta"
            style={{
              maxWidth: 320,
              padding: '12px 14px',
              background: 'var(--bg)',
              color: 'var(--ink)',
              borderRadius: 'var(--r-cell)',
              boxShadow: 'var(--shadow-sheet)',
              zIndex: 70,
            }}
          >
            {body}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
