import type { PlaceKind, PlaceRef } from './types';

export interface Place extends PlaceRef { count: number; pop: number; langs?: Record<string, number> }
export type CompactPlace = [id: string, lat: number, lon: number, kind: 0 | 1 | 2, cc: string, nameRu: string, name: string, count: number, pop: number, langs?: string];
export interface PlacesFile { v: 2; generated: string; places: CompactPlace[] }

// Stations with coordinates far from any known city get a placeholder place "p:<CC>:<lat>,<lon>" named after
// the nearest city within 300 km or the country (see place-match): a spot on the map, not a city.
export const PLACEHOLDER_PREFIX = 'p:';
export const isPlaceholder = (id: string) => id.startsWith(PLACEHOLDER_PREFIX);

const KINDS: PlaceKind[] = ['exact', 'region', 'country'];

export function encodeLangs(m: Record<string, number> | undefined): string {
  return Object.entries(m ?? {}).map(([code, n]) => `${code}:${n}`).join(',');
}

export function decodeLangs(s: string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of (s ?? '').split(',')) {
    const [code, n] = part.split(':');
    const count = Number(n);
    if (code && Number.isInteger(count) && count > 0) out[code] = count;
  }
  return out;
}

export function encodePlace(p: Place): CompactPlace {
  return [p.id, p.lat, p.lon, KINDS.indexOf(p.kind) as 0 | 1 | 2, p.cc, p.nameRu, p.name, p.count, p.pop, encodeLangs(p.langs)];
}

export function decodePlace(c: CompactPlace): Place {
  const [id, lat, lon, kind, cc, nameRu, name, count, pop, langs] = c;
  return { id, lat, lon, kind: KINDS[kind], cc, nameRu, name, count, pop, langs: decodeLangs(langs) };
}

export async function loadPlaces(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<Place[]> {
  const r = await fetchFn(`${baseUrl}data/places.json`);
  if (!r.ok) throw new Error(`places HTTP ${r.status}`);
  const body = (await r.json()) as Partial<PlacesFile>;
  if (body.v !== 2 || !Array.isArray(body.places)) throw new Error('unsupported places format');
  return body.places.map(decodePlace);
}
