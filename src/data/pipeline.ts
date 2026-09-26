import {
  buildPredicates,
  countByDay,
  countBySector,
  countMappable,
  resolveDateRange,
  type FilterState,
  type PredicateContext,
} from './filters';
import { TIME_OF_DAY_LABEL, TIME_OF_DAY_ORDER, isLive, timeOfDayOf } from './time';
import type { CalEvent, SectorId, TimeOfDay } from './types';

/** How many events a day may hold before it is split into day parts. */
export const SPLIT_THRESHOLD = 24;
/** How many of a subgroup's events show before the expander. */
export const SUBGROUP_PREVIEW = 8;

export type TimeGroupModel = {
  id: TimeOfDay | 'now';
  label: string;
  events: CalEvent[];
};

export type DaySectionModel = {
  dayKey: string;
  count: number;
  events: CalEvent[];
  /** Non-null when the day is split into "Happening now" and/or day parts. */
  groups: TimeGroupModel[] | null;
};

export type Relaxation = {
  id: string;
  label: string;
  gain: number;
  patch: Partial<FilterState>;
};

export type Derived = {
  /** Everything that survives every filter, in chronological order. */
  filtered: CalEvent[];
  /** Day sections for the agenda. */
  days: DaySectionModel[];
  /** Per-day counts for the tide line: every filter except the date range. */
  tideCounts: Map<string, number>;
  /** Per-sector counts for the filters sheet: every filter except sectors. */
  sectorCounts: Map<SectorId, number>;
  /** Events the map can place, and how many it cannot. */
  mappable: CalEvent[];
  unmappedCount: number;
  /** One-tap ways out of an empty result, most valuable first. */
  relaxations: Relaxation[];
  /** The date window in force, for the month grid and the empty copy. */
  dateRange: { from: string; to: string } | null;
};

/**
 * Split a day into "Happening now" plus day parts.
 *
 * Today is grouped whenever something is live, so the live events lead. Any day
 * over the threshold is grouped so that 105 rows arrive in readable runs
 * instead of one wall.
 */
function groupDay(
  events: CalEvent[],
  opts: { isToday: boolean; now: Date; tz: string },
): TimeGroupModel[] | null {
  const live = opts.isToday ? events.filter((e) => isLive(e, opts.tz, opts.now)) : [];
  const needsSplit = events.length > SPLIT_THRESHOLD;

  if (live.length === 0 && !needsSplit) return null;

  const groups: TimeGroupModel[] = [];
  if (live.length > 0) {
    groups.push({ id: 'now', label: 'Happening now', events: live });
  }

  const rest = live.length > 0 ? events.filter((e) => !live.includes(e)) : events;

  if (!needsSplit) {
    // Only the live subgroup was needed; the rest stays one run.
    if (rest.length > 0) {
      const part = timeOfDayOf(rest[0]!.start, opts.tz);
      groups.push({ id: part, label: 'Later today', events: rest });
    }
    return groups;
  }

  const buckets = new Map<TimeOfDay, CalEvent[]>();
  for (const e of rest) {
    const part = timeOfDayOf(e.start, opts.tz);
    const list = buckets.get(part);
    if (list) list.push(e);
    else buckets.set(part, [e]);
  }
  for (const part of TIME_OF_DAY_ORDER) {
    const list = buckets.get(part);
    if (list && list.length > 0) {
      groups.push({ id: part, label: TIME_OF_DAY_LABEL[part], events: list });
    }
  }
  return groups;
}

export type PipelineContext = PredicateContext & {
  now: Date;
  /** Match keys from the search index, or null when the query is empty. */
  searchKeys: Set<string> | null;
};

/**
 * One pass over the events for a given filter state.
 *
 * Stages are kept separate so the tide line and the sector counts can each be
 * built from everything *except* the dimension they are offering to change.
 * Without that, a chosen sector would zero out every other sector's count and
 * the filters sheet would look broken.
 */
export function derive(
  events: readonly CalEvent[],
  state: FilterState,
  ctx: PipelineContext,
): Derived {
  const p = buildPredicates(state, ctx);
  const searchOf = (e: CalEvent) => ctx.searchKeys === null || ctx.searchKeys.has(e.key);

  // Everything except the date range, for the tide line.
  const exceptDate: CalEvent[] = [];
  // Everything except sectors, for the sector counts.
  const exceptSector: CalEvent[] = [];
  const filtered: CalEvent[] = [];

  for (const e of events) {
    const d = p.date(e);
    const t = p.time(e);
    const s = p.sector(e);
    const dist = p.distance(e);
    const q = searchOf(e);

    if (t && s && dist && q) exceptDate.push(e);
    if (d && t && dist && q) exceptSector.push(e);
    if (d && t && s && dist && q) filtered.push(e);
  }

  const tideCounts = countByDay(exceptDate);
  const sectorCounts = countBySector(exceptSector);

  const todayKey = ctx.todayKey;
  const days: DaySectionModel[] = [];
  let current: { dayKey: string; events: CalEvent[] } | null = null;
  for (const e of filtered) {
    if (!current || current.dayKey !== e.dayKey) {
      current = { dayKey: e.dayKey, events: [] };
      days.push({ dayKey: e.dayKey, count: 0, events: current.events, groups: null });
    }
    current.events.push(e);
  }
  for (const day of days) {
    day.count = day.events.length;
    day.groups = groupDay(day.events, {
      isToday: day.dayKey === todayKey,
      now: ctx.now,
      tz: ctx.tz,
    });
  }

  const mappable = filtered.filter((e) => e.coords !== null);

  return {
    filtered,
    days,
    tideCounts,
    sectorCounts,
    mappable,
    unmappedCount: filtered.length - mappable.length,
    relaxations: buildRelaxations(events, state, ctx, filtered.length),
    dateRange: resolveDateRange(state, ctx.todayKey, ctx.todayWeekday),
  };
}

/** How many events survive a given patch to the filter state. */
function countWith(
  events: readonly CalEvent[],
  state: FilterState,
  ctx: PipelineContext,
  patch: Partial<FilterState>,
): number {
  const next = { ...state, ...patch };
  const p = buildPredicates(next, ctx);
  const searchOf = (e: CalEvent) =>
    next.query.trim() === '' || ctx.searchKeys === null || ctx.searchKeys.has(e.key);
  let n = 0;
  for (const e of events) {
    if (p.date(e) && p.time(e) && p.sector(e) && p.distance(e) && searchOf(e)) n++;
  }
  return n;
}

/**
 * The three most valuable ways out of an empty result, with the real gain each
 * one buys. Computed live, never guessed.
 */
export function buildRelaxations(
  events: readonly CalEvent[],
  state: FilterState,
  ctx: PipelineContext,
  currentCount: number,
): Relaxation[] {
  if (currentCount > 0) return [];

  const candidates: Array<{ id: string; label: (gain: number) => string; patch: Partial<FilterState> }> = [];

  if (state.sectors.length > 0 || state.lensCategories.length > 0) {
    candidates.push({
      id: 'sectors',
      label: (g) => `Show all sectors (+${g})`,
      patch: { sectors: [], lensCategories: [] },
    });
  }
  if (state.timesOfDay.length > 0 || (state.timeStart !== null && state.timeEnd !== null)) {
    candidates.push({
      id: 'time',
      label: (g) => `Any time of day (+${g})`,
      patch: { timesOfDay: [], timeStart: null, timeEnd: null },
    });
  }
  if (state.outsideWorkHours) {
    candidates.push({
      id: 'work',
      label: (g) => `Include weekday daytime events (+${g})`,
      patch: { outsideWorkHours: false },
    });
  }
  if (state.nearCoords !== null && state.radiusMiles < 25) {
    candidates.push({
      id: 'radius',
      label: (g) => `Widen distance to 25 miles (+${g})`,
      patch: { radiusMiles: 25 },
    });
  } else if (state.nearCoords !== null) {
    candidates.push({
      id: 'distance-off',
      label: (g) => `Search any distance (+${g})`,
      patch: { nearCoords: null, near: null },
    });
  }
  if (state.datePreset !== 'any') {
    candidates.push({
      id: 'dates',
      label: (g) => `Search all dates (+${g})`,
      patch: { datePreset: 'any', from: null, to: null },
    });
  }

  const scored: Relaxation[] = [];
  for (const c of candidates) {
    const gain = countWith(events, state, ctx, c.patch) - currentCount;
    if (gain > 0) scored.push({ id: c.id, label: c.label(gain), gain, patch: c.patch });
  }
  scored.sort((a, b) => b.gain - a.gain);
  return scored.slice(0, 3);
}

/** Counts for the month grid, keyed by day, plus the sectors seen that day. */
export function monthModel(
  filtered: readonly CalEvent[],
): Map<string, { count: number; sectors: SectorId[]; titles: string[] }> {
  const m = new Map<string, { count: number; sectors: SectorId[]; titles: string[] }>();
  for (const e of filtered) {
    let cell = m.get(e.dayKey);
    if (!cell) {
      cell = { count: 0, sectors: [], titles: [] };
      m.set(e.dayKey, cell);
    }
    cell.count++;
    if (cell.titles.length < 2) cell.titles.push(e.title);
    if (!cell.sectors.includes(e.primarySector) && cell.sectors.length < 5) {
      cell.sectors.push(e.primarySector);
    }
  }
  return m;
}

/** Re-exported so components need a single import. */
export { countMappable };
