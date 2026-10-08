import type { PlaceKind, PlaceRef } from './types';

// styles: up to 3 most frequent station styles (ids from src/data/genres.ts), for the map tooltip.
export interface Place extends PlaceRef { count: number; pop: number; langs?: Record<string, number>; styles?: string[] }
// tz: index into PlacesFile.tzs (-1: unknown); styles: one character per style, its index in PlacesFile.styles
// (the file carries its own style table, so a later change of the dictionary cannot shift old files).
// Both optional (older files lack them) and kept only for places with TOOLTIP_MIN stations: +5 % to the file, not +15 %.
export type CompactPlace = [id: string, lat: number, lon: number, kind: 0 | 1 | 2, cc: string, nameRu: string, name: string, count: number, pop: number, langs?: string, tz?: number, styles?: string];
export interface PlacesFile { v: 2; generated: string; places: CompactPlace[]; tzs?: string[]; styles?: string[] }

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

export const TOOLTIP_MIN = 3;
// One character per style in the file's table: up to 62 distinct styles (the dictionary has 44).
export const STYLE_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function encodePlace(p: Place, tzIndex?: Map<string, number>, styleIndex?: Map<string, number>): CompactPlace {
  const row: CompactPlace = [p.id, p.lat, p.lon, KINDS.indexOf(p.kind) as 0 | 1 | 2, p.cc, p.nameRu, p.name, p.count, p.pop, encodeLangs(p.langs)];
  if (!tzIndex || p.count < TOOLTIP_MIN) return row;
  const styles = (p.styles ?? []).map((id) => STYLE_ALPHABET[styleIndex?.get(id) ?? -1] ?? '').join('');
  row.push(p.tz ? tzIndex.get(p.tz) ?? -1 : -1);
  if (styles) row.push(styles);
  return row;
}

// Time zones repeat across thousands of places (about 320 distinct): stored once, places keep an index.
export function encodePlacesFile(places: Place[], generated: string): PlacesFile {
  const tzs = [...new Set(places.filter((p) => p.count >= TOOLTIP_MIN).map((p) => p.tz).filter((tz): tz is string => !!tz))].sort();
  const tzIndex = new Map(tzs.map((tz, i) => [tz, i]));
  const styles = [...new Set(places.filter((p) => p.count >= TOOLTIP_MIN).flatMap((p) => p.styles ?? []))].sort();
  if (styles.length > STYLE_ALPHABET.length) throw new Error(`too many styles for one-character codes: ${styles.length}`);
  const styleIndex = new Map(styles.map((id, i) => [id, i]));
  return { v: 2, generated, places: places.map((p) => encodePlace(p, tzIndex, styleIndex)), tzs, styles };
}

export function decodePlace(c: CompactPlace, tzs: string[] = [], styleTable: string[] = []): Place {
  const [id, lat, lon, kind, cc, nameRu, name, count, pop, langs, tz, styles] = c;
  const place: Place = { id, lat, lon, kind: KINDS[kind], cc, nameRu, name, count, pop, langs: decodeLangs(langs) };
  if (tz !== undefined && tz >= 0 && tzs[tz]) place.tz = tzs[tz];
  if (styles) place.styles = [...styles].map((ch) => styleTable[STYLE_ALPHABET.indexOf(ch)]).filter((id): id is string => !!id);
  return place;
}

export async function loadPlaces(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<Place[]> {
  const r = await fetchFn(`${baseUrl}data/places.json`);
  if (!r.ok) throw new Error(`places HTTP ${r.status}`);
  const body = (await r.json()) as Partial<PlacesFile>;
  if (body.v !== 2 || !Array.isArray(body.places)) throw new Error('unsupported places format');
  return body.places.map((c) => decodePlace(c, body.tzs, body.styles));
}
