import { expect, test } from 'vitest';
import { decodeGazetteer, encodeGazetteer, normalizeName } from '../src/data/gazetteer';
import { applyAltName, parseAdmin1, parseCities } from '../scripts/build-gazetteer';

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
    cities: [{ id: 1, nameRu: 'Мюнхен', name: 'Munich', lat: 48.1, lon: 11.5, cc: 'DE', admin1: '02', pop: 5, aliases: ['munich'] }],
    admin1: [{ cc: 'DE', code: '02', nameRu: 'Бавария', name: 'Bavaria', aliases: ['bavaria', 'bayern'] }],
  };
  expect(decodeGazetteer(encodeGazetteer(g))).toEqual(g);
});
