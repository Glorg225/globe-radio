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
  // The page takes the city's own point, even when its region has more stations.
  expect(lisbon).toMatchObject({ slug: 'lisbon', tz: 'Europe/Lisbon', lat: 38.73, lon: -9.15 });
});

test('country page: slug from the name, all stations sorted by popularity', () => {
  const [pt] = fixture();
  expect(pt).toMatchObject({ name: 'Portugal', slug: 'portugal' });
  expect(pt.stations.map((s) => s.id)).toEqual(['6', '2', '3', '1', '4', '5']);
  // Place names are not genres: tags like "viseu" or "lisbon" must not show up as one.
  expect(pt.placeNames).toEqual(['portugal', 'lisbon', 'porto']);
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

test('a region that is the city itself joins the city page; a state or a surrounding region does not', () => {
  const places = [
    place({ id: 'c:1', cc: 'DE', name: 'Berlin', lat: 52.52, lon: 13.4 }),
    place({ id: 'a:DE.16', cc: 'DE', kind: 'region', name: 'State of Berlin', lat: 52.6, lon: 13.4 }),
    place({ id: 'c:2', cc: 'DE', name: 'Zürich', lat: 47.37, lon: 8.54 }),
    place({ id: 'a:DE.25', cc: 'DE', kind: 'region', name: 'Zurich', lat: 47.4, lon: 8.6 }),
    place({ id: 'c:3', cc: 'DE', name: 'Oklahoma City', lat: 35.47, lon: -97.52 }),
    place({ id: 'a:DE.40', cc: 'DE', kind: 'region', name: 'Oklahoma', lat: 35.5, lon: -97.5 }),
    place({ id: 'c:4', cc: 'DE', name: 'Kyiv', lat: 50.45, lon: 30.52 }),
    place({ id: 'a:DE.13', cc: 'DE', kind: 'region', name: 'Kyiv Oblast', lat: 49.8, lon: 30.11 }),
  ];
  const n: Record<string, number> = { 'c:1': 3, 'a:DE.16': 5, 'c:2': 1, 'a:DE.25': 2, 'c:3': 3, 'a:DE.40': 3, 'c:4': 3, 'a:DE.13': 3 };
  const stations = Object.entries(n).flatMap(([pid, k]) => Array.from({ length: k }, (_, i) => st(`${pid}-${i}`, pid, 0, 'DE')));
  const [de] = buildModel(places, new Map([['DE', { stations, info: new Map() }]]), () => 'Germany');
  const pages = Object.fromEntries(de.cities.map((c) => [c.slug, c.stations.length]));
  expect(pages).toEqual({ berlin: 8, zurich: 3, 'oklahoma-city': 3, oklahoma: 3, kyiv: 3, 'kyiv-oblast': 3 });
  expect(de.cities.find((c) => c.slug === 'berlin')).toMatchObject({ name: 'Berlin', lat: 52.52 });
});

