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

test('shard store exposes place info from the same file; old files have none', async () => {
  const f = vi.fn(async (u: string) => ok(u.includes('DE')
    ? { v: 2, cc: 'DE', stations: [], places: [['c:1', 'Europe/Berlin', 'Мюнхен', 'Munich']] }
    : { v: 2, cc: 'FR', stations: [] }));
  const store = createShardStore('/', f as unknown as typeof fetch);
  expect((await store.info('DE')).get('c:1')).toEqual({ tz: 'Europe/Berlin', wikiRu: 'Мюнхен', wikiEn: 'Munich' });
  await store.get('DE');
  expect(f).toHaveBeenCalledTimes(1);
  expect((await store.info('FR')).size).toBe(0);
});

test('places file: time-zone table and 2 styles for places with 3+ stations; small places and old rows without', async () => {
  const { encodePlacesFile, decodePlace } = await import('../src/data/places');
  const base = { lat: 0, lon: 0, kind: 'exact' as const, cc: 'PT', nameRu: '', count: 3, pop: 1 };
  const file = encodePlacesFile([
    { ...base, id: 'c:1', name: 'Lisbon', tz: 'Europe/Lisbon', styles: ['pop', 'news'] },
    { ...base, id: 'c:2', name: 'Porto', tz: 'Europe/Lisbon' },
    { ...base, id: 'c:3', name: 'Nowhere' },
    { ...base, id: 'c:4', name: 'Tiny', count: 2, tz: 'Europe/Madrid', styles: ['jazz'] },
  ], '2026-10-08T00:00:00Z');
  expect(file.tzs).toEqual(['Europe/Lisbon']);
  const [a, b, c, tiny] = file.places.map((row) => decodePlace(row, file.tzs, file.styles));
  expect(tiny.tz).toBeUndefined();
  expect(tiny.styles).toBeUndefined();
  expect(file.places[0][11]).toHaveLength(2);
  expect(a).toMatchObject({ name: 'Lisbon', tz: 'Europe/Lisbon', styles: ['pop', 'news'] });
  expect(b).toMatchObject({ tz: 'Europe/Lisbon' });
  expect(b.styles).toBeUndefined();
  expect(c.tz).toBeUndefined();
  const old = decodePlace(['c:9', 0, 0, 0, 'PT', '', 'Old', 1, 1, 'pt:1']);
  expect(old).toMatchObject({ name: 'Old', langs: { pt: 1 } });
  expect(old.tz).toBeUndefined();
});

test('every style of the dictionary survives the one-character encoding', async () => {
  const { encodePlacesFile, decodePlace, STYLE_ALPHABET } = await import('../src/data/places');
  const { GENRES } = await import('../src/data/genres');
  expect(GENRES.length).toBeLessThanOrEqual(STYLE_ALPHABET.length);
  const places = GENRES.map((g, i) => ({ id: `c:${i}`, lat: 0, lon: 0, kind: 'exact' as const, cc: 'PT', nameRu: '', name: g.id, count: 3, pop: 1, styles: [g.id, GENRES[0].id] }));
  const file = encodePlacesFile(places, '');
  expect(file.places.map((row) => decodePlace(row, file.tzs, file.styles).styles)).toEqual(places.map((p) => p.styles));
});

test('the file carries its own style table: a later dictionary order cannot shift old files', async () => {
  const { encodePlacesFile, decodePlace } = await import('../src/data/places');
  const base = { lat: 0, lon: 0, kind: 'exact' as const, cc: 'PT', nameRu: '', count: 3, pop: 1 };
  const file = encodePlacesFile([{ ...base, id: 'c:1', name: 'A', styles: ['jazz', 'news'] }, { ...base, id: 'c:2', name: 'B', styles: ['80s'] }], '');
  expect(file.styles).toEqual(['80s', 'jazz', 'news']);
  const reread = JSON.parse(JSON.stringify(file));
  expect(decodePlace(reread.places[0], reread.tzs, reread.styles).styles).toEqual(['jazz', 'news']);
});

