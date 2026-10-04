import { normalizeName, type Gazetteer, type GzAdmin1, type GzCity } from './gazetteer';
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
    return best;
  }

  // A country gets a timezone only if all its cities share one (single-zone countries).
  const countryZones = new Map<string, Set<string>>();
  for (const c of gz.cities) if (c.tz) (countryZones.get(c.cc) ?? countryZones.set(c.cc, new Set()).get(c.cc)!).add(c.tz);
  const countryTz = (cc: string) => { const z = countryZones.get(cc); return z && z.size === 1 ? [...z][0] : undefined; };

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
      if (city) return cityRef(city, 'region');
    }
    const c = centroids[s.cc];
    if (!c) return null;
    return { id: `k:${s.cc}`, lat: c[0], lon: c[1], kind: 'country', cc: s.cc, nameRu: countryName(s.cc, 'ru'), name: countryName(s.cc, 'en'), tz: countryTz(s.cc) };
  }

  return { match };
}
