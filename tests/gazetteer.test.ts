import { expect, test } from 'vitest';
import { decodeGazetteer, encodeGazetteer, normalizeName, type Gazetteer } from '../src/data/gazetteer';
import { applyAltName, linkDistricts, parseAdmin1, parseCities } from '../scripts/build-gazetteer';

test('normalizeName strips case, diacritics, punctuation and generic words', () => {
  expect(normalizeName('Région Île-de-France')).toBe('ile de france');
  expect(normalizeName('  BAYERN ')).toBe('bayern');
  expect(normalizeName('Московская область')).toBe('московская');
  expect(normalizeName('State of São Paulo')).toBe('sao paulo');
  expect(normalizeName('')).toBe('');
});

const cityLine = (id: number, name: string, alt: string, lat: number, lon: number, cc: string, a1: string, pop: number) =>
  [id, name, name, alt, lat, lon, 'P', 'PPLA', cc, '', a1, '', '', '', pop, '', '', 'Europe/Berlin', '2024-01-01'].join('\t');

test('parseCities reads TSV and keeps aliases only for big cities', () => {
  const text = [cityLine(2867714, 'Munich', 'Muenchen,München,Мюнхен', 48.137, 11.575, 'DE', '02', 1260391),
    cityLine(1, 'Smallville', 'Small Ville', 50, 10, 'DE', '02', 20000)].join('\n');
  const [big, small] = parseCities(text);
  expect(big).toMatchObject({ id: 2867714, name: 'Munich', lat: 48.137, lon: 11.575, cc: 'DE', admin1: '02', pop: 1260391, nameRu: '' });
  expect(big.aliases).toEqual(expect.arrayContaining(['munich', 'muenchen', 'munchen', 'мюнхен']));
  expect(small.aliases).toEqual(['smallville']);
});

test('parseAdmin1 reads code, name and geoname id', () => {
  const [a] = parseAdmin1('DE.02\tBavaria\tBavaria\t2951839');
  expect(a).toMatchObject({ cc: 'DE', code: '02', name: 'Bavaria', nameRu: '' });
  expect(a.aliases).toEqual(['bavaria']);
});

test('applyAltName adds russian names and admin1 aliases in all languages', () => {
  const [city] = parseCities(cityLine(2867714, 'Munich', '', 48.1, 11.5, 'DE', '02', 1260391));
  const [a] = parseAdmin1('DE.02\tBavaria\tBavaria\t2951839');
  const cities = new Map([[city.id, city]]);
  const admins = new Map([[2951839, a]]);
  applyAltName(['1', '2867714', 'ru', 'Мюнхен', '1', '', '', ''], cities, admins);
  applyAltName(['2', '2951839', 'ru', 'Бавария', '1', '', '', ''], cities, admins);
  applyAltName(['3', '2951839', 'de', 'Bayern', '', '', '', ''], cities, admins);
  applyAltName(['4', '2951839', 'link', 'https://en.wikipedia.org/wiki/Bavaria', '', '', '', ''], cities, admins);
  expect(city.nameRu).toBe('Мюнхен');
  expect(a.nameRu).toBe('Бавария');
  expect(a.aliases).toEqual(expect.arrayContaining(['bavaria', 'бавария', 'bayern']));
  expect(a.aliases.some((x) => x.includes('wikipedia'))).toBe(false);
});

test('preferred russian name wins over a non-preferred one', () => {
  const [city] = parseCities(cityLine(5, 'X', '', 1, 1, 'RU', '48', 200000));
  const cities = new Map([[5, city]]);
  applyAltName(['1', '5', 'ru', 'Неправильно', '', '', '', ''], cities, new Map());
  applyAltName(['2', '5', 'ru', 'Правильно', '1', '', '', ''], cities, new Map());
  applyAltName(['3', '5', 'ru', 'Ещё одно', '', '', '', ''], cities, new Map());
  expect(city.nameRu).toBe('Правильно');
});

test('encode/decode roundtrip', () => {
  const g = {
    cities: [{ id: 1, nameRu: 'Мюнхен', name: 'Munich', lat: 48.1, lon: 11.5, cc: 'DE', admin1: '02', pop: 5, aliases: ['munich'], tz: 'Europe/Berlin', wikiRu: 'Мюнхен', wikiEn: 'Munich' }],
    admin1: [{ cc: 'DE', code: '02', nameRu: 'Бавария', name: 'Bavaria', aliases: ['bavaria', 'bayern'], wikiRu: 'Бавария', wikiEn: 'Bavaria' }],
    countries: [],
  };
  expect(decodeGazetteer(encodeGazetteer(g))).toEqual(g);
});

test('parseCities reads the timezone column', () => {
  const [c] = parseCities(cityLine(2867714, 'Munich', '', 48.1, 11.5, 'DE', '02', 1260391));
  expect(c.tz).toBe('Europe/Berlin');
  expect([c.wikiRu, c.wikiEn]).toEqual(['', '']);
});

test('applyAltName takes en/ru Wikipedia titles from link rows (first wins, decoded, underscores → spaces)', () => {
  const [city] = parseCities(cityLine(2267057, 'Lisbon', '', 38.7, -9.1, 'PT', '14', 500000));
  const [a] = parseAdmin1('DE.02\tBavaria\tBavaria\t2951839');
  const cities = new Map([[city.id, city]]);
  const admins = new Map([[2951839, a]]);
  applyAltName(['1', '2267057', 'link', 'https://en.wikipedia.org/wiki/Lisbon', '', '', '', ''], cities, admins);
  applyAltName(['2', '2267057', 'link', 'https://en.wikipedia.org/wiki/Lisbon_(other)', '', '', '', ''], cities, admins);
  applyAltName(['3', '2951839', 'link', 'https://ru.wikipedia.org/wiki/%D0%91%D0%B0%D0%B2%D0%B0%D1%80%D0%B8%D1%8F', '', '', '', ''], cities, admins);
  applyAltName(['4', '2951839', 'link', 'https://en.wikipedia.org/wiki/Free_State_of_Bavaria', '', '', '', ''], cities, admins);
  applyAltName(['5', '2951839', 'link', 'https://de.wikipedia.org/wiki/Bayern', '', '', '', ''], cities, admins);
  expect(city.wikiEn).toBe('Lisbon');
  expect(a.wikiRu).toBe('Бавария');
  expect(a.wikiEn).toBe('Free State of Bavaria');
  expect(a.aliases.some((x) => x.includes('wikipedia'))).toBe(false);
});

test('decode reads v1 files without the new fields', () => {
  const v1 = { v: 1, cities: [[1, '', 'X', 1, 2, 'DE', '01', 5, 'x']], admin1: [['DE', '01', '', 'Y', 'y']] };
  const g = decodeGazetteer(v1 as never);
  expect(g.cities[0]).toMatchObject({ tz: '', wikiRu: '', wikiEn: '' });
  expect(g.admin1[0]).toMatchObject({ wikiRu: '', wikiEn: '' });
});

test('Wikipedia link fragments (#section) are dropped from titles', () => {
  const [a] = parseAdmin1('CO.34\tBogota D.C.\tBogota D.C.\t3688685');
  applyAltName(['1', '3688685', 'link', 'https://en.wikipedia.org/wiki/Bogot%C3%A1#Pre-Colombian', '', '', '', ''], new Map(), new Map([[3688685, a]]));
  expect(a.wikiEn).toBe('Bogotá');
});

test('countries get Wikipedia titles from their own GeoNames link rows', async () => {
  const { parseCountryInfo } = await import('../scripts/build-gazetteer');
  const [cd] = parseCountryInfo('# comment\nCD\tCOD\t180\tCG\tDR Congo\tKinshasa\t2345410\t0\tAF\t.cd\tCDF\tFranc\t243\t\t\tfr-CD\t203312\t\t');
  expect(cd).toMatchObject({ cc: 'CD', geonameId: 203312, wikiRu: '', wikiEn: '' });
  const countries = new Map([[203312, cd]]);
  applyAltName(['1', '203312', 'link', 'https://en.wikipedia.org/wiki/Democratic_Republic_of_the_Congo', '', '', '', ''], new Map(), new Map(), countries);
  applyAltName(['2', '203312', 'ru', 'ДР Конго', '1', '', '', ''], new Map(), new Map(), countries);
  expect(cd.wikiEn).toBe('Democratic Republic of the Congo');
  const g = { cities: [], admin1: [], countries: [{ cc: 'CD', wikiRu: 'Демократическая Республика Конго', wikiEn: 'Democratic Republic of the Congo' }] };
  expect(decodeGazetteer(encodeGazetteer(g)).countries).toEqual(g.countries);
});

// GeoNames "PPLX" = section of a populated place (Mitte, Times Square): not a city of its own.
const fLine = (id: number, name: string, lat: number, lon: number, cc: string, pop: number, code: string) =>
  [id, name, name, '', lat, lon, 'P', code, cc, '', '01', '', '', '', pop, '', '', 'Europe/Berlin', '2024-01-01'].join('\t');

test('linkDistricts: a district points to the biggest real city of its country within 30 km', () => {
  const cities = parseCities([
    fLine(1, 'Berlin', 52.52, 13.405, 'DE', 3_400_000, 'PPLC'),
    fLine(2, 'Mitte', 52.53, 13.39, 'DE', 330_000, 'PPLX'),
    fLine(3, 'Potsdam', 52.4, 13.07, 'DE', 180_000, 'PPLA'),
    fLine(4, 'Frankfurt (Oder) Mitte', 52.35, 14.55, 'DE', 20_000, 'PPLX'),
    fLine(5, 'Słubice', 52.35, 14.56, 'PL', 1_700_000, 'PPL'),
    fLine(6, 'Kurenivka', 50.49, 30.48, 'UA', 80_000, 'PPLX'),
    fLine(7, 'Kyiv', 50.45, 30.52, 'UA', 2_900_000, 'PPLC'),
    fLine(8, 'Big District', 10, 10, 'XX', 900_000, 'PPLX'),
    fLine(9, 'Small Town', 10.01, 10.01, 'XX', 20_000, 'PPL'),
  ].join('\n'));
  linkDistricts(cities);
  const parent = Object.fromEntries(cities.map((c) => [c.name, c.parent]));
  expect(parent).toEqual({
    Berlin: undefined, Mitte: 1, Potsdam: undefined, 'Frankfurt (Oder) Mitte': undefined,
    'Słubice': undefined, Kurenivka: 7, Kyiv: undefined, 'Big District': undefined, 'Small Town': undefined,
  });
});

test('the district parent survives encoding; other rows stay as before', () => {
  const g: Gazetteer = {
    cities: [
      { id: 1, nameRu: '', name: 'Berlin', lat: 1, lon: 1, cc: 'DE', admin1: '16', pop: 3, aliases: [], tz: '', wikiRu: '', wikiEn: '' },
      { id: 2, nameRu: '', name: 'Mitte', lat: 1, lon: 1, cc: 'DE', admin1: '16', pop: 1, aliases: [], tz: '', wikiRu: '', wikiEn: '', parent: 1 },
    ],
    admin1: [],
    countries: [],
  };
  const f = encodeGazetteer(g);
  expect(f.cities[0]).toHaveLength(12);
  expect(decodeGazetteer(f)).toEqual(g);
  expect(decodeGazetteer(f).cities[0]).not.toHaveProperty('parent');
});

