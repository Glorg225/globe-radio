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
  const p: Place = { id: 'c:1', lat: 1.5, lon: 2.5, kind: 'region', cc: 'DE', nameRu: 'Я', name: 'I', count: 3, pop: 9 };
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
