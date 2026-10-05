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

test('every cluster can be opened: views reach the zoom where clusters split (no endless cluster clicks)', async () => {
  const { CLUSTER_MAX_ZOOM } = await import('../src/map/cluster');
  const { zoomToAltitude, scaleToZoom, MIN_ALTITUDE, MAX_SCALE } = await import('../src/map/zoom');
  const dense = Array.from({ length: 50 }, (_, i) => p(`d${i}`, 48 + i * 0.01, 11 + i * 0.01, 1));
  const c = createClusterer(dense);
  for (let z = 0; z <= CLUSTER_MAX_ZOOM; z++) {
    for (const item of c.items(z)) if (item.type === 'cluster') expect(item.zoomTo).toBeLessThanOrEqual(CLUSTER_MAX_ZOOM + 1);
  }
  expect(c.items(CLUSTER_MAX_ZOOM + 1).every((i) => i.type === 'place')).toBe(true);
  expect(zoomToAltitude(CLUSTER_MAX_ZOOM + 1)).toBeGreaterThanOrEqual(MIN_ALTITUDE);
  expect(scaleToZoom(MAX_SCALE)).toBeGreaterThanOrEqual(CLUSTER_MAX_ZOOM + 1);
});

test('weighted clusterer counts only the weight and skips zero-weight places', async () => {
  const withLangs: Place[] = [
    { ...p('a', 48.1, 11.5, 3), langs: { es: 2 } },
    { ...p('b', 48.2, 11.6, 4), langs: {} },
    { ...p('far', -33.9, 151.2, 1), langs: { es: 1 } },
  ];
  const items = createClusterer(withLangs, (pl) => pl.langs?.es ?? 0).items(12);
  expect(items.map((i) => [i.key, i.count])).toEqual(expect.arrayContaining([['a', 2], ['far', 1]]));
  expect(items.find((i) => i.key === 'b')).toBeUndefined();
});

test('layered source: muted base first, teal highlight on top; no highlight = base as is', async () => {
  const { layered } = await import('../src/map/cluster');
  const base = createClusterer(places);
  const hi = createClusterer([places[3]]);
  expect(layered(base, null).items(12)).toEqual(base.items(12));
  const items = layered(base, hi).items(12);
  // A teal place is not duplicated underneath: one dot, one tooltip, on both views.
  expect(items.filter((i) => i.tone === 'muted')).toHaveLength(3);
  expect(items.filter((i) => i.key === 'far')).toHaveLength(1);
  expect(items.at(-1)).toMatchObject({ key: 'far', tone: 'teal' });
});
