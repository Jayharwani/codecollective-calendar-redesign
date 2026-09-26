import { Map as MapIcon, List } from 'lucide-react';
import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Agenda } from '../components/Agenda/Agenda';
import { countLabel } from '../components/Agenda/DaySection';
import { FeaturedStrip } from '../components/FeaturedStrip/FeaturedStrip';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header/Header';
import { MonthGrid } from '../components/MonthGrid/MonthGrid';
import { SearchPill } from '../components/SearchPill/SearchPill';
import { SectorRail } from '../components/SectorRail/SectorRail';
import {
  AgendaSkeleton,
  EmptyState,
  ErrorState,
  MetaSkeleton,
  OfflineBanner,
  StaleBanner,
  TideSkeleton,
} from '../components/States/States';
import { TideLine } from '../components/TideLine/TideLine';
import { getCity } from '../data/cities';
import { invalidateEvents } from '../data/fetchEvents';
import { buildPredicates, type FilterState } from '../data/filters';
import { isSectorId } from '../data/sectors';
import { relativeTime } from '../data/time';
import type { DatePreset, SectorId } from '../data/types';
import { isDarkNow } from './theme';
import { useCalendar } from './useCalendar';

/* Heavy, interaction-only surfaces stay out of the initial payload. */
const MapPanel = lazy(() => import('../components/MapPanel/MapPanel'));
const EventSheet = lazy(() =>
  import('../components/EventSheet/EventSheet').then((m) => ({ default: m.EventSheet })),
);
const FiltersSheet = lazy(() =>
  import('../components/FiltersSheet/FiltersSheet').then((m) => ({ default: m.FiltersSheet })),
);
const SubscribePopover = lazy(() =>
  import('../components/SubscribePopover/SubscribePopover').then((m) => ({
    default: m.SubscribePopover,
  })),
);

/* ---------------- error boundary ---------------- */

type BoundaryProps = { children: ReactNode; fallback: (retry: () => void) => ReactNode };

class Boundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback(() => this.setState({ failed: false }));
    return this.props.children;
  }
}

/* ---------------- hooks ---------------- */

const STALE_AFTER_MS = 48 * 3600_000;
const CONDENSE_AT = 80;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function useCondensed(): boolean {
  const [condensed, setCondensed] = useState(false);
  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > CONDENSE_AT);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return condensed;
}

/**
 * Publishes the measured height of the sticky chrome as `--chrome-h`, so day
 * headers stick directly beneath it and `scroll-padding-top` keeps focused
 * elements out from under it. Measured, not guessed: the chrome changes height
 * between breakpoints and when the title block collapses.
 */
function useChromeHeight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        '--chrome-h',
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return ref;
}

function useDarkTheme(): boolean {
  const [dark, setDark] = useState(() => (typeof window === 'undefined' ? false : isDarkNow()));
  useEffect(() => {
    const update = () => setDark(isDarkNow());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', update);
      mo.disconnect();
    };
  }, []);
  return dark;
}

/* ---------------- toast ---------------- */

function Toast({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center">
      {message && (
        <span
          className="t-meta rounded-[var(--r-pill)] px-4 py-2"
          style={{ background: 'var(--ink)', color: 'var(--bg)', boxShadow: 'var(--shadow-sheet)' }}
        >
          {message}
        </span>
      )}
    </div>
  );
}

/* ---------------- shell ---------------- */

function Calendar() {
  const cal = useCalendar();
  const { derived, url, actions } = cal;

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const condensed = useCondensed();
  const chromeRef = useChromeHeight<HTMLDivElement>();
  const dark = useDarkTheme();
  const isPhone = useMediaQuery('(max-width: 767px)');
  const isWide = useMediaQuery('(min-width: 1280px)');

  // The map shows by default on wide screens, and the URL always wins.
  const mapOn = url.mapParam ?? isWide;

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast((t) => (t === message ? null : t)), 2600);
  }, []);

  const onOpen = useCallback((key: string) => actions.openEvent(key), [actions]);
  const onHover = useCallback((key: string | null) => setHoveredKey(key), []);
  const onVisibleDayChange = useCallback((dayKey: string) => setActiveDay(dayKey), []);

  /** Scroll the agenda to a day, clearing a date filter that would hide it. */
  const scrollToDay = useCallback(
    (dayKey: string) => {
      const range = derived.dateRange;
      if (range && (dayKey < range.from || dayKey > range.to)) {
        actions.applyFilters({ datePreset: 'any', from: null, to: null });
      }
      if (url.view === 'month') actions.setView('agenda');
      setActiveDay(dayKey);
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-day="${dayKey}"]`);
        if (!el) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const chrome = Number.parseInt(
          getComputedStyle(document.documentElement).getPropertyValue('--chrome-h'),
          10,
        );
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY - (chrome || 0),
          behavior: reduce ? 'auto' : 'smooth',
        });
      });
    },
    [derived.dateRange, actions, url.view],
  );

  /** A pin click selects the event and flashes its row into view. */
  const onSelectFromMap = useCallback(
    (key: string) => {
      actions.openEvent(key);
      setFlashKey(key);
      setTimeout(() => setFlashKey((k) => (k === key ? null : k)), 700);
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-event-key="${CSS.escape(key)}"]`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    },
    [actions],
  );

  const onSelectSector = useCallback(
    (id: string | null) => {
      if (id === null) {
        if (url.filters.lens === 'community_sectors') actions.setSectors([]);
        else actions.setLensCategories([]);
        return;
      }
      if (url.filters.lens === 'community_sectors') {
        actions.setSectors(isSectorId(id) ? [id as SectorId] : []);
      } else {
        actions.setLensCategories([id]);
      }
    },
    [actions, url.filters.lens],
  );

  const onWhen = useCallback(
    (preset: DatePreset, from?: string | null, to?: string | null) => {
      actions.applyFilters({
        datePreset: preset,
        ...(from !== undefined ? { from } : {}),
        ...(to !== undefined ? { to } : {}),
      });
    },
    [actions],
  );

  /** Live count for the filters sheet button, from a candidate draft. */
  const countFor = useCallback(
    (draft: FilterState) => {
      const p = buildPredicates(draft, {
        tz: cal.tz,
        todayKey: cal.todayKey,
        todayWeekday: new Date(cal.now).getDay(),
      });
      const searchKeys =
        draft.query.trim() === ''
          ? null
          : new Set(derived.filtered.map((e) => e.key));
      let n = 0;
      for (const e of cal.events) {
        if (searchKeys && !searchKeys.has(e.key)) continue;
        if (p.date(e) && p.time(e) && p.sector(e) && p.distance(e)) n++;
      }
      return n;
    },
    [cal.events, cal.tz, cal.todayKey, cal.now, derived.filtered],
  );

  const selectedEvent = useMemo(
    () => (url.eventKey ? (cal.events.find((e) => e.key === url.eventKey) ?? null) : null),
    [url.eventKey, cal.events],
  );

  const moreFromOrganizer = useMemo(() => {
    if (!selectedEvent) return [];
    return cal.events
      .filter((e) => e.orgName === selectedEvent.orgName && e.key !== selectedEvent.key)
      .slice(0, 3);
  }, [selectedEvent, cal.events]);

  const featured = useMemo(
    () => derived.filtered.filter((e) => e.featured).slice(0, 8),
    [derived.filtered],
  );

  const stale =
    cal.newestScrapeAt !== null && Date.now() - cal.newestScrapeAt.getTime() > STALE_AFTER_MS;
  const total = derived.filtered.length;
  const railSelected =
    url.filters.lens === 'community_sectors' ? url.filters.sectors : url.filters.lensCategories;

  const pill = (
    <SearchPill
      city={url.city}
      cityLabel={cal.cityLabel}
      datePreset={url.filters.datePreset}
      from={url.filters.from}
      to={url.filters.to}
      query={url.filters.query}
      onCity={actions.setCity}
      onWhen={onWhen}
      onQuery={actions.setQuery}
    />
  );

  const listColumn = (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {countLabel(total)}
      </p>

      {total === 0 ? (
        <EmptyState
          query={url.filters.query}
          hasDateFilter={url.filters.datePreset !== 'any'}
          relaxations={derived.relaxations}
          onRelax={(r) => actions.applyFilters(r.patch)}
          onClearAll={actions.clearAll}
          onSearchAllDates={() => actions.applyFilters({ datePreset: 'any', from: null, to: null })}
        />
      ) : url.view === 'month' ? (
        <MonthGrid
          events={derived.filtered}
          tz={cal.tz}
          todayKey={cal.todayKey}
          onPickDay={scrollToDay}
        />
      ) : (
        <>
          <FeaturedStrip events={featured} tz={cal.tz} onOpen={onOpen} />
          <Agenda
            days={derived.days}
            tz={cal.tz}
            todayKey={cal.todayKey}
            selectedKey={url.eventKey ?? hoveredKey}
            flashKey={flashKey}
            onOpen={onOpen}
            onHover={onHover}
            onVisibleDayChange={onVisibleDayChange}
            resetToken={cal.resetToken}
          />
        </>
      )}
    </>
  );

  return (
    <>
      <Header
        condensed={condensed}
        docked={condensed ? pill : undefined}
        onSubscribe={() => setSubscribeOpen(true)}
      />

      {!condensed && (
        <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="t-display" style={{ color: 'var(--ink)' }}>
                What&rsquo;s on in {cal.cityLabel}
              </h1>
              <p className="t-meta mt-2" style={{ color: 'var(--ink-2)' }}>
                {cal.events.length.toLocaleString('en-US')} events from {cal.organizers} organizers.
                {cal.newestScrapeAt && <> Updated {relativeTime(cal.newestScrapeAt, cal.now)}.</>}{' '}
                Times in {cal.tzLabel}.
              </p>
              {cal.fromCache && <OfflineBanner />}
              {stale && cal.newestScrapeAt && <StaleBanner newest={cal.newestScrapeAt} />}
            </div>
            <div className="w-full lg:w-auto lg:min-w-[520px]">{pill}</div>
          </div>
        </div>
      )}

      <div ref={chromeRef} className="sticky top-0 z-30" style={{ background: 'var(--bg)' }}>
        <div
          className="mx-auto w-full max-w-[1440px] border-b"
          style={{ borderColor: 'var(--line)' }}
        >
          <SectorRail
            lens={url.filters.lens}
            selected={railSelected}
            onSelect={onSelectSector}
            onOpenFilters={() => setFiltersOpen(true)}
            filterCount={cal.filtersActive}
          />
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <TideLine
                todayKey={cal.todayKey}
                tz={cal.tz}
                counts={derived.tideCounts}
                activeDay={activeDay}
                onPick={scrollToDay}
                ready
              />
            </div>

            {/* Given its own column so it never crowds the strip. */}
            <div
              className="hidden shrink-0 flex-col items-stretch gap-1 border-l pr-4 pl-3 md:flex"
              style={{ borderColor: 'var(--line)' }}
            >
              <div
                role="group"
                aria-label="View"
                className="flex rounded-[var(--r-pill)] border p-[2px]"
                style={{ borderColor: 'var(--line)' }}
              >
                {(['agenda', 'month'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={url.view === v}
                    onClick={() => actions.setView(v)}
                    className="t-caption rounded-[var(--r-pill)] px-3 py-1"
                    style={{
                      minHeight: 30,
                      background: url.view === v ? 'var(--accent-soft)' : 'transparent',
                      color: url.view === v ? 'var(--accent)' : 'var(--ink-2)',
                    }}
                  >
                    {v === 'agenda' ? 'Agenda' : 'Month'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => actions.setMap(!mapOn)}
                className="t-caption rounded-[var(--r-pill)] border px-3 py-1"
                style={{ borderColor: 'var(--line)', color: 'var(--ink-2)', minHeight: 30 }}
              >
                {mapOn ? 'Hide map' : 'Show map'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <main id="main" className="mx-auto w-full max-w-[1440px] pb-24" aria-label={`${cal.cityLabel} events`}>
        {mapOn && !isPhone ? (
          <div className="flex gap-4 px-0 xl:px-4">
            <div className="min-w-0 flex-1 xl:max-w-[720px] xl:min-w-[560px]">{listColumn}</div>
            <aside
              aria-label="Map of events"
              className="sticky hidden xl:block"
              style={{
                top: 'calc(var(--chrome-h) + 16px)',
                height: 'calc(100dvh - var(--chrome-h) - 32px)',
                flex: 1,
              }}
            >
              <Suspense fallback={<div className="h-full rounded-[var(--r-sheet)]" style={{ background: 'var(--surface-2)' }} />}>
                <MapPanel
                  events={derived.mappable}
                  unmappedCount={derived.unmappedCount}
                  center={getCity(url.city).center}
                  tz={cal.tz}
                  selectedKey={url.eventKey}
                  hoveredKey={hoveredKey}
                  dark={dark}
                  onSelect={onSelectFromMap}
                />
              </Suspense>
            </aside>
          </div>
        ) : mapOn && isPhone ? (
          <div className="px-2" style={{ height: 'calc(100dvh - var(--chrome-h) - 16px)' }}>
            <Suspense fallback={<div className="h-full rounded-[var(--r-sheet)]" style={{ background: 'var(--surface-2)' }} />}>
              <MapPanel
                events={derived.mappable}
                unmappedCount={derived.unmappedCount}
                center={getCity(url.city).center}
                tz={cal.tz}
                selectedKey={url.eventKey}
                hoveredKey={hoveredKey}
                dark={dark}
                onSelect={onSelectFromMap}
              />
            </Suspense>
          </div>
        ) : (
          listColumn
        )}
      </main>

      {/* Phones get a floating toggle rather than a second page. */}
      <button
        type="button"
        onClick={() => actions.setMap(!mapOn)}
        className="t-meta fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-[var(--r-pill)] px-5 md:hidden"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
          background: 'var(--ink)',
          color: 'var(--bg)',
          minHeight: 44,
          boxShadow: 'var(--shadow-sheet)',
        }}
      >
        {mapOn ? <List size={16} strokeWidth={1.5} aria-hidden /> : <MapIcon size={16} strokeWidth={1.5} aria-hidden />}
        {mapOn ? 'List' : 'Map'}
      </button>

      <Footer organizers={cal.organizers} />

      <Suspense fallback={null}>
        {selectedEvent && (
          <EventSheet
            event={selectedEvent}
            tz={cal.tz}
            now={cal.now}
            moreFromOrganizer={moreFromOrganizer}
            isPhone={isPhone}
            onClose={() => actions.openEvent(null)}
            onOpenOther={onOpen}
            onToast={showToast}
          />
        )}
        {filtersOpen && (
          <FiltersSheet
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            current={url.filters}
            sectorCounts={derived.sectorCounts}
            countFor={countFor}
            onApply={(next) => actions.applyFilters(next)}
            isPhone={isPhone}
          />
        )}
        {subscribeOpen && (
          <SubscribePopover
            open={subscribeOpen}
            onOpenChange={setSubscribeOpen}
            city={url.city}
            cityLabel={cal.cityLabel}
          />
        )}
      </Suspense>

      <Toast message={toast} />
    </>
  );
}

function LoadingShell() {
  return (
    <>
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-4 sm:px-6">
        <MetaSkeleton />
      </div>
      <TideSkeleton />
      <AgendaSkeleton />
    </>
  );
}

export function App() {
  const cityLabel = getCity(new URLSearchParams(window.location.search).get('city')).label;

  return (
    <>
      <a href="#main" className="skip-link t-meta">
        Skip to events
      </a>
      <Boundary
        fallback={(retry) => (
          <ErrorState
            city={cityLabel}
            onRetry={() => {
              invalidateEvents();
              retry();
            }}
          />
        )}
      >
        <Suspense fallback={<LoadingShell />}>
          <Calendar />
        </Suspense>
      </Boundary>
    </>
  );
}
