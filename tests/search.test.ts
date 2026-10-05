import { expect, test, vi } from 'vitest';
import type { Place } from '../src/data/places';
import { createSearchIndex, normalizeText } from '../src/search/search-index';

const place = (id: string, cc: string, nameRu: string, name: string, kind: Place['kind'] = 'exact', count = 1): Place =>
  ({ id, lat: 0, lon: 0, kind, cc, nameRu, name, count, pop: 1 });
const places = [
  place('c:1', 'PT', 'Лиссабон', 'Lisbon', 'exact', 12),
  place('c:2', 'BR', 'Сан-Паулу', 'São Paulo', 'exact', 50),
  place('k:DE', 'DE', 'Германия', 'Germany', 'country', 300),
  place('c:3', 'DE', 'Мюнхен', 'Munich', 'exact', 9),
];
const file = { v: 1, stations: [['Radio Lisboa', 'c:1'], ['Antena Paulista', 'c:2'], ['Fado Lisboa', 'c:1'], ['Bayern 3', 'c:3']] };
const ok = (b: unknown) => new Response(JSON.stringify(b));

test('normalizeText drops case and diacritics', () => {
  expect(normalizeText('São PAULO')).toBe('sao paulo');
  expect(normalizeText('Ёлки')).toBe('елки');
});

test('finds places by Russian/local name and stations by name; station hits carry their place', async () => {
  const f = vi.fn(async () => ok(file));
  const idx = createSearchIndex('/', places, 'ru', f as unknown as typeof fetch);
  const r = await idx.search('лисс');
  expect(r.places.map((p) => p.id)).toEqual(['c:1']);
  const s = await idx.search('lisboa');
  expect(s.stations.map((h) => [h.name, h.place.id])).toEqual([['Radio Lisboa', 'c:1'], ['Fado Lisboa', 'c:1']]);
  expect((await idx.search('sao')).places.map((p) => p.id)).toEqual(['c:2']);
  expect(f).toHaveBeenCalledTimes(1);
});

test('country names match country places only; starts-with ranks higher', async () => {
  const idx = createSearchIndex('/', places, 'ru', (async () => ok(file)) as unknown as typeof fetch);
  expect((await idx.search('герм')).places.map((p) => p.id)).toEqual(['k:DE']);
  const r = await idx.search('fado');
  expect(r.stations[0].name).toBe('Fado Lisboa');
});

test('fewer than 2 characters → empty; nothing found → empty lists', async () => {
  const idx = createSearchIndex('/', places, 'ru', (async () => ok(file)) as unknown as typeof fetch);
  expect(await idx.search('l')).toEqual({ places: [], stations: [] });
  expect(await idx.search('zzzz')).toEqual({ places: [], stations: [] });
});

test('limits: at most 5 places and 8 stations', async () => {
  const many = { v: 1, stations: Array.from({ length: 20 }, (_, i) => [`Radio ${i}`, 'c:1']) };
  const idx = createSearchIndex('/', places, 'ru', (async () => ok(many)) as unknown as typeof fetch);
  expect((await idx.search('radio')).stations).toHaveLength(8);
});

test('a failed index load can be retried', async () => {
  let n = 0;
  const f = (async () => (n++ === 0 ? new Response('', { status: 503 }) : ok(file))) as unknown as typeof fetch;
  const idx = createSearchIndex('/', places, 'ru', f);
  await expect(idx.search('radio')).rejects.toThrow();
  await expect(idx.search('radio')).resolves.toMatchObject({ stations: [{ name: 'Radio Lisboa' }] });
});

test('prefetch loads the index once in the background; a failed prefetch is retried by the next search', async () => {
  let n = 0;
  const f = vi.fn(async () => (n++ === 0 ? new Response('', { status: 503 }) : ok(file)));
  const idx = createSearchIndex('/', places, 'ru', f as unknown as typeof fetch);
  idx.prefetch();
  idx.prefetch();
  await new Promise((r) => setTimeout(r, 0));
  expect(f).toHaveBeenCalledTimes(1);
  await expect(idx.search('radio')).resolves.toMatchObject({ stations: [{ name: 'Radio Lisboa' }] });
  expect(f).toHaveBeenCalledTimes(2);
});
