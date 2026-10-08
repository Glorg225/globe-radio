import { expect, test } from 'vitest';
import type { StationLite } from '../src/data/shards';
import type { CountryPage } from '../scripts/seo/model';
import { buildGenres, GENRE_MIN_WORLD, genreCoverage, hasCountryPage, stylesOf } from '../scripts/seo/genres';

let n = 0;
const st = (cc: string, tags: string[], clicks = 0): StationLite => ({
  id: `s${n++}`, name: `S${n}`, url: '', placeId: 'c:1', cc, langs: [], tags, votes: 0, clicks, favicon: '', hls: false,
});
const country = (cc: string, name: string, stations: StationLite[]): CountryPage =>
  ({ cc, name, slug: name.toLowerCase(), stations, cities: [] });

function fixture() {
  const de = country('DE', 'Germany', [...Array.from({ length: 10 }, (_, i) => st('DE', ['Jazz'], i)), st('DE', ['news'])]);
  const fr = country('FR', 'France', [...Array.from({ length: 2 }, () => st('FR', ['smooth jazz'])), st('FR', ['news', 'jazz'], 99)]);
  const us = country('US', 'United States', [st('US', ['jazz', '80s']), st('US', ['music'])]);
  return { de, fr, us, pages: buildGenres([de, fr, us]) };
}

test(`a style gets a world page with at least ${GENRE_MIN_WORLD} stations`, () => {
  const { pages } = fixture();
  expect(pages.map((p) => p.genre.id)).toEqual(['jazz']);
  const jazz = pages[0];
  expect(jazz.stations).toHaveLength(14);
  expect(jazz.stations[0].clicks).toBe(99);
});

test('countries of a style: biggest first; a country page from 10 stations of the style', () => {
  const { pages } = fixture();
  const countries = pages[0].countries;
  expect(countries.map((c) => [c.country.cc, c.stations.length, hasCountryPage(c)])).toEqual([
    ['DE', 10, true], ['FR', 3, false], ['US', 1, false],
  ]);
});

test('genreCoverage: share of stations with a style and frequent unknown tags without digits', () => {
  const stations = [st('DE', ['jazz', 'webradio']), st('DE', ['webradio', '128kbps']), st('DE', ['Webradio', 'américa']), st('DE', [])];
  const c = genreCoverage(stations);
  expect(c).toMatchObject({ total: 4, matched: 1 });
  expect(c.unmatched).toEqual([['webradio', 3], ['américa', 1]]);
});

test('stylesOf: most frequent styles of a place that have a world page, from 2 stations, with the country page when it exists', () => {
  const { de, fr, pages } = fixture();
  expect(stylesOf(de.stations, pages, de).map((s) => [s.genre.id, s.count, s.countryPage])).toEqual([['jazz', 10, true]]);
  expect(stylesOf(fr.stations, pages, fr).map((s) => [s.genre.id, s.countryPage])).toEqual([['jazz', false]]);
  const one = stylesOf([fr.stations[2]], pages, fr);
  expect(one).toEqual([]);
});
