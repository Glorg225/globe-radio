import { expect, test, vi } from 'vitest';
import type { Place } from '../src/data/places';
import type { StationLite } from '../src/data/shards';
import { findNextNearby } from '../src/player/next-nearby';

const place = (id: string, lat: number, lon: number, cc = 'DE'): Place => ({ id, lat, lon, kind: 'exact', cc, nameRu: '', name: id, count: 1, pop: 1 });
const st = (id: string, placeId: string, clicks: number, cc = 'DE'): StationLite =>
  ({ id, name: id, url: 'https://x', placeId, cc, langs: [], tags: [], votes: 0, clicks, favicon: '', hls: false });

const A = place('A', 0, 0), B = place('B', 0, 1), C = place('C', 0, 5), F = place('F', 0, 0.5, 'FR');
const de = [st('cur', 'A', 100), st('a2', 'A', 50), st('b1', 'B', 5), st('b2', 'B', 9), st('c1', 'C', 1)];
const fr = [st('f1', 'F', 3, 'FR')];
const stationsOf = vi.fn(async (cc: string) => (cc === 'DE' ? de : fr));

test('prefers another station in the current place', async () => {
  const r = await findNextNearby({ currentId: 'cur', currentPlace: A, places: [C, B, A], stationsOf, isBlocked: () => false });
  expect(r!.station.id).toBe('a2');
  expect(r!.place.id).toBe('A');
});

test('skips current and blocked stations, then takes the most popular in the nearest place', async () => {
  const r = await findNextNearby({ currentId: 'cur', currentPlace: A, places: [C, B, A], stationsOf, isBlocked: (id) => id === 'a2' });
  expect(r!.station.id).toBe('b2');
});

test('loads another country when its place is nearer', async () => {
  const r = await findNextNearby({ currentId: 'cur', currentPlace: A, places: [B, A, F], stationsOf, isBlocked: (id) => id === 'a2' });
  expect(stationsOf).toHaveBeenCalledWith('FR');
  expect(r!.station.id).toBe('f1');
});

test('respects an extra filter (for Plan 4 language mode)', async () => {
  const r = await findNextNearby({ currentId: 'cur', currentPlace: A, places: [A, B], stationsOf, isBlocked: () => false, filter: (s) => s.id === 'b1' });
  expect(r!.station.id).toBe('b1');
});

test('returns null when nothing is left', async () => {
  const r = await findNextNearby({ currentId: 'cur', currentPlace: A, places: [A], stationsOf, isBlocked: (id) => id !== 'cur' });
  expect(r).toBeNull();
});

test('a country that fails to load is skipped, not fatal', async () => {
  const failing = async (cc: string) => { if (cc === 'FR') throw new Error('net'); return de; };
  const r = await findNextNearby({ currentId: 'cur', currentPlace: A, places: [A, F, B], stationsOf: failing, isBlocked: (id) => id === 'a2' });
  expect(r!.station.id).toBe('b2');
});
