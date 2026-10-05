import { expect, test, vi } from 'vitest';
import { createLibrary, FAVORITES_KEY, HISTORY_LIMIT, toSaved } from '../src/library/library';

class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }
const s = (id: string) => ({ id, name: `R ${id}`, placeId: 'c:1', cc: 'PT', favicon: '' });

test('toSaved keeps only what the tabs need', () => {
  expect(toSaved({ id: 'a', name: 'A', url: 'https://x', placeId: 'c:1', cc: 'PT', langs: ['pt'], tags: [], votes: 0, clicks: 3, favicon: 'https://i', hls: false }))
    .toEqual({ id: 'a', name: 'A', placeId: 'c:1', cc: 'PT', favicon: 'https://i' });
});

test('favorites: toggle on/off, newest first, persisted', () => {
  const st = new Mem() as unknown as Storage;
  const lib = createLibrary(st);
  expect(lib.toggleFavorite(s('a'))).toBe(true);
  lib.toggleFavorite(s('b'));
  expect(lib.favorites().map((x) => x.id)).toEqual(['b', 'a']);
  expect(lib.isFavorite('a')).toBe(true);
  expect(lib.toggleFavorite(s('a'))).toBe(false);
  expect(createLibrary(st).favorites().map((x) => x.id)).toEqual(['b']);
});

test('history: newest first, no duplicates, at most 20', () => {
  const lib = createLibrary(new Mem() as unknown as Storage);
  for (let i = 0; i < 25; i++) lib.remember(s(String(i)));
  lib.remember(s('10'));
  const ids = lib.history().map((x) => x.id);
  expect(ids).toHaveLength(HISTORY_LIMIT);
  expect(ids[0]).toBe('10');
  expect(ids.filter((x) => x === '10')).toHaveLength(1);
});

test('subscribers hear changes', () => {
  const lib = createLibrary(null);
  const l = vi.fn();
  lib.subscribe(l);
  lib.toggleFavorite(s('a'));
  lib.remember(s('a'));
  expect(l).toHaveBeenCalledTimes(2);
});

test('no storage, throwing storage and corrupt data are tolerated', () => {
  const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } } as unknown as Storage;
  const lib = createLibrary(bad);
  expect(() => lib.toggleFavorite(s('a'))).not.toThrow();
  expect(lib.isFavorite('a')).toBe(true);
  const st = new Mem() as unknown as Storage;
  st.setItem(FAVORITES_KEY, '{"oops":1}');
  expect(createLibrary(st).favorites()).toEqual([]);
  st.setItem(FAVORITES_KEY, '[{"id":1},{"id":"a","name":"A","placeId":"c:1","cc":"PT","favicon":""}]');
  expect(createLibrary(st).favorites().map((x) => x.id)).toEqual(['a']);
});
