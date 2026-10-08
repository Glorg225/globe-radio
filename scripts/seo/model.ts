// Groups the station snapshot into the static SEO pages: one per country and one per city.
import { normalizeName } from '../../src/data/gazetteer';
import { haversineKm } from '../../src/data/geo';
import { isPlaceholder, type Place } from '../../src/data/places';
import type { PlaceInfo, StationLite } from '../../src/data/shards';
import { countrySlugs, eligibleCountries, MIN_STATIONS } from '../../src/seo/country';
import { assignSlugs } from '../../src/seo/slug';

export { MIN_STATIONS };

export interface CityPage { cc: string; name: string; slug: string; lat: number; lon: number; tz: string; stations: StationLite[] }
// placeNames: the country and all its places, lowercased - station tags with these names are not genres.
export interface CountryPage { cc: string; name: string; slug: string; placeNames: string[]; stations: StationLite[]; cities: CityPage[] }
export interface CountryData { stations: StationLite[]; info: Map<string, PlaceInfo> }
export interface CityRef { country: CountryPage; city: CityPage }

// Places with the same English name within 30 km are one city ("Lisbon" the city and "Lisbon" the region);
// a namesake far away (Springfield, Illinois / Springfield, Massachusetts) is a city of its own.
const SAME_CITY_KM = 30;
// A region joins its city's page when it is the city itself ("State of Berlin", "Minsk City", "Zurich" for Zürich):
// the region name without generic words equals the whole city name and the region point is near the city.
// "Oklahoma" stays apart from "Oklahoma City" (the city name keeps "City"), "Kyiv Oblast" too (its point is 78 km away).
const REGION_CITY_KM = 30;
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const km = (a: Place, b: Place) => haversineKm(a.lat, a.lon, b.lat, b.lon);

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function groupByName(places: Place[], size: (p: Place) => number): Place[][] {
  const byName = new Map<string, Place[]>();
  for (const p of places) push(byName, p.name.trim().toLowerCase(), p);
  const groups: Place[][] = [];
  for (const list of byName.values()) {
    const clusters: Place[][] = [];
    for (const p of [...list].sort((a, b) => size(b) - size(a))) {
      const near = clusters.find((c) => c.some((m) => km(m, p) <= SAME_CITY_KM));
      if (near) near.push(p);
      else clusters.push([p]);
    }
    groups.push(...clusters);
  }
  return groups;
}

function mergeCityRegions(groups: Place[][]): Place[][] {
  const cityOf = (g: Place[]) => g.find((p) => p.kind === 'exact');
  const out = groups.filter((g) => cityOf(g));
  for (const group of groups) {
    if (cityOf(group)) continue;
    const region = group[0];
    const key = normalizeName(region.name);
    let target: Place[] | undefined;
    let best = REGION_CITY_KM;
    for (const g of out) {
      const city = cityOf(g);
      if (!city || fold(city.name) !== key) continue;
      const d = km(region, city);
      if (d <= best) { target = g; best = d; }
    }
    if (target) target.push(...group);
    else out.push(group);
  }
  return out;
}

const byClicks = (a: StationLite, b: StationLite) => b.clicks - a.clicks || a.name.localeCompare(b.name);
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'en');

export function buildModel(places: Place[], data: Map<string, CountryData>, countryName: (cc: string) => string): CountryPage[] {
  const placesByCc = new Map<string, Place[]>();
  for (const p of places) if (p.kind !== 'country') push(placesByCc, p.cc, p);

  const countries: CountryPage[] = [];
  for (const [cc, { stations, info }] of data) {
    if (stations.length < MIN_STATIONS) continue;
    const byPlace = new Map<string, StationLite[]>();
    for (const st of stations) push(byPlace, st.placeId, st);
    const size = (p: Place) => byPlace.get(p.id)?.length ?? 0;

    // Stations far from any city sit on placeholder places, often named after the country: no city page.
    const cityPlaces = (placesByCc.get(cc) ?? []).filter((p) => !isPlaceholder(p.id));
    const groups = mergeCityRegions(groupByName(cityPlaces, size));
    const candidates = groups
      .map((group) => {
        // Name and point of the city when the group has one, even if its region has more stations.
        const cities = group.filter((p) => p.kind === 'exact');
        const main = (cities.length ? cities : group).reduce((a, b) => (size(b) > size(a) ? b : a));
        return {
          id: main.id, name: main.name, lat: main.lat, lon: main.lon,
          tz: group.map((p) => info.get(p.id)?.tz ?? '').find(Boolean) ?? '',
          stations: group.flatMap((p) => byPlace.get(p.id) ?? []).sort(byClicks),
        };
      })
      .filter((c) => c.stations.length >= MIN_STATIONS)
      .sort((a, b) => b.stations.length - a.stations.length || byName(a, b));
    const slugs = assignSlugs(candidates, (c) => c.name, (c) => c.id);
    const cities: CityPage[] = candidates
      .map((c) => ({ cc, name: c.name, slug: slugs.get(c)!, lat: c.lat, lon: c.lon, tz: c.tz, stations: c.stations }))
      .sort(byName);

    const name = countryName(cc);
    const placeNames = [...new Set([name, ...(placesByCc.get(cc) ?? []).map((p) => p.name)].map((n) => n.trim().toLowerCase()))];
    countries.push({ cc, name, slug: '', placeNames, stations: [...stations].sort(byClicks), cities });
  }

  // Same slugs as the app's country links: the same list (all countries of the snapshot, even one whose
  // station file is missing) through the same function (src/seo/country.ts).
  const list = eligibleCountries(places, countryName);
  for (const c of countries) if (!list.some((e) => e.cc === c.cc)) list.push({ cc: c.cc, name: c.name, count: c.stations.length });
  const slugs = countrySlugs(list);
  for (const c of countries) c.slug = slugs.get(c.cc)!;
  return countries.sort(byName);
}

export function allCities(countries: CountryPage[]): CityRef[] {
  return countries.flatMap((country) => country.cities.map((city) => ({ country, city })));
}

const RAD = Math.PI / 180;
function distance(a: CityPage, b: CityPage): number {
  const h = Math.sin(((b.lat - a.lat) * RAD) / 2) ** 2
    + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(((b.lon - a.lon) * RAD) / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Nearest city pages (any country) for the "Nearby cities" block.
export function nearbyCities(target: CityRef, all: CityRef[], n = 8): CityRef[] {
  return all
    .filter((r) => r.city !== target.city)
    .map((r) => ({ r, d: distance(target.city, r.city) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map(({ r }) => r);
}
