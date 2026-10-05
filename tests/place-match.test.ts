import { expect, test } from 'vitest';
import { haversineKm } from '../src/data/geo';
import { createPlaceMatcher } from '../src/data/place-match';
import type { Gazetteer } from '../src/data/gazetteer';
import type { Station } from '../src/data/types';

const gz: Gazetteer = {
  cities: [
    { id: 1, nameRu: 'Мюнхен', name: 'Munich', lat: 48.137, lon: 11.575, cc: 'DE', admin1: '02', pop: 1_260_000, aliases: ['munich', 'munchen', 'мюнхен'] },
    { id: 2, nameRu: 'Нюрнберг', name: 'Nuremberg', lat: 49.45, lon: 11.08, cc: 'DE', admin1: '02', pop: 500_000, aliases: ['nuremberg'] },
    { id: 3, nameRu: 'Москва', name: 'Moscow', lat: 55.75, lon: 37.62, cc: 'RU', admin1: '48', pop: 10_000_000, aliases: ['moscow', 'москва'] },
    { id: 4, nameRu: 'Париж', name: 'Paris', lat: 48.85, lon: 2.35, cc: 'FR', admin1: '11', pop: 2_100_000, aliases: ['paris'] },
    { id: 5, nameRu: '', name: 'Krasnogorsk', lat: 55.82, lon: 37.33, cc: 'RU', admin1: '47', pop: 170_000, aliases: ['krasnogorsk'] },
  ],
  admin1: [
    { cc: 'DE', code: '02', nameRu: 'Бавария', name: 'Bavaria', aliases: ['bavaria', 'bayern', 'бавария'] },
    { cc: 'FR', code: '11', nameRu: 'Иль-де-Франс', name: 'Île-de-France', aliases: ['ile de france'] },
    { cc: 'RU', code: '47', nameRu: 'Московская область', name: 'Moscow Oblast', aliases: ['moscow', 'московская'] },
    { cc: 'DE', code: '99', nameRu: '', name: 'Empty Land', aliases: ['empty land'] },
  ],
};
const centroids = { DE: [51, 9] as [number, number], RU: [60, 100] as [number, number], FR: [46, 2] as [number, number] };
const names: Record<string, Record<string, string>> = { ru: { DE: 'Германия', RU: 'Россия', FR: 'Франция' }, en: { DE: 'Germany', RU: 'Russia', FR: 'France' } };
const m = createPlaceMatcher(gz, centroids, (cc, l) => names[l][cc]);

const st = (o: Partial<Station>): Station => ({
  id: 'x', name: 'S', url: 'https://s', lat: 0, lon: 0, approx: true, cc: 'DE', state: '', langs: [], tags: [],
  votes: 0, clicks: 0, favicon: '', hls: false, ...o,
});

test('haversine Munich–Nuremberg ≈ 150 km', () => {
  expect(Math.round(haversineKm(48.137, 11.575, 49.45, 11.08))).toBeGreaterThan(140);
  expect(Math.round(haversineKm(48.137, 11.575, 49.45, 11.08))).toBeLessThan(160);
});

test('exact coords within 30 km snap to the city', () =>
  expect(m.match(st({ approx: false, lat: 48.2, lon: 11.6 }))).toEqual({
    id: 'c:1', lat: 48.137, lon: 11.575, kind: 'exact', cc: 'DE', nameRu: 'Мюнхен', name: 'Munich',
  }));

test('exact coords far from cities keep their own point, named after the nearest city', () => {
  const p = m.match(st({ approx: false, lat: 48.9, lon: 11.3 }))!;
  expect(p).toMatchObject({ id: 'p:DE:48.90,11.30', lat: 48.9, lon: 11.3, kind: 'exact', cc: 'DE', nameRu: 'Нюрнберг' });
});

test('region field matches admin1 and uses its most populous city', () =>
  expect(m.match(st({ state: 'Bayern' }))).toEqual({
    id: 'a:DE.02', lat: 48.137, lon: 11.575, kind: 'region', cc: 'DE', nameRu: 'Бавария', name: 'Bavaria',
  }));

test('region matching ignores case, diacritics and generic words (review focus 5)', () => {
  expect(m.match(st({ cc: 'FR', state: 'Région Île-de-France' }))!.id).toBe('a:FR.11');
  expect(m.match(st({ state: 'BAYERN' }))!.id).toBe('a:DE.02');
  expect(m.match(st({ cc: 'RU', state: 'Московская область' }))!.id).toBe('a:RU.47');
});

test('region with a trailing country, state code or note is still matched (from snapshot report)', () => {
  expect(m.match(st({ state: 'Bayern, Deutschland' }))!.id).toBe('a:DE.02');
  expect(m.match(st({ state: 'Bayern Germany' }))!.id).toBe('a:DE.02');
  expect(m.match(st({ cc: 'RU', state: 'Moscow (Russia)' }))!.id).toBe('a:RU.47');
  expect(m.match(st({ state: 'Munich BY' }))!.id).toBe('c:1');
});

test('admin1 wins over a city with the same alias', () =>
  expect(m.match(st({ cc: 'RU', state: 'Moscow' }))!.id).toBe('a:RU.47'));

test('region field naming a city falls back to that city', () =>
  expect(m.match(st({ cc: 'RU', state: 'Москва' }))).toMatchObject({ id: 'c:3', kind: 'region', nameRu: 'Москва' }));

test('admin1 without cities falls through to country', () =>
  expect(m.match(st({ state: 'Empty Land' }))!.id).toBe('k:DE'));

test('unknown region → country centroid', () =>
  expect(m.match(st({ state: 'Atlantis' }))).toEqual({
    id: 'k:DE', lat: 51, lon: 9, kind: 'country', cc: 'DE', nameRu: 'Германия', name: 'Germany',
  }));

test('region is matched only within the station country', () =>
  expect(m.match(st({ cc: 'FR', state: 'Bayern' }))!.id).toBe('k:FR'));

test('no centroid and no coords → null', () =>
  expect(m.match(st({ cc: 'ZZ' }))).toBeNull());

test('a station is never snapped to a city of another country (review: places must be country-scoped)', () => {
  const border = createPlaceMatcher({
    cities: [{ id: 50, nameRu: 'Зальцбург', name: 'Salzburg', lat: 47.8, lon: 13.04, cc: 'AT', admin1: '05', pop: 150_000, aliases: ['salzburg'] }],
    admin1: [],
  }, centroids, (cc, l) => names[l][cc] ?? cc);
  const p = border.match(st({ approx: false, cc: 'DE', lat: 47.75, lon: 12.95 }))!;
  expect(p.cc).toBe('DE');
  expect(p.id).toBe('p:DE:47.75,12.95');
});

test('a region primary name beats a translated alias of another region', () => {
  const ru = createPlaceMatcher({
    cities: [
      { id: 3, nameRu: 'Москва', name: 'Moscow', lat: 55.75, lon: 37.62, cc: 'RU', admin1: '48', pop: 10_000_000, aliases: ['moscow'] },
      { id: 5, nameRu: '', name: 'Krasnogorsk', lat: 55.82, lon: 37.33, cc: 'RU', admin1: '47', pop: 170_000, aliases: ['krasnogorsk'] },
    ],
    admin1: [
      { cc: 'RU', code: '48', nameRu: 'Москва', name: 'Moscow', aliases: ['moscow', 'москва'] },
      { cc: 'RU', code: '47', nameRu: 'Московская область', name: 'Moscow Oblast', aliases: ['moscow', 'московская'] },
    ],
  }, centroids, (cc, l) => names[l][cc]);
  expect(ru.match(st({ cc: 'RU', state: 'Moscow' }))!.id).toBe('a:RU.48');
  expect(ru.match(st({ cc: 'RU', state: 'Московская область' }))!.id).toBe('a:RU.47');
});
