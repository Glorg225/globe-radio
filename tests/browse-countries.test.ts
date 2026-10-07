import { expect, test } from 'vitest';
import en from '../locales/en.json';
import type { Place } from '../src/data/places';
import { createI18n } from '../src/i18n/i18n';
import { seoCountryName, topCountries } from '../src/seo/country';
import { renderBrowseCountries } from '../src/ui/browse-countries';

const place = (id: string, cc: string, count: number, o: Partial<Place> = {}): Place =>
  ({ id, lat: 0, lon: 0, kind: 'exact', cc, nameRu: '', name: id, count, pop: 0, ...o });

test('topCountries: stations summed per country, at least 3, biggest first, at most n', () => {
  const places = [
    place('c:1', 'PT', 2), place('c:2', 'PT', 1), place('k:PT', 'PT', 4, { kind: 'country' }),
    place('c:3', 'US', 50), place('c:4', 'DE', 9), place('c:5', 'ES', 2),
  ];
  expect(topCountries(places, 2)).toEqual([
    { cc: 'US', name: 'United States', path: 'radio/united-states/', count: 50 },
    { cc: 'DE', name: 'Germany', path: 'radio/germany/', count: 9 },
  ]);
  expect(topCountries(places).map((c) => c.cc)).toEqual(['US', 'DE', 'PT']);
});

test('seoCountryName: English name, falls back to the snapshot name for unknown codes', () => {
  expect(seoCountryName('PT')).toBe('Portugal');
  expect(seoCountryName('XK')).not.toBe('XK');
  expect(seoCountryName('AA', 'Atlantis')).toBe('Atlantis');
  expect(seoCountryName('AA')).toBe('AA');
});

test('renderBrowseCountries: country links and a link to all countries', () => {
  const el = renderBrowseCountries(createI18n('en', en), [{ cc: 'PT', name: 'Portugal', path: 'radio/portugal/', count: 3 }]);
  expect(el.querySelector('.section-label')!.textContent).toBe('Browse by country');
  const links = [...el.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]);
  expect(links).toEqual([['Portugal', 'radio/portugal/'], ['All countries →', 'radio/']]);
});
