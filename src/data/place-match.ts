import { normalizeName, type Gazetteer, type GzAdmin1, type GzCity } from './gazetteer';
import { offsetMinutes } from '../place-card/time';
import { haversineKm } from './geo';
import type { Centroids, PlaceKind, PlaceRef, Station } from './types';

const SNAP_KM = 30;
const NAME_KM = 300;

export function createPlaceMatcher(gz: Gazetteer, centroids: Centroids, countryName: (cc: string, locale: 'ru' | 'en') => string) {
  const grid = new Map<string, GzCity[]>();
  const cityByAlias = new Map<string, GzCity>();
  const admin1ByAlias = new Map<string, GzAdmin1>();
  const admin1Center = new Map<string, GzCity>();
  const cell = (lat: number, lon: number) => `${Math.floor(lat)}:${Math.floor(lon)}`;
  // A city district (Mitte) stands for its city (Berlin): see linkDistricts in scripts/build-gazetteer.ts.
  const cityById = new Map(gz.cities.map((c) => [c.id, c]));
  const resolve = (c: GzCity): GzCity => (c.parent && cityById.get(c.parent)) || c;

  for (const c of gz.cities) {
    const k = cell(c.lat, c.lon);
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(c);
    for (const a of c.aliases) {
      const key = `${c.cc}|${a}`;
      const prev = cityByAlias.get(key);
      if (!prev || prev.pop < c.pop) cityByAlias.set(key, c);
    }
    const ak = `${c.cc}.${c.admin1}`;
    const center = admin1Center.get(ak);
    if (!center || center.pop < c.pop) admin1Center.set(ak, c);
  }
  // Several regions can share an alias ("Moscow" is the city region RU.48 and a translation of RU.47).
  // Prefer the region whose own name is exactly the alias, then one whose name normalises to it, then the first seen.
  const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const aliasScore = new Map<string, number>();
  for (const a of gz.admin1) {
    const exact = [plain(a.name), plain(a.nameRu)];
    const norm = [normalizeName(a.name), normalizeName(a.nameRu)];
    for (const alias of a.aliases) {
      const key = `${a.cc}|${alias}`;
      const score = exact.includes(alias) ? 2 : norm.includes(alias) ? 1 : 0;
      if (!admin1ByAlias.has(key) || score > aliasScore.get(key)!) {
        admin1ByAlias.set(key, a);
        aliasScore.set(key, score);
      }
    }
  }

  // Only cities of the station's own country: the client loads a place's stations from that country's file.
  function nearestCity(lat: number, lon: number, maxKm: number, cc: string): GzCity | null {
    const reach = Math.ceil(maxKm / 100) + 1;
    let best: GzCity | null = null;
    let bestKm = maxKm;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const lonCell = ((((Math.floor(lon) + dx + 180) % 360) + 360) % 360) - 180;
        for (const c of grid.get(`${Math.floor(lat) + dy}:${lonCell}`) ?? []) {
          if (c.cc !== cc) continue;
          const km = haversineKm(lat, lon, c.lat, c.lon);
          if (km <= bestKm) { best = c; bestKm = km; }
        }
      }
    }
    return best && resolve(best);
  }

  // A country gets a timezone only if all its cities share one (single-zone countries).
  // Zones with different names but the same clock all year (e.g. Argentina's provinces) count as one.
  const countryZones = new Map<string, Map<string, number>>();
  for (const c of gz.cities) {
    if (!c.tz) continue;
    const z = countryZones.get(c.cc) ?? countryZones.set(c.cc, new Map()).get(c.cc)!;
    z.set(c.tz, (z.get(c.tz) ?? 0) + 1);
  }
  const year = new Date().getUTCFullYear();
  const probes = [new Date(Date.UTC(year, 0, 15)), new Date(Date.UTC(year, 6, 15))];
  const clock = (tz: string) => { try { return probes.map((d) => offsetMinutes(tz, d)).join('/'); } catch { return tz; } };
  const countryTzCache = new Map<string, string | undefined>();
  const countryTz = (cc: string) => {
    if (countryTzCache.has(cc)) return countryTzCache.get(cc);
    const z = countryZones.get(cc);
    let tz: string | undefined;
    if (z && z.size > 0 && new Set([...z.keys()].map(clock)).size === 1) tz = [...z].sort((x, y) => y[1] - x[1])[0][0];
    countryTzCache.set(cc, tz);
    return tz;
  };
  const countryWiki = new Map((gz.countries ?? []).map((c) => [c.cc, c]));

  // "London, England", "Moscow (Russia)", "Athens Greece", "New York NY" -> also try without the tail.
  function keyVariants(state: string, cc: string): string[] {
    const out: string[] = [];
    const add = (raw: string) => { const k = normalizeName(raw); if (k && !out.includes(k)) out.push(k); };
    add(state);
    add(state.split(/[,(]/)[0]);
    const words = normalizeName(state).split(' ');
    const last = words[words.length - 1];
    const country = [normalizeName(countryName(cc, 'en') ?? ''), normalizeName(countryName(cc, 'ru') ?? '')];
    if (words.length > 1 && (last.length === 2 || country.includes(last))) add(words.slice(0, -1).join(' '));
    return out;
  }

  const cityRef = (c: GzCity, kind: PlaceKind): PlaceRef =>
    ({ id: `c:${c.id}`, lat: c.lat, lon: c.lon, kind, cc: c.cc, nameRu: c.nameRu, name: c.name, tz: c.tz, wikiRu: c.wikiRu, wikiEn: c.wikiEn });

  function match(s: Station): PlaceRef | null {
    if (!s.approx) {
      const near = nearestCity(s.lat, s.lon, SNAP_KM, s.cc);
      if (near) return cityRef(near, 'exact');
      const named = nearestCity(s.lat, s.lon, NAME_KM, s.cc);
      return {
        id: `p:${s.cc}:${s.lat.toFixed(2)},${s.lon.toFixed(2)}`, lat: s.lat, lon: s.lon, kind: 'exact', cc: s.cc,
        nameRu: named?.nameRu ?? countryName(s.cc, 'ru'), name: named?.name ?? countryName(s.cc, 'en'),
        tz: named?.tz || countryTz(s.cc), wikiRu: named?.wikiRu, wikiEn: named?.wikiEn,
      };
    }
    const keys = keyVariants(s.state, s.cc);
    for (const key of keys) {
      const a = admin1ByAlias.get(`${s.cc}|${key}`);
      const center = a && admin1Center.get(`${s.cc}.${a.code}`);
      if (a && center) {
        return { id: `a:${s.cc}.${a.code}`, lat: center.lat, lon: center.lon, kind: 'region', cc: s.cc, nameRu: a.nameRu, name: a.name, tz: center.tz, wikiRu: a.wikiRu, wikiEn: a.wikiEn };
      }
    }
    for (const key of keys) {
      const city = cityByAlias.get(`${s.cc}|${key}`);
      if (city) return cityRef(resolve(city), 'region');
    }
    const c = centroids[s.cc];
    if (!c) return null;
    return { id: `k:${s.cc}`, lat: c[0], lon: c[1], kind: 'country', cc: s.cc, nameRu: countryName(s.cc, 'ru'), name: countryName(s.cc, 'en'), tz: countryTz(s.cc),
      wikiRu: countryWiki.get(s.cc)?.wikiRu || undefined, wikiEn: countryWiki.get(s.cc)?.wikiEn || undefined };
  }

  return { match };
}
