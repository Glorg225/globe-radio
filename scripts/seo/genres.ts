// Style pages of the static SEO site: /radio/genre/<style>/ and /radio/genre/<style>/<country>/.
import { GENRES, genreOfTag, stationGenres, type Genre } from '../../src/data/genres';
import type { StationLite } from '../../src/data/shards';
import type { CountryPage } from './model';

// A style gets a world page from this many stations, a style in a country from GENRE_MIN_COUNTRY.
export const GENRE_MIN_WORLD = 10;
// 10, not 3: a style in a country with fewer stations makes a thin page (601 pages instead of 1,317, 87 % of the stations).
export const GENRE_MIN_COUNTRY = 10;
// "Popular styles here" lists a style from this many stations of the place.
export const STYLE_MIN_HERE = 2;

export interface GenreCountry { country: CountryPage; stations: StationLite[] }
export interface GenrePage { genre: Genre; stations: StationLite[]; countries: GenreCountry[] }
export interface StyleHere { genre: Genre; count: number; countryPage: boolean }

const byClicks = (a: StationLite, b: StationLite) => b.clicks - a.clicks || a.name.localeCompare(b.name);
const cache = new WeakMap<StationLite, string[]>();
function stylesOfStation(s: StationLite): string[] {
  let ids = cache.get(s);
  if (!ids) {
    ids = stationGenres(s.tags);
    cache.set(s, ids);
  }
  return ids;
}

export const hasCountryPage = (gc: GenreCountry) => gc.stations.length >= GENRE_MIN_COUNTRY;

export function buildGenres(countries: CountryPage[]): GenrePage[] {
  const byGenre = new Map<string, Map<CountryPage, StationLite[]>>();
  for (const country of countries) {
    for (const s of country.stations) {
      for (const id of stylesOfStation(s)) {
        let perCountry = byGenre.get(id);
        if (!perCountry) byGenre.set(id, (perCountry = new Map()));
        const list = perCountry.get(country);
        if (list) list.push(s);
        else perCountry.set(country, [s]);
      }
    }
  }
  const pages: GenrePage[] = [];
  for (const genre of GENRES) {
    const perCountry = byGenre.get(genre.id);
    if (!perCountry) continue;
    const gcs = [...perCountry].map(([country, stations]) => ({ country, stations: stations.sort(byClicks) }));
    const stations = gcs.flatMap((c) => c.stations).sort(byClicks);
    if (stations.length < GENRE_MIN_WORLD) continue;
    gcs.sort((a, b) => b.stations.length - a.stations.length || a.country.name.localeCompare(b.country.name, 'en'));
    pages.push({ genre, stations, countries: gcs });
  }
  return pages;
}

// Build-log report: how many stations got a style, and the frequent tags that matched none (bitrates skipped).
export function genreCoverage(stations: StationLite[], n = 20): { total: number; matched: number; unmatched: [string, number][] } {
  let matched = 0;
  const unknown = new Map<string, number>();
  const known = new Map<string, boolean>();
  for (const s of stations) {
    if (stylesOfStation(s).length) matched++;
    for (const raw of new Set(s.tags.map((t) => t.trim().toLowerCase()))) {
      if (!raw || /\d/.test(raw)) continue;
      let hasStyle = known.get(raw);
      if (hasStyle === undefined) known.set(raw, (hasStyle = !!genreOfTag(raw)));
      if (hasStyle) continue;
      unknown.set(raw, (unknown.get(raw) ?? 0) + 1);
    }
  }
  const unmatched = [...unknown].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
  return { total: stations.length, matched, unmatched };
}

// How many of the stations have each style (one count per station and style).
export function countStyles(stations: StationLite[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of stations) for (const id of stylesOfStation(s)) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

// "Popular styles here" on a country or city page: styles with a world page, most frequent first.
export function stylesOf(stations: StationLite[], pages: GenrePage[], country: CountryPage, n = 8): StyleHere[] {
  const counts = countStyles(stations);
  const out: StyleHere[] = [];
  for (const page of pages) {
    const count = counts.get(page.genre.id) ?? 0;
    if (count < STYLE_MIN_HERE) continue;
    const here = page.countries.find((c) => c.country === country);
    out.push({ genre: page.genre, count, countryPage: !!here && hasCountryPage(here) });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, n);
}
