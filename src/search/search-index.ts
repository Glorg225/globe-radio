import { countryName } from '../data/place-name';
import type { Place } from '../data/places';

export interface SearchFile { v: 1; stations: [string, string][] }
export interface SearchHit { name: string; place: Place }
export interface SearchResult { places: Place[]; stations: SearchHit[] }

const MAX_PLACES = 5;
const MAX_STATIONS = 8;
const EMPTY: SearchResult = { places: [], stations: [] };

export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// 0 — the text starts with the query, 1 — a word starts with it, 2 — it occurs inside, -1 — no match.
function score(text: string, q: string): number {
  const i = text.indexOf(q);
  if (i < 0) return -1;
  if (i === 0) return 0;
  return /[\s\-(«"'.,/]/.test(text[i - 1]) ? 1 : 2;
}

export function createSearchIndex(baseUrl: string, places: Place[], locale: string, fetchFn: typeof fetch = fetch) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const placeNames = places.map((p) => ({
    p,
    names: (p.kind === 'country' ? [countryName(p.cc, locale), p.name, p.nameRu] : [p.nameRu, p.name]).filter(Boolean).map(normalizeText),
  }));
  let rows: Promise<{ name: string; norm: string; place: Place }[]> | null = null;

  async function load() {
    const r = await fetchFn(`${baseUrl}data/search.json`);
    if (!r.ok) throw new Error(`search HTTP ${r.status}`);
    const body = (await r.json()) as Partial<SearchFile>;
    if (body.v !== 1 || !Array.isArray(body.stations)) throw new Error('unsupported search format');
    return body.stations
      .map(([name, placeId]) => ({ name, norm: normalizeText(name), place: byId.get(placeId)! }))
      .filter((r) => r.place);
  }

  return {
    async search(query: string): Promise<SearchResult> {
      const q = normalizeText(query.trim());
      if (q.length < 2) return EMPTY;
      if (!rows) {
        rows = load();
        rows.catch(() => { rows = null; });
      }
      const list = await rows;
      const foundPlaces = placeNames
        .map(({ p, names }) => ({ p, s: Math.min(...names.map((n) => { const v = score(n, q); return v < 0 ? 9 : v; })) }))
        .filter((x) => x.s < 9)
        .sort((a, b) => a.s - b.s || b.p.count - a.p.count)
        .slice(0, MAX_PLACES)
        .map((x) => x.p);
      const buckets: SearchHit[][] = [[], [], []];
      for (const r of list) {
        const s = score(r.norm, q);
        if (s >= 0 && buckets[s].length < MAX_STATIONS) buckets[s].push({ name: r.name, place: r.place });
        if (buckets[0].length >= MAX_STATIONS) break;
      }
      return { places: foundPlaces, stations: buckets.flat().slice(0, MAX_STATIONS) };
    },
  };
}
