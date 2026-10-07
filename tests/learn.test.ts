import { expect, test, vi } from 'vitest';
import type { Place } from '../src/data/places';
import type { StationLite } from '../src/data/shards';
import { prepositional } from '../src/i18n/ru-grammar';
import { buildLanguageIndex, lowerFirst, searchLanguages } from '../src/learn/language-index';
import { createLearnState, LEARN_KEY } from '../src/learn/learn-state';
import { isTalk } from '../src/learn/talk';

const place = (id: string, cc: string, langs: Record<string, number>): Place =>
  ({ id, lat: 0, lon: 0, kind: 'exact', cc, nameRu: '', name: id, count: 1, pop: 1, langs });
const places = [
  place('m', 'ES', { es: 12, ca: 3 }),
  place('b', 'AR', { es: 5 }),
  place('l', 'PT', { pt: 4 }),
  place('x', 'ES', { zz: 9 }),
];

test('language index: counts stations and countries, sorted by stations, capitalized names', () => {
  const idx = buildLanguageIndex(places, 'ru');
  expect(idx.map((e) => e.code)).toEqual(['es', 'pt', 'ca']);
  expect(idx[0]).toEqual({ code: 'es', name: 'Испанский', stations: 17, countries: 2 });
});

test('search by name fragment and by exact code, case-insensitive', () => {
  const idx = buildLanguageIndex(places, 'ru');
  expect(searchLanguages(idx, 'исп').map((e) => e.code)).toEqual(['es']);
  expect(searchLanguages(idx, 'PT').map((e) => e.code)).toEqual(['pt']);
  expect(searchLanguages(idx, '  ')).toHaveLength(3);
  expect(searchLanguages(idx, 'клингонский')).toEqual([]);
});

test('lowerFirst', () => expect(lowerFirst('Испанский', 'ru')).toBe('испанский'));

test('Russian prepositional case of language names', () => {
  expect(prepositional('испанский')).toBe('испанском');
  expect(prepositional('английский')).toBe('английском');
  expect(prepositional('латынь')).toBe('латыни');
  expect(prepositional('иврит')).toBe('иврите');
  expect(prepositional('хинди')).toBe('хинди');
  expect(prepositional('суахили')).toBe('суахили');
});

test('talk stations are tagged news or talk', () => {
  const st = (tags: string[]) => ({ tags } as StationLite);
  expect(isTalk(st(['news']))).toBe(true);
  expect(isTalk(st(['pop', 'talk']))).toBe(true);
  expect(isTalk(st(['newsy', 'pop']))).toBe(false);
});

class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }

test('learn state: set, toggle off by selecting again, remember, notify', () => {
  const s = new Mem() as unknown as Storage;
  const st = createLearnState(s, () => true);
  const seen: (string | null)[] = [];
  st.subscribe((c) => seen.push(c));
  st.set('es');
  expect(st.get()).toBe('es');
  expect(s.getItem(LEARN_KEY)).toBe('es');
  st.set(null);
  expect(s.getItem(LEARN_KEY)).toBeNull();
  expect(seen).toEqual(['es', null]);
  expect(createLearnState(s, () => true).get()).toBeNull();
});

test('learn state restores a known language and silently drops an unknown one (review focus 2)', () => {
  const s = new Mem() as unknown as Storage;
  s.setItem(LEARN_KEY, 'es');
  expect(createLearnState(s, (c) => c === 'es').get()).toBe('es');
  s.setItem(LEARN_KEY, 'tlh');
  const gone = createLearnState(s, (c) => c === 'es');
  expect(gone.get()).toBeNull();
  expect(s.getItem(LEARN_KEY)).toBeNull();
});

test('learn state works without storage or with throwing storage', () => {
  const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } } as unknown as Storage;
  const st = createLearnState(bad, () => true);
  expect(() => st.set('es')).not.toThrow();
  expect(st.get()).toBe('es');
  const none = createLearnState(null, () => true);
  none.set('pt');
  expect(none.get()).toBe('pt');
});

test('setting the same value twice notifies once', () => {
  const st = createLearnState(null, () => true);
  const l = vi.fn();
  st.subscribe(l);
  st.set('es');
  st.set('es');
  expect(l).toHaveBeenCalledTimes(1);
});

test('review: English language names keep their capital letter', async () => {
  const { languageNames } = await import('../src/place-card/language');
  expect(lowerFirst('Spanish', 'en')).toBe('Spanish');
  expect(languageNames(['es', 'ca'], 'en')).toBe('Spanish, Catalan');
  expect(languageNames(['es'], 'ru')).toBe('испанский');
});
