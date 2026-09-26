import type { CityId, RawEvent } from './types';

/**
 * One cached promise per city, read with React `use()` inside a Suspense
 * boundary. Nothing here touches the DOM, so it is safe to start early.
 */
export type FeedResult = {
  rows: RawEvent[];
  /** True when the rows came from sessionStorage after a failed fetch. */
  fromCache: boolean;
  fetchedAt: number;
};

const MODE = (import.meta.env?.VITE_DATA_SOURCE as string | undefined) ?? 'live';
const BASE = import.meta.env?.BASE_URL ?? '/';

function feedUrl(city: CityId): string {
  if (MODE === 'snapshot') return `${BASE}snapshot/${city}.json`;
  return `https://codecollective.us/${city}/upcoming_events.json`;
}

function cacheKey(city: CityId): string {
  return `cc-feed-${city}`;
}

function readSessionCache(city: CityId): RawEvent[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(city));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rows?: unknown };
    return Array.isArray(parsed.rows) ? (parsed.rows as RawEvent[]) : null;
  } catch {
    // Private mode, blocked storage, or corrupt JSON. Not an error worth surfacing.
    return null;
  }
}

function writeSessionCache(city: CityId, rows: RawEvent[]): void {
  try {
    sessionStorage.setItem(cacheKey(city), JSON.stringify({ rows, at: Date.now() }));
  } catch {
    // Over quota on a 2.6 MB feed is normal; the page works without the cache.
  }
}

async function load(city: CityId): Promise<FeedResult> {
  try {
    const res = await fetch(feedUrl(city), { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Feed responded ${res.status}`);
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) throw new Error('Feed was not a JSON array');
    writeSessionCache(city, rows as RawEvent[]);
    return { rows: rows as RawEvent[], fromCache: false, fetchedAt: Date.now() };
  } catch (err) {
    // Fall back to this session's copy before showing the error state.
    const cached = readSessionCache(city);
    if (cached) return { rows: cached, fromCache: true, fetchedAt: Date.now() };
    throw err instanceof Error ? err : new Error('Could not load events');
  }
}

const inFlight = new Map<CityId, Promise<FeedResult>>();

/** The cached promise for a city, created on first read. */
export function eventsPromise(city: CityId): Promise<FeedResult> {
  let p = inFlight.get(city);
  if (!p) {
    p = load(city);
    inFlight.set(city, p);
  }
  return p;
}

/** Drop the cache so "Try again" and the staleness refetch start fresh. */
export function invalidateEvents(city?: CityId): void {
  if (city) inFlight.delete(city);
  else inFlight.clear();
}

/** Age of the resolved payload, for the 30-minute refocus refetch. */
export async function feedAgeMs(city: CityId): Promise<number | null> {
  const p = inFlight.get(city);
  if (!p) return null;
  try {
    const r = await p;
    return Date.now() - r.fetchedAt;
  } catch {
    return null;
  }
}
