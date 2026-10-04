import type { Place } from '../src/data/places';
import type { StationLite } from '../src/data/shards';
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
    if (RANK[ref.kind] < RANK[place.kind]) place.kind = ref.kind;

    const lite: StationLite = {
      id: s.id, name: s.name, url: s.url, placeId: ref.id, cc: s.cc, langs: s.langs, tags: s.tags,
      votes: s.votes, clicks: s.clicks, favicon: s.favicon, hls: s.hls,
    };
    (shards.get(s.cc) ?? shards.set(s.cc, []).get(s.cc)!).push(lite);
  }
  for (const list of shards.values()) list.sort((a, b) => b.clicks - a.clicks);

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
