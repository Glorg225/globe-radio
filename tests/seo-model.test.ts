import { expect, test } from 'vitest';
import type { Place } from '../src/data/places';
import type { PlaceInfo, StationLite } from '../src/data/shards';
import { allCities, buildModel, nearbyCities, type CountryData } from '../scripts/seo/model';

const place = (o: Partial<Place>): Place => ({ id: 'c:1', lat: 0, lon: 0, kind: 'exact', cc: 'PT', nameRu: '', name: 'X', count: 0, pop: 0, langs: {}, ...o });
const st = (id: string, placeId: string, clicks = 0, cc = 'PT'): StationLite => ({
  id, name: `S${id}`, url: 'https://a', placeId, cc, langs: ['pt'], tags: [], votes: 0, clicks, favicon: '', hls: false,
});
const names: Record<string, string> = { PT: 'Portugal', ES: 'Spain' };

function fixture() {
  const places = [
    place({ id: 'k:PT', kind: 'country', name: 'Portugal', lat: 39.5, lon: -8 }),
    place({ id: 'c:10', name: 'Lisbon', lat: 38.73, lon: -9.15 }),
    place({ id: 'a:PT.14', kind: 'region', name: 'Lisbon', lat: 38.72, lon: -9.03 }),
    place({ id: 'c:20', name: 'Porto', lat: 41.15, lon: -8.61 }),
    place({ id: 'k:ES', kind: 'country', cc: 'ES', name: 'Spain' }),
  ];
  const info = new Map<string, PlaceInfo>([
    ['c:10', { tz: '', wikiRu: '', wikiEn: 'Lisbon' }],
    ['a:PT.14', { tz: 'Europe/Lisbon', wikiRu: '', wikiEn: '' }],
  ]);
  const data = new Map<string, CountryData>([
    ['PT', { info, stations: [st('1', 'c:10', 5), st('2', 'a:PT.14', 50), st('3', 'a:PT.14', 7), st('4', 'c:20'), st('5', 'c:20'), st('6', 'k:PT', 99)] }],
    ['ES', { info: new Map(), stations: [st('7', 'k:ES', 1, 'ES'), st('8', 'k:ES', 1, 'ES')] }],
  ]);
  return buildModel(places, data, (cc) => names[cc] ?? cc);
}

test('a country needs at least 3 stations', () => {
  expect(fixture().map((c) => c.cc)).toEqual(['PT']);
});

test('a city and a region with the same English name become one page', () => {
  const [pt] = fixture();
  expect(pt.cities.map((c) => c.name)).toEqual(['Lisbon']);
  const lisbon = pt.cities[0];
  expect(lisbon.stations.map((s) => s.id)).toEqual(['2', '3', '1']);
  expect(lisbon).toMatchObject({ slug: 'lisbon', tz: 'Europe/Lisbon', lat: 38.72, lon: -9.03 });
});

test('country page: slug from the name, all stations sorted by popularity', () => {
  const [pt] = fixture();
  expect(pt).toMatchObject({ name: 'Portugal', slug: 'portugal' });
  expect(pt.stations.map((s) => s.id)).toEqual(['6', '2', '3', '1', '4', '5']);
});

test('cities with the same slug in one country get distinct slugs, the bigger city keeps the plain one', () => {
  const places = [place({ id: 'c:1', name: 'Sao Paulo' }), place({ id: 'c:2', name: 'São Paulo' })];
  const stations = [st('1', 'c:1'), st('2', 'c:1'), st('3', 'c:1'), st('4', 'c:2'), st('5', 'c:2'), st('6', 'c:2'), st('7', 'c:2')];
  const [pt] = buildModel(places, new Map([['PT', { stations, info: new Map() }]]), () => 'Portugal');
  expect(Object.fromEntries(pt.cities.map((c) => [c.name, c.slug]))).toEqual({ 'São Paulo': 'sao-paulo', 'Sao Paulo': 'sao-paulo-1' });
});

test('nearbyCities: nearest first, without the city itself, at most n', () => {
  const places = ['A:0', 'B:1', 'C:5', 'D:2'].map((s, i) => {
    const [name, lon] = s.split(':');
    return place({ id: `c:${i}`, name, lat: 0, lon: Number(lon) });
  });
  const stations = places.flatMap((p) => [1, 2, 3].map((n) => st(`${p.id}-${n}`, p.id)));
  const refs = allCities(buildModel(places, new Map([['PT', { stations, info: new Map() }]]), () => 'Portugal'));
  const a = refs.find((r) => r.city.name === 'A')!;
  expect(nearbyCities(a, refs, 2).map((r) => r.city.name)).toEqual(['B', 'D']);
});
