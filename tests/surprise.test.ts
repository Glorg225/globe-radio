import { expect, test, vi } from 'vitest';
import type { Place } from '../src/data/places';
import type { StationLite } from '../src/data/shards';
import { pickSurprise, weightedPick } from '../src/player/surprise';

const place = (id: string, cc: string, count: number, langs: Record<string, number> = {}): Place =>
  ({ id, lat: 0, lon: 0, kind: 'exact', cc, nameRu: '', name: id, count, pop: 1, langs });
const st = (id: string, placeId: string, clicks: number, langs: string[] = ['pt'], cc = 'PT'): StationLite =>
  ({ id, name: id, url: 'https://x', placeId, cc, langs, tags: [], votes: 0, clicks, favicon: '', hls: false });

test('weightedPick follows weights and ignores zero weights', () => {
  const items = ['a', 'b', 'c'];
  const w = (x: string) => ({ a: 1, b: 0, c: 3 })[x]!;
  expect(weightedPick(items, w, () => 0)).toBe('a');
  expect(weightedPick(items, w, () => 0.3)).toBe('c');
  expect(weightedPick(items, w, () => 0.99)).toBe('c');
  expect(weightedPick(items, () => 0, () => 0.5)).toBeNull();
});

test('picks a weighted place, then a weighted station that is allowed', async () => {
  const places = [place('p1', 'PT', 1), place('p2', 'PT', 9)];
  const stations = [st('a', 'p1', 5), st('b', 'p2', 100), st('c', 'p2', 1)];
  const r = await pickSurprise({ places, weightOf: (p) => p.count, stationsOf: async () => stations, isBlocked: (id) => id === 'b', random: () => 0.5 });
  expect(r).toMatchObject({ place: { id: 'p2' }, station: { id: 'c' } });
});

test('language filter: only places and stations in the language', async () => {
  const places = [place('p1', 'PT', 5, { pt: 5 }), place('es', 'ES', 1, { es: 1 })];
  const stationsOf = vi.fn(async (cc: string) => (cc === 'ES' ? [st('e', 'es', 1, ['es'], 'ES')] : [st('a', 'p1', 1)]));
  const r = await pickSurprise({ places, weightOf: (p) => p.langs?.es ?? 0, stationsOf, isBlocked: () => false, filter: (s) => s.langs.includes('es'), random: () => 0.1 });
  expect(r!.station.id).toBe('e');
});

test('tries other places when one has nothing allowed; null when nothing at all', async () => {
  const places = [place('p1', 'PT', 1), place('p2', 'PT', 1)];
  const stations = [st('a', 'p1', 1), st('b', 'p2', 1)];
  let k = 0;
  const random = () => [0.1, 0.1, 0.9, 0.1][k++ % 4];
  const r = await pickSurprise({ places, weightOf: () => 1, stationsOf: async () => stations, isBlocked: (id) => id === 'a', random });
  expect(r!.station.id).toBe('b');
  expect(await pickSurprise({ places, weightOf: () => 1, stationsOf: async () => stations, isBlocked: () => true, random: () => 0.5 })).toBeNull();
});

test('a country file that fails to load is skipped', async () => {
  const places = [place('p1', 'PT', 1), place('fr', 'FR', 1)];
  let k = 0;
  const random = () => [0.9, 0.1, 0.1, 0.1][k++ % 4];
  const stationsOf = async (cc: string) => { if (cc === 'FR') throw new Error('net'); return [st('a', 'p1', 1)]; };
  const r = await pickSurprise({ places, weightOf: () => 1, stationsOf, isBlocked: () => false, random });
  expect(r!.station.id).toBe('a');
});
