import { Search, X } from 'lucide-react';
import { Suspense, lazy, useEffect, useId, useRef, useState } from 'react';
import type { CityId, DatePreset } from '../../data/types';
import { segmentClass, whenLabel } from './pillShared';

const PillSegments = lazy(() => import('./PillSegments'));

export type SearchPillProps = {
  city: CityId;
  cityLabel: string;
  datePreset: DatePreset;
  from: string | null;
  to: string | null;
  query: string;
  onCity: (city: CityId) => void;
  onWhen: (preset: DatePreset, from?: string | null, to?: string | null) => void;
  onQuery: (q: string) => void;
};

/**
 * One entry point, three segments. Results filter live as the visitor types,
 * so there is no submit step and nothing to press before seeing an effect.
 */
export function SearchPill({
  city,
  cityLabel,
  datePreset,
  from,
  to,
  query,
  onCity,
  onWhen,
  onQuery,
}: SearchPillProps) {
  const [text, setText] = useState(query);
  const [segmentsReady, setSegmentsReady] = useState(false);
  const [pending, setPending] = useState<'where' | 'when' | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchId = useId();

  // Keep in step when the query changes elsewhere: a relaxation button, the
  // back button, or a shared link.
  useEffect(() => {
    setText(query);
  }, [query]);

  // Debounced so typing stays responsive across 1,695 events.
  useEffect(() => {
    if (text === query) return;
    const id = setTimeout(() => onQuery(text), 120);
    return () => clearTimeout(id);
  }, [text, query, onQuery]);

  // "/" focuses the field, but never while the visitor is typing elsewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Swap the real popovers in once the page is idle, so the first click is
  // instant without the chunk sitting on the critical path.
  useEffect(() => {
    const ric = (
      globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    ).requestIdleCallback;
    if (typeof ric === 'function') {
      const id = ric(() => setSegmentsReady(true), { timeout: 2000 });
      return () => (globalThis as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setSegmentsReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Shown until the popover chunk lands, and as its Suspense fallback.
  const plainSegments = (
    <>
      <button
        type="button"
        onClick={() => {
          setPending('where');
          setSegmentsReady(true);
        }}
        className={`${segmentClass} shrink-0 rounded-l-[var(--r-pill)]`}
        style={{ minHeight: 56 }}
      >
        <span className="t-caption" style={{ color: 'var(--ink-2)' }}>
          Where
        </span>
        <span className="t-meta truncate" style={{ color: 'var(--ink)' }}>
          {cityLabel}
        </span>
      </button>

      <span aria-hidden className="my-3 w-px shrink-0" style={{ background: 'var(--line)' }} />

      <button
        type="button"
        onClick={() => {
          setPending('when');
          setSegmentsReady(true);
        }}
        className={`${segmentClass} shrink-0`}
        style={{ minHeight: 56 }}
      >
        <span className="t-caption" style={{ color: 'var(--ink-2)' }}>
          When
        </span>
        <span className="t-meta truncate" style={{ color: 'var(--ink)' }}>
          {whenLabel(datePreset, from, to)}
        </span>
      </button>
    </>
  );

  return (
    <div
      className="flex w-full max-w-[560px] items-stretch rounded-[var(--r-pill)]"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-pill)' }}
    >
      {segmentsReady ? (
        <Suspense fallback={plainSegments}>
          <PillSegments
            city={city}
            cityLabel={cityLabel}
            datePreset={datePreset}
            from={from}
            to={to}
            openOnMount={pending}
            onCity={onCity}
            onWhen={onWhen}
          />
        </Suspense>
      ) : (
        plainSegments
      )}

      <span aria-hidden className="my-3 w-px shrink-0" style={{ background: 'var(--line)' }} />

      <div className={`${segmentClass} min-w-0 flex-1`}>
        <label className="t-caption" htmlFor={searchId} style={{ color: 'var(--ink-2)' }}>
          What
        </label>
        <div className="flex items-center gap-2">
          <input
            id={searchId}
            ref={inputRef}
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search events, organizers, venues"
            className="t-meta min-w-0 flex-1 bg-transparent outline-none"
            style={{ color: 'var(--ink)' }}
          />
          {text !== '' && (
            <button
              type="button"
              onClick={() => {
                setText('');
                onQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="shrink-0 rounded-full p-1"
              style={{ color: 'var(--ink-2)' }}
            >
              <X size={16} strokeWidth={1.5} aria-hidden />
            </button>
          )}
        </div>
      </div>

      <span
        aria-hidden
        className="mr-2 flex shrink-0 items-center self-center rounded-full p-2"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        <Search size={16} strokeWidth={2} />
      </span>
    </div>
  );
}
