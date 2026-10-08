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

test('stations far from any city (placeholder places named after the country) get no city page', () => {
  const places = [place({ id: 'p:DE:1.00,2.00', cc: 'DE', name: 'Germany', lat: 1, lon: 2 }), place({ id: 'p:DE:40.00,9.00', cc: 'DE', name: 'Germany', lat: 40, lon: 9 })];
  const stations = [st('1', 'p:DE:1.00,2.00', 0, 'DE'), st('2', 'p:DE:1.00,2.00', 0, 'DE'), st('3', 'p:DE:1.00,2.00', 0, 'DE'), st('4', 'p:DE:40.00,9.00', 0, 'DE')];
  const [de] = buildModel(places, new Map([['DE', { stations, info: new Map() }]]), () => 'Germany');
  expect(de.cities).toEqual([]);
  expect(de.stations).toHaveLength(4);
});

test('cities that share a name but lie far apart get separate pages', () => {
  const places = [
    place({ id: 'c:1', cc: 'US', name: 'Springfield', lat: 39.8, lon: -89.65 }),
    place({ id: 'c:2', cc: 'US', name: 'Springfield', lat: 42.1, lon: -72.59 }),
    place({ id: 'a:US.IL', cc: 'US', kind: 'region', name: 'Springfield', lat: 39.85, lon: -89.6 }),
  ];
  const n: Record<string, number> = { 'c:1': 3, 'c:2': 5, 'a:US.IL': 1 };
  const stations = Object.entries(n).flatMap(([pid, k]) => Array.from({ length: k }, (_, i) => st(`${pid}-${i}`, pid, 0, 'US')));
  const [us] = buildModel(places, new Map([['US', { stations, info: new Map() }]]), () => 'United States');
  expect(Object.fromEntries(us.cities.map((c) => [c.slug, [c.lat, c.stations.length]]))).toEqual({ springfield: [42.1, 5], 'springfield-1': [39.8, 4] });
});

test('a region joins the nearest of the matching cities', () => {
  const places = [
    place({ id: 'c:1', cc: 'CH', name: 'Zürich', lat: 47.37, lon: 8.54 }),
    place({ id: 'c:2', cc: 'CH', name: 'Zurich', lat: 47.55, lon: 8.54 }),
    place({ id: 'a:CH.25', cc: 'CH', kind: 'region', name: 'Zurich Region', lat: 47.53, lon: 8.54 }),
  ];
  const stations = ['c:1', 'c:1', 'c:1', 'c:2', 'a:CH.25', 'a:CH.25'].map((pid, i) => st(String(i), pid, 0, 'CH'));
  const [ch] = buildModel(places, new Map([['CH', { stations, info: new Map() }]]), () => 'Switzerland');
  expect(Object.fromEntries(ch.cities.map((c) => [c.name, c.stations.length]))).toEqual({ 'Zürich': 3, Zurich: 3 });
});

test('a same-name region far from the city keeps its own page; a place near any member of a city joins it', () => {
  const places = [
    place({ id: 'c:1', cc: 'PT', name: 'Lisbon', lat: 38.7, lon: -9.1 }),
    place({ id: 'c:2', cc: 'PT', name: 'Lisbon', lat: 38.7, lon: -8.85 }),
    place({ id: 'c:3', cc: 'PT', name: 'Lisbon', lat: 38.7, lon: -8.6 }),
    place({ id: 'a:PT.99', cc: 'PT', kind: 'region', name: 'Lisbon', lat: 41, lon: -8 }),
  ];
  const n: Record<string, number> = { 'c:1': 3, 'c:2': 1, 'c:3': 1, 'a:PT.99': 3 };
  const stations = Object.entries(n).flatMap(([pid, k]) => Array.from({ length: k }, (_, i) => st(`${pid}-${i}`, pid)));
  const [pt] = buildModel(places, new Map([['PT', { stations, info: new Map() }]]), () => 'Portugal');
  // c:3 is 43 km from c:1 but 22 km from c:2, which is part of the same Lisbon.
  expect(Object.fromEntries(pt.cities.map((c) => [c.slug, c.stations.length]))).toEqual({ lisbon: 5, 'lisbon-pt-99': 3 });
});

test('country slugs come from all countries in the snapshot, even one without a station file', () => {
  const places = [
    place({ id: 'k:AA', cc: 'AA', kind: 'country', name: 'Atlantis', count: 9 }),
    place({ id: 'k:AB', cc: 'AB', kind: 'country', name: 'Atlantis', count: 4 }),
  ];
  const stations = Array.from({ length: 4 }, (_, i) => st(String(i), 'k:AB', 0, 'AB'));
  const countries = buildModel(places, new Map([['AB', { stations, info: new Map() }]]), () => 'Atlantis');
  // AA has no station file here, but the app still knows it as the bigger "Atlantis": AB keeps the suffixed slug.
  expect(countries.map((c) => c.slug)).toEqual(['atlantis-ab']);
});
