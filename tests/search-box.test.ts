import { afterEach, beforeEach, expect, test, vi, type Mock } from 'vitest';
import ru from '../locales/ru.json';
import type { Place } from '../src/data/places';
import { createI18n } from '../src/i18n/i18n';
import type { SearchHit, SearchResult } from '../src/search/search-index';
import { createSearchBox, SEARCH_DEBOUNCE_MS } from '../src/ui/search-box';

const i18n = createI18n('ru', ru);
const lisbon: Place = { id: 'c:1', lat: 0, lon: 0, kind: 'exact', cc: 'PT', nameRu: 'Лиссабон', name: 'Lisbon', count: 1, pop: 1 };
const result: SearchResult = { places: [lisbon], stations: [{ name: 'Fado <b>Lisboa</b>', place: lisbon }] };
let input: HTMLInputElement;
let d: { search: Mock<(q: string) => Promise<SearchResult>>; placeLabel: (p: Place) => string; onPlace: Mock<(p: Place) => void>; onStation: Mock<(h: SearchHit) => void> };
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<header><label class="search"><input type="search"></label></header><main></main>';
  input = document.querySelector('input')!;
  d = { search: vi.fn(async () => result), placeLabel: () => 'Лиссабон, Португалия', onPlace: vi.fn(), onStation: vi.fn() };
});
afterEach(() => vi.useRealTimers());
const type = async (v: string) => { input.value = v; input.dispatchEvent(new Event('input')); await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS); };
const pop = () => document.querySelector('.search-pop') as HTMLElement | null;

test('shows places and stations sections; station names are text', async () => {
  createSearchBox(input, i18n, d);
  await type('lis');
  expect(pop()!.textContent).toContain('Места');
  expect(pop()!.textContent).toContain('Станции');
  expect(pop()!.querySelector('b')).toBeNull();
  expect(pop()!.textContent).toContain('Fado <b>Lisboa</b>');
  expect(pop()!.textContent).toContain('Лиссабон, Португалия');
});

test('one character closes; empty result says nothing found', async () => {
  createSearchBox(input, i18n, d);
  await type('l');
  expect(pop()).toBeNull();
  d.search.mockResolvedValueOnce({ places: [], stations: [] });
  await type('zzz');
  expect(pop()!.textContent).toContain('Ничего не найдено');
});

test('while the index loads a loading line is shown; only the latest query is rendered (review focus 4)', async () => {
  let releaseFirst!: (r: SearchResult) => void;
  d.search.mockImplementationOnce(() => new Promise((r) => { releaseFirst = r; }));
  d.search.mockImplementationOnce(async () => ({ places: [], stations: [{ name: 'Second', place: lisbon }] }));
  createSearchBox(input, i18n, d);
  await type('li');
  expect(pop()!.textContent).toContain('Загружаем станции…');
  await type('lis');
  releaseFirst(result);
  await vi.advanceTimersByTimeAsync(0);
  expect(pop()!.textContent).toContain('Second');
  expect(pop()!.textContent).not.toContain('Fado');
});

test('load error shows a message', async () => {
  d.search.mockRejectedValueOnce(new Error('net'));
  createSearchBox(input, i18n, d);
  await type('lis');
  expect(pop()!.textContent).toContain('Не удалось загрузить поиск');
});

test('click and keyboard pick; Esc closes; picking clears the field', async () => {
  createSearchBox(input, i18n, d);
  await type('lis');
  (pop()!.querySelectorAll('.search-pop__item')[1] as HTMLButtonElement).click();
  expect(d.onStation).toHaveBeenCalledWith(result.stations[0]);
  expect(pop()).toBeNull();
  expect(input.value).toBe('');
  await type('lis');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(d.onPlace).toHaveBeenCalledWith(lisbon);
  await type('lis');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(pop()).toBeNull();
});

test('click outside closes', async () => {
  createSearchBox(input, i18n, d);
  await type('lis');
  document.querySelector('main')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  expect(pop()).toBeNull();
});

test('a region is marked so it differs from the city of the same name', async () => {
  const region: Place = { ...lisbon, id: 'a:PT.14', kind: 'region', count: 23 };
  d.search.mockResolvedValueOnce({ places: [lisbon, region], stations: [] });
  createSearchBox(input, i18n, d);
  await type('lis');
  const subs = [...pop()!.querySelectorAll('.search-pop__sub')].map((s) => s.textContent);
  expect(subs).toEqual(['1 станция', 'Регион · 23 станции']);
});

test('focusing the field starts loading the index (spec: first click)', () => {
  const prefetch = vi.fn();
  createSearchBox(input, i18n, { ...d, prefetch });
  input.dispatchEvent(new FocusEvent('focus'));
  expect(prefetch).toHaveBeenCalled();
});

test('combobox semantics: expanded state, active option announced, Tab closes', async () => {
  createSearchBox(input, i18n, d);
  expect(input.getAttribute('role')).toBe('combobox');
  expect(input.getAttribute('aria-expanded')).toBe('false');
  await type('lis');
  expect(input.getAttribute('aria-expanded')).toBe('true');
  expect(input.getAttribute('aria-controls')).toBe(pop()!.id);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  const first = pop()!.querySelector('.search-pop__item')!;
  expect(input.getAttribute('aria-activedescendant')).toBe(first.id);
  expect(first.getAttribute('aria-selected')).toBe('true');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  expect(pop()).toBeNull();
  expect(input.getAttribute('aria-expanded')).toBe('false');
});

test('Enter between a new keystroke and its results does not run the old result', async () => {
  createSearchBox(input, i18n, d);
  await type('lis');
  input.value = 'lisb';
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(d.onPlace).not.toHaveBeenCalled();
  expect(d.onStation).not.toHaveBeenCalled();
});
