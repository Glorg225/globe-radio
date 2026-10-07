// Groups the station snapshot into the static SEO pages: one per country and one per city.
import type { Place } from '../../src/data/places';
import type { PlaceInfo, StationLite } from '../../src/data/shards';
import { MIN_STATIONS } from '../../src/seo/country';
import { assignSlugs } from '../../src/seo/slug';

export { MIN_STATIONS };

export interface CityPage { cc: string; name: string; slug: string; lat: number; lon: number; tz: string; stations: StationLite[] }
// placeNames: the country and all its places, lowercased - station tags with these names are not genres.
export interface CountryPage { cc: string; name: string; slug: string; placeNames: string[]; stations: StationLite[]; cities: CityPage[] }
export interface CountryData { stations: StationLite[]; info: Map<string, PlaceInfo> }
export interface CityRef { country: CountryPage; city: CityPage }

const byClicks = (a: StationLite, b: StationLite) => b.clicks - a.clicks || a.name.localeCompare(b.name);
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'en');

export function buildModel(places: Place[], data: Map<string, CountryData>, countryName: (cc: string) => string): CountryPage[] {
  const placesByCc = new Map<string, Place[]>();
  for (const p of places) {
    if (p.kind === 'country') continue;
    const list = placesByCc.get(p.cc) ?? [];
    list.push(p);
    placesByCc.set(p.cc, list);
  }

  const countries: CountryPage[] = [];
  for (const [cc, { stations, info }] of data) {
    if (stations.length < MIN_STATIONS) continue;
    const byPlace = new Map<string, StationLite[]>();
    for (const s of stations) byPlace.set(s.placeId, [...(byPlace.get(s.placeId) ?? []), s]);
    const size = (p: Place) => byPlace.get(p.id)?.length ?? 0;

    // A city and a region with the same English name ("Lisbon") are one page.
    const groups = new Map<string, Place[]>();
    for (const p of placesByCc.get(cc) ?? []) {
      const key = p.name.trim().toLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    const candidates = [...groups.values()]
      .map((group) => {
        const main = group.reduce((a, b) => (size(b) > size(a) ? b : a));
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

  const bySize = [...countries].sort((a, b) => b.stations.length - a.stations.length);
  const slugs = assignSlugs(bySize, (c) => c.name, (c) => c.cc);
  for (const c of countries) c.slug = slugs.get(c)!;
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
