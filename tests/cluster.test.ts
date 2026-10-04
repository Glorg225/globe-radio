import { expect, test } from 'vitest';
import type { Place } from '../src/data/places';
import { createClusterer } from '../src/map/cluster';

const p = (id: string, lat: number, lon: number, count: number): Place =>
  ({ id, lat, lon, kind: 'exact', cc: 'DE', nameRu: '', name: id, count, pop: count * 10 });
const places = [p('a', 48.1, 11.5, 3), p('b', 48.2, 11.6, 4), p('c', 48.15, 11.55, 5), p('far', -33.9, 151.2, 1)];

test('far zoom groups nearby places and sums stations and popularity', () => {
  const items = createClusterer(places).items(0);
  const cluster = items.find((i) => i.type === 'cluster')!;
  expect(cluster).toMatchObject({ count: 12, pop: 120 });
  expect(cluster.type === 'cluster' && cluster.zoomTo).toBeGreaterThan(0);
  expect(items.find((i) => i.type === 'place')).toMatchObject({ key: 'far', count: 1 });
});

test('close zoom shows every place', () => {
  const items = createClusterer(places).items(12);
  expect(items.map((i) => i.key).sort()).toEqual(['a', 'b', 'c', 'far']);
  expect(items.every((i) => i.type === 'place')).toBe(true);
});

test('fractional zoom is floored', () => {
  const c = createClusterer(places);
  expect(c.items(0.9).length).toBe(c.items(0).length);
});
