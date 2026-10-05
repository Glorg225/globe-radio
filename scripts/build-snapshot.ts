import type { Place } from '../src/data/places';
import type { PlaceInfoRow, StationLite } from '../src/data/shards';
import { dedupe, toStation } from '../src/data/stations';
import type { Centroids, PlaceKind, PlaceRef, RawStation, Station } from '../src/data/types';

export interface SnapshotReport {
  stations: number; places: number; countries: number; languages: number;
  byKind: Record<PlaceKind, number>; httpInOutput: number;
  unknownRegions: [string, number][]; unknownLanguages: [string, number][];
}

const RANK: Record<PlaceKind, number> = { exact: 0, region: 1, country: 2 };
const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 30);
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

// A region is centred on its biggest city, so it can share that city's exact point; identical points
// never split on the map. Keep the most precise place in place and spread the others ~10 km around it.
const NUDGE_DEG = 0.09;
function separateColocated(list: Place[]) {
  const groups = new Map<string, Place[]>();
  for (const p of list) {
    const k = `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(p);
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.id.localeCompare(b.id));
    const cos = Math.max(0.2, Math.cos((g[0].lat * Math.PI) / 180));
    g.slice(1).forEach((p, i) => {
      const angle = i * 2.4;
      p.lat = Math.round((p.lat + NUDGE_DEG * Math.sin(angle)) * 1e4) / 1e4;
      p.lon = Math.round((p.lon + (NUDGE_DEG * Math.cos(angle)) / cos) * 1e4) / 1e4;
    });
  }
}

export function buildSnapshot(raw: RawStation[], centroids: Centroids, matcher: { match(s: Station): PlaceRef | null }) {
  const places = new Map<string, Place>();
  const shards = new Map<string, StationLite[]>();
  const byKind: Record<PlaceKind, number> = { exact: 0, region: 0, country: 0 };
  const unknownRegions = new Map<string, number>();
  const unknownLanguages = new Map<string, number>();
  const rawById = new Map(raw.map((r) => [r.stationuuid, r]));
  let count = 0;

  const stations = dedupe(raw.map((r) => toStation(r, centroids)).filter((s): s is Station => s !== null));
  for (const s of stations) {
    if (!/^[A-Z]{2}$/.test(s.cc)) continue;
    const ref = matcher.match(s);
    if (!ref) continue;
    count++;
    byKind[ref.kind]++;
    if (ref.kind === 'country' && s.state) bump(unknownRegions, `${s.cc.toLowerCase()}|${s.state.toLowerCase()}`);
    const lang = rawById.get(s.id)?.language ?? '';
    if (lang && s.langs.length === 0) {
      for (const n of lang.split(',')) { const k = n.trim().toLowerCase(); if (k) bump(unknownLanguages, k); }
    }

    const place = places.get(ref.id) ?? places.set(ref.id, { ...ref, count: 0, pop: 0 }).get(ref.id)!;
    place.count++;
    place.pop += s.clicks;
    place.langs ??= {};
    for (const l of s.langs) place.langs[l] = (place.langs[l] ?? 0) + 1;
    if (RANK[ref.kind] < RANK[place.kind]) place.kind = ref.kind;

    const lite: StationLite = {
      id: s.id, name: s.name, url: s.url, placeId: ref.id, cc: s.cc, langs: s.langs, tags: s.tags,
      votes: s.votes, clicks: s.clicks, favicon: s.favicon, hls: s.hls,
    };
    (shards.get(s.cc) ?? shards.set(s.cc, []).get(s.cc)!).push(lite);
  }
  for (const list of shards.values()) list.sort((a, b) => b.clicks - a.clicks);
  separateColocated([...places.values()]);

  const all = [...shards.values()].flat();
  const report: SnapshotReport = {
    stations: count,
    places: places.size,
    countries: shards.size,
    languages: new Set(all.flatMap((s) => s.langs)).size,
    byKind,
    httpInOutput: all.filter((s) => !s.url.startsWith('https://')).length,
    unknownRegions: top(unknownRegions),
    unknownLanguages: top(unknownLanguages),
  };
  return { places: [...places.values()], shards, report };
}

export function placeInfoRows(places: Place[], cc: string): PlaceInfoRow[] {
  return places
    .filter((p) => p.cc === cc)
    .map((p): PlaceInfoRow => (p.kind === 'country'
      ? [p.id, p.tz ?? '', p.wikiRu || p.nameRu, p.wikiEn || p.name]
      : [p.id, p.tz ?? '', p.wikiRu ?? '', p.wikiEn ?? '']));
}

export function searchRows(shards: Map<string, StationLite[]>): [string, string][] {
  return [...shards.values()].flat().sort((a, b) => b.clicks - a.clicks).map((s) => [s.name, s.placeId]);
}
