import { MIRRORS } from '../data/mirrors';
import type { Place } from '../data/places';
import type { ShardStore, StationLite } from '../data/shards';

const ID_RE = /^[0-9a-f-]{36}$/i;

export function buildShareUrl(pageUrl: string, s: Pick<StationLite, 'id' | 'cc'>): string {
  const u = new URL(pageUrl);
  u.search = '';
  u.hash = '';
  u.searchParams.set('station', s.id);
  u.searchParams.set('c', s.cc);
  return u.toString();
}

export function parseShareParams(search: string): { id: string; cc: string | null } | null {
  const p = new URLSearchParams(search);
  const id = p.get('station') ?? '';
  if (!ID_RE.test(id)) return null;
  const cc = (p.get('c') ?? '').toUpperCase();
  return { id: id.toLowerCase(), cc: /^[A-Z]{2}$/.test(cc) ? cc : null };
}

export function stripShareParams(url: string): string {
  const u = new URL(url);
  u.searchParams.delete('station');
  u.searchParams.delete('c');
  return u.toString();
}

async function countryOf(id: string, fetchFn: typeof fetch, mirrors: readonly string[]): Promise<string | null> {
  for (const host of mirrors) {
    try {
      const r = await fetchFn(`https://${host}/json/stations/byuuid/${id}`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) continue;
      const list = (await r.json()) as { countrycode?: string }[];
      const cc = (list[0]?.countrycode ?? '').toUpperCase();
      return /^[A-Z]{2}$/.test(cc) ? cc : null;
    } catch { /* next mirror */ }
  }
  return null;
}

export async function resolveShared(
  p: { id: string; cc: string | null },
  d: { places: Place[]; shards: ShardStore; fetchFn?: typeof fetch; mirrors?: readonly string[] },
): Promise<{ station: StationLite; place: Place } | null> {
  const cc = p.cc ?? await countryOf(p.id, d.fetchFn ?? fetch, d.mirrors ?? MIRRORS);
  if (!cc) return null;
  try {
    const station = (await d.shards.get(cc)).find((s) => s.id === p.id);
    const place = station && d.places.find((pl) => pl.id === station.placeId);
    return station && place ? { station, place } : null;
  } catch {
    return null;
  }
}
