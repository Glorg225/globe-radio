import { expect, test } from 'vitest';
import { buildSnapshot } from '../scripts/build-snapshot';
import { decodePlace, encodePlace, type Place } from '../src/data/places';
import { decodeStation, encodeStation } from '../src/data/shards';
import type { PlaceRef, RawStation, Station } from '../src/data/types';

const raw = (o: Partial<RawStation>): RawStation => ({
  stationuuid: 'u', name: 'S', url: 'https://a', url_resolved: 'https://b', favicon: '', tags: 'pop',
  countrycode: 'DE', language: '', languagecodes: 'de', votes: 1, clickcount: 10, lastcheckok: 1, hls: 0,
  geo_lat: null, geo_long: null, state: '', ...o,
});
const centroids = { DE: [51, 9] as [number, number], FR: [46, 2] as [number, number] };
const matcher = {
  match: (s: Station): PlaceRef | null =>
    s.state === 'Bayern'
      ? { id: 'a:DE.02', lat: 48.1, lon: 11.5, kind: 'region', cc: 'DE', nameRu: 'Бавария', name: 'Bavaria' }
      : !s.approx
        ? { id: 'c:1', lat: 48.1, lon: 11.5, kind: 'exact', cc: s.cc, nameRu: 'Мюнхен', name: 'Munich' }
        : { id: `k:${s.cc}`, lat: 51, lon: 9, kind: 'country', cc: s.cc, nameRu: 'Германия', name: 'Germany' },
};

test('groups stations into places with counts and popularity', () => {
  const { places, shards, report } = buildSnapshot([
    raw({ stationuuid: 'a', state: 'Bayern', clickcount: 5 }),
    raw({ stationuuid: 'b', state: 'Bayern', clickcount: 7 }),
    raw({ stationuuid: 'c', state: 'Atlantis' }),
    raw({ stationuuid: 'd', countrycode: 'FR' }),
  ], centroids, matcher);
  const bav = places.find((p) => p.id === 'a:DE.02')!;
  expect(bav).toMatchObject({ count: 2, pop: 12, kind: 'region', nameRu: 'Бавария' });
  expect(shards.get('DE')!.map((s) => s.id)).toEqual(['c', 'b', 'a']);
  expect(shards.get('FR')!.map((s) => s.placeId)).toEqual(['k:FR']);
  expect(report.byKind).toEqual({ exact: 0, region: 2, country: 2 });
  expect(report.unknownRegions).toEqual([['de|atlantis', 1]]);
});

test('a place shared by exact and region stations is reported as exact', () => {
  const m = { match: (s: Station): PlaceRef => ({ id: 'c:1', lat: 1, lon: 1, kind: s.approx ? 'region' : 'exact', cc: 'DE', nameRu: '', name: 'X' }) };
  const { places } = buildSnapshot([
    raw({ stationuuid: 'a', state: 'X' }),
    raw({ stationuuid: 'b', geo_lat: 48, geo_long: 11 }),
  ], centroids, m);
  expect(places[0].kind).toBe('exact');
});

test('stations without a valid 2-letter country are skipped', () => {
  const { shards } = buildSnapshot([raw({ stationuuid: 'a', countrycode: '', geo_lat: 48, geo_long: 11 })], centroids, matcher);
  expect(shards.size).toBe(0);
});

test('place and station encodings roundtrip', () => {
  const p: Place = { id: 'c:1', lat: 1.5, lon: 2.5, kind: 'region', cc: 'DE', nameRu: 'Я', name: 'I', count: 3, pop: 9, langs: {} };
  expect(decodePlace(encodePlace(p))).toEqual(p);
  const s = { id: 'u', name: 'N', url: 'https://x', placeId: 'c:1', cc: 'DE', langs: ['de'], tags: ['pop'], votes: 1, clicks: 2, favicon: '', hls: true };
  expect(decodeStation(encodeStation(s), 'DE')).toEqual(s);
});

test('places sharing exact coordinates are nudged apart so each one can be clicked', async () => {
  const { haversineKm } = await import('../src/data/geo');
  const m = { match: (s: Station): PlaceRef => ({ id: s.state === 'R' ? 'a:FR.11' : 'c:9', lat: 48.85, lon: 2.35, kind: s.state === 'R' ? 'region' : 'exact', cc: 'FR', nameRu: '', name: 'X' }) };
  const { places } = buildSnapshot([
    raw({ stationuuid: 'a', countrycode: 'FR', geo_lat: 48.85, geo_long: 2.35 }),
    raw({ stationuuid: 'b', countrycode: 'FR', state: 'R' }),
  ], centroids, m);
  const [x, y] = places;
  const km = haversineKm(x.lat, x.lon, y.lat, y.lon);
  expect(km).toBeGreaterThan(5);
  expect(km).toBeLessThan(20);
  expect(places.find((pl) => pl.id === 'c:9')).toMatchObject({ lat: 48.85, lon: 2.35 });
});

test('placeInfoRows: per-country place data, countries use their own names as articles', async () => {
  const { placeInfoRows } = await import('../scripts/build-snapshot');
  const places: Place[] = [
    { id: 'c:1', lat: 0, lon: 0, kind: 'exact', cc: 'DE', nameRu: 'Мюнхен', name: 'Munich', count: 1, pop: 1, tz: 'Europe/Berlin', wikiRu: 'Мюнхен', wikiEn: 'Munich' },
    { id: 'k:DE', lat: 0, lon: 0, kind: 'country', cc: 'DE', nameRu: 'Германия', name: 'Germany', count: 1, pop: 1, tz: 'Europe/Berlin' },
    { id: 'k:FR', lat: 0, lon: 0, kind: 'country', cc: 'FR', nameRu: 'Франция', name: 'France', count: 1, pop: 1 },
  ];
  expect(placeInfoRows(places, 'DE')).toEqual([
    ['c:1', 'Europe/Berlin', 'Мюнхен', 'Munich'],
    ['k:DE', 'Europe/Berlin', 'Германия', 'Germany'],
  ]);
  expect(placeInfoRows(places, 'FR')).toEqual([['k:FR', '', 'Франция', 'France']]);
});

test('placeInfoRows prefers gazetteer country articles over display names', async () => {
  const { placeInfoRows } = await import('../scripts/build-snapshot');
  const places: Place[] = [{ id: 'k:CD', lat: 0, lon: 0, kind: 'country', cc: 'CD', nameRu: 'Конго - Киншаса', name: 'Congo - Kinshasa', count: 1, pop: 1, wikiRu: 'Демократическая Республика Конго', wikiEn: 'Democratic Republic of the Congo' }];
  expect(placeInfoRows(places, 'CD')).toEqual([['k:CD', '', 'Демократическая Республика Конго', 'Democratic Republic of the Congo']]);
});

test('places count their stations per language', () => {
  const { places } = buildSnapshot([
    raw({ stationuuid: 'a', state: 'Bayern', languagecodes: 'de' }),
    raw({ stationuuid: 'b', state: 'Bayern', languagecodes: 'de,en' }),
    raw({ stationuuid: 'c', state: 'Bayern', languagecodes: '', language: '' }),
  ], centroids, matcher);
  expect(places.find((p) => p.id === 'a:DE.02')!.langs).toEqual({ de: 2, en: 1 });
});

test('language counts survive encode/decode; old rows without them decode to {}', async () => {
  const { encodeLangs, decodeLangs } = await import('../src/data/places');
  const p: Place = { id: 'c:1', lat: 1, lon: 2, kind: 'exact', cc: 'ES', nameRu: '', name: 'M', count: 15, pop: 9, langs: { es: 12, ca: 3 } };
  expect(encodeLangs(p.langs)).toBe('es:12,ca:3');
  expect(decodePlace(encodePlace(p)).langs).toEqual({ es: 12, ca: 3 });
  expect(decodePlace(['c:2', 0, 0, 0, 'ES', '', 'X', 1, 1]).langs).toEqual({});
  expect(decodeLangs('es:x,:3,ca:2')).toEqual({ ca: 2 });
});
