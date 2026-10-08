import { expect, test } from 'vitest';
import en from '../locales/en.json';
import type { Place } from '../src/data/places';
import { countryName, officialCountryName } from '../src/data/place-name';
import { createI18n } from '../src/i18n/i18n';
import { countryInSentence } from '../scripts/seo/text';
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

test('seoCountryName ignores the CLDR "unknown region" code', () => {
  expect(seoCountryName('ZZ', 'Atlantis')).toBe('Atlantis');
  expect(seoCountryName('ZZ')).toBe('ZZ');
});

test('countries whose names collide get distinct slugs, the bigger keeps the plain one', () => {
  const places = [place('c:1', 'AA', 3, { kind: 'country', name: 'Atlantis' }), place('c:2', 'AB', 5, { kind: 'country', name: 'Atlantis' })];
  expect(topCountries(places).map((c) => c.path)).toEqual(['radio/atlantis/', 'radio/atlantis-aa/']);
});

test('country names without officialese', () => {
  const cases: Record<string, string> = {
    HK: 'Hong Kong', MO: 'Macao', CD: 'DR Congo', CG: 'Republic of the Congo', MM: 'Myanmar', PS: 'Palestine',
    BA: 'Bosnia and Herzegovina', TT: 'Trinidad and Tobago', LC: 'Saint Lucia', KN: 'Saint Kitts and Nevis',
    VC: 'Saint Vincent and the Grenadines', CC: 'Cocos Islands', US: 'United States', GW: 'Guinea-Bissau', CI: 'Côte d’Ivoire',
  };
  for (const [cc, name] of Object.entries(cases)) expect(seoCountryName(cc), cc).toBe(name);
  expect(topCountries([place('k:HK', 'HK', 5, { kind: 'country' })])[0].path).toBe('radio/hong-kong/');
});

test('the app shows the same everyday English names; Russian names are untouched', () => {
  expect(countryName('HK', 'en')).toBe('Hong Kong');
  expect(countryName('CD', 'en')).toBe('DR Congo');
  expect(countryName('HK', 'ru')).toBe(new Intl.DisplayNames(['ru'], { type: 'region' }).of('HK'));
  expect(officialCountryName('HK')).toBe('Hong Kong SAR China');
});

test('no country name starts with "The", so a sentence never reads "the The ..."', () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const a of letters) for (const b of letters) {
    const name = seoCountryName(a + b);
    expect(name, a + b).not.toMatch(/^the /i);
    expect(countryInSentence(name), a + b).not.toMatch(/^the the /i);
  }
});

test('renderBrowseCountries: under the style buttons a link to all styles, as under the countries', () => {
  const el = renderBrowseCountries(createI18n('en', en), [{ cc: 'PT', name: 'Portugal', path: 'radio/portugal/', count: 3 }],
    { ids: [{ id: 'jazz', name: 'Jazz' }], onPick: () => {} });
  const last = el.lastElementChild as HTMLAnchorElement;
  expect([last.className, last.textContent, last.getAttribute('href')]).toEqual(['browse__all', 'All styles →', 'radio/genre/']);
});
