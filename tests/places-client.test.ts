import { expect, test, vi } from 'vitest';
import { countryName, placeTitle } from '../src/data/place-name';
import { loadPlaces, type Place } from '../src/data/places';
import { createShardStore } from '../src/data/shards';

const ok = (body: unknown) => new Response(JSON.stringify(body));

test('loadPlaces decodes v2 file from base url', async () => {
  const f = vi.fn(async () => ok({ v: 2, generated: 'x', places: [['c:1', 1, 2, 0, 'DE', 'Мюнхен', 'Munich', 3, 9]] }));
  const list = await loadPlaces('/base/', f as unknown as typeof fetch);
  expect(f).toHaveBeenCalledWith('/base/data/places.json');
  expect(list[0]).toMatchObject({ id: 'c:1', kind: 'exact', count: 3 });
});

test('loadPlaces rejects other versions and HTTP errors', async () => {
  await expect(loadPlaces('/', (async () => ok({ v: 1, places: [] })) as unknown as typeof fetch)).rejects.toThrow(/format/);
  await expect(loadPlaces('/', (async () => new Response('', { status: 500 })) as unknown as typeof fetch)).rejects.toThrow(/500/);
});

test('shard store caches per country and shares in-flight requests', async () => {
  const f = vi.fn(async () => ok({ v: 2, cc: 'DE', stations: [['u', 'N', 'https://x', 'c:1', 'de', '', 1, 2, '', 0]] }));
  const store = createShardStore('/', f as unknown as typeof fetch);
  const [a, b] = await Promise.all([store.get('DE'), store.get('DE')]);
  await store.get('DE');
  expect(f).toHaveBeenCalledTimes(1);
  expect(f).toHaveBeenCalledWith('/data/stations/DE.json');
  expect(a).toBe(b);
  expect(a[0]).toMatchObject({ id: 'u', cc: 'DE', placeId: 'c:1' });
});

test('a failed shard load can be retried (review focus 2)', async () => {
  let n = 0;
  const f = (async () => (n++ === 0 ? new Response('', { status: 503 }) : ok({ v: 2, cc: 'FR', stations: [] }))) as unknown as typeof fetch;
  const store = createShardStore('/', f);
  await expect(store.get('FR')).rejects.toThrow();
  await expect(store.get('FR')).resolves.toEqual([]);
});

const place = (o: Partial<Place>): Place => ({ id: 'c:1', lat: 0, lon: 0, kind: 'exact', cc: 'DE', nameRu: 'Мюнхен', name: 'Munich', count: 1, pop: 1, ...o });

test('placeTitle prefers russian name for ru, falls back to local name', () => {
  expect(placeTitle(place({}), 'ru')).toBe('Мюнхен');
  expect(placeTitle(place({ nameRu: '' }), 'ru')).toBe('Munich');
  expect(placeTitle(place({}), 'en')).toBe('Munich');
});

test('country places and country names come from Intl in the UI language', () => {
  expect(placeTitle(place({ kind: 'country', nameRu: 'x', name: 'y' }), 'ru')).toBe('Германия');
  expect(countryName('FR', 'ru')).toBe('Франция');
  expect(countryName('QQ', 'ru')).toBe('QQ');
});
