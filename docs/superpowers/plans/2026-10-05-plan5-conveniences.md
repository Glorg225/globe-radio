# План 5: поиск, избранное, история, «Удиви меня», «Поделиться», таймер сна — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Удобства этапа 6 ТЗ: поиск по собственному индексу, избранное и история, «Удиви меня» с учётом языка, «Поделиться» со ссылкой и карточкой «Вам прислали станцию», таймер сна с затуханием.

**Architecture:** Чистые модули логики (`search`, `library`, `surprise`, `sleep-timer`, `share`) тестируются отдельно; UI-модули (`search-box`, вкладки и звёзды, кнопки плеера, меню сна, карточка ссылки) получают данные и колбэки; контроллер `app.ts` связывает их с картой, списком и плеером. Индекс поиска `search.json` собирается при снимке и грузится лениво.

**Tech Stack:** TypeScript, Vitest + jsdom, Web Share API / Clipboard API, `@resvg/resvg-js` (только для разовой генерации картинки превью).

**Spec:** `docs/superpowers/specs/2026-10-05-plan5-conveniences-design.md` (+ `docs/02_tz.md` §4.5–4.9, `docs/03_design.md` §6.1, §6.4, `design/mockups/MobileShare.dc.html`).

## Global Constraints

- Ни одной строки интерфейса в `src/` — только `locales/ru.json`.
- Данные станций в разметку — только `textContent` / `escapeHtml`.
- Цвета — только токены `src/ui/tokens.css`.
- Хранилище браузера может быть недоступно — всё работает без сохранения и без исключений.
- Первая загрузка не растёт: `search.json` грузится только при первом обращении к поиску.
- Ссылка: `?station=<stationuuid>&c=<CC>`; без `c` — страна через Radio Browser `/json/stations/byuuid/<id>`.
- История — 20 последних; затухание сна — последние 10 с; варианты сна — 15 / 30 / 60 / 90 мин и «Выкл».
- На телефоне системное меню «Поделиться», на ПК — копирование в буфер.

## Review Focus

1. **Ссылка на станцию, которой больше нет в данных** (или битый `id`) → уведомление «Станция из ссылки больше не вещает», обычный вид, без ошибок (тест в Task 4).
2. **Пользователь закрыл системное меню «Поделиться»** (AbortError) → без уведомления «Не удалось…», без копирования (тест в Task 4).
3. **Сон во время паузы или ошибки станции; ручное изменение громкости во время затухания** → таймер всё равно завершается, громкость после него — прежняя (тест в Task 3).
4. **Быстрый ввод в поиск до загрузки индекса** → показывается «Загружаем станции…», затем результаты последнего запроса, не первого (тест в Task 5).
5. **Избранное из станции, удалённой из снимка** → «Станция больше не вещает», звезду можно снять (тест в Task 8).

---

## File Structure

```
scripts/build-snapshot.ts, scripts/snapshot.ts — search.json (searchRows)
src/search/search-index.ts   — нормализация, загрузка индекса, поиск мест и станций
src/library/library.ts       — избранное и история
src/player/surprise.ts       — «Удиви меня» (взвешенный случайный выбор)
src/player/sleep-timer.ts    — таймер сна с затуханием
src/share/share-link.ts      — сборка/разбор ссылки, поиск станции по ссылке
src/share/share.ts           — системное меню или буфер обмена
src/ui/search-box.ts         — выпадающие результаты поиска
src/ui/station-list.ts       — активная звезда, список сохранённых станций
src/ui/player-bar.ts         — звезда, «Поделиться», «Сон» в плеере
src/ui/sleep-menu.ts         — меню вариантов сна
src/ui/share-card.ts         — карточка «Вам прислали станцию»
src/ui/conveniences.css      — стили
src/ui/shell.ts              — data-tab у вкладок, ссылки на поле поиска и вкладки
scripts/og-image.ts, public/og.png, index.html — превью ссылки
src/app/app.ts, src/app/main.ts, .github/workflows/deploy.yml, locales/ru.json, README.md
```

---

### Task 1: Индекс поиска и сам поиск

**Files:**
- Create: `src/search/search-index.ts`, `tests/search.test.ts`
- Modify: `scripts/build-snapshot.ts`, `scripts/snapshot.ts`, `tests/build-snapshot.test.ts`

**Interfaces:**
- Consumes: `Place` (План 2), `StationLite`, `countryName`, `placeTitle`.
- Produces:
  - `searchRows(shards: Map<string, StationLite[]>): [name: string, placeId: string][]` — все станции, по кликам по убыванию (`scripts/build-snapshot.ts`)
  - `interface SearchFile { v: 1; stations: [string, string][] }`
  - `normalizeText(s: string): string`
  - `interface SearchHit { name: string; place: Place }`; `interface SearchResult { places: Place[]; stations: SearchHit[] }`
  - `createSearchIndex(baseUrl: string, places: Place[], locale: string, fetchFn?: typeof fetch): { search(query: string): Promise<SearchResult> }` — грузит `data/search.json` один раз (повтор после ошибки), запрос < 2 символов → пустой результат

- [ ] **Step 1: Тесты**

В `tests/build-snapshot.test.ts` дописать:
```ts
test('search rows: every station as [name, placeId], most clicked first', async () => {
  const { searchRows } = await import('../scripts/build-snapshot');
  const shards = new Map([
    ['DE', [{ ...decodeStation(['a', 'Alpha', 'https://x', 'c:1', '', '', 0, 5, '', 0], 'DE') }]],
    ['FR', [{ ...decodeStation(['b', 'Beta', 'https://x', 'c:2', '', '', 0, 9, '', 0], 'FR') }]],
  ]);
  expect(searchRows(shards)).toEqual([['Beta', 'c:2'], ['Alpha', 'c:1']]);
});
```

`tests/search.test.ts`:
```ts
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
```

- [ ] **Step 2: Run** `npx vitest run tests/search.test.ts tests/build-snapshot.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`scripts/build-snapshot.ts` — дописать:
```ts
export function searchRows(shards: Map<string, StationLite[]>): [string, string][] {
  return [...shards.values()].flat().sort((a, b) => b.clicks - a.clicks).map((s) => [s.name, s.placeId]);
}
```
`scripts/snapshot.ts` — импорт `searchRows` и после записи `places.json`:
```ts
writeFileSync('public/data/search.json', JSON.stringify({ v: 1, stations: searchRows(shards) }));
```

`src/search/search-index.ts`:
```ts
import { countryName } from '../data/place-name';
import type { Place } from '../data/places';

export interface SearchFile { v: 1; stations: [string, string][] }
export interface SearchHit { name: string; place: Place }
export interface SearchResult { places: Place[]; stations: SearchHit[] }

const MAX_PLACES = 5;
const MAX_STATIONS = 8;
const EMPTY: SearchResult = { places: [], stations: [] };

export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// 0 — the text starts with the query, 1 — a word starts with it, 2 — it occurs inside, -1 — no match.
function score(text: string, q: string): number {
  const i = text.indexOf(q);
  if (i < 0) return -1;
  if (i === 0) return 0;
  return /[\s\-(«"'.,/]/.test(text[i - 1]) ? 1 : 2;
}

export function createSearchIndex(baseUrl: string, places: Place[], locale: string, fetchFn: typeof fetch = fetch) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const placeNames = places.map((p) => ({
    p,
    names: (p.kind === 'country' ? [countryName(p.cc, locale), p.name, p.nameRu] : [p.nameRu, p.name]).filter(Boolean).map(normalizeText),
  }));
  let rows: Promise<{ name: string; norm: string; place: Place }[]> | null = null;

  async function load() {
    const r = await fetchFn(`${baseUrl}data/search.json`);
    if (!r.ok) throw new Error(`search HTTP ${r.status}`);
    const body = (await r.json()) as Partial<SearchFile>;
    if (body.v !== 1 || !Array.isArray(body.stations)) throw new Error('unsupported search format');
    return body.stations
      .map(([name, placeId]) => ({ name, norm: normalizeText(name), place: byId.get(placeId)! }))
      .filter((r) => r.place);
  }

  return {
    async search(query: string): Promise<SearchResult> {
      const q = normalizeText(query.trim());
      if (q.length < 2) return EMPTY;
      if (!rows) {
        rows = load();
        rows.catch(() => { rows = null; });
      }
      const list = await rows;
      const foundPlaces = placeNames
        .map(({ p, names }) => ({ p, s: Math.min(...names.map((n) => { const v = score(n, q); return v < 0 ? 9 : v; })) }))
        .filter((x) => x.s < 9)
        .sort((a, b) => a.s - b.s || b.p.count - a.p.count)
        .slice(0, MAX_PLACES)
        .map((x) => x.p);
      const buckets: SearchHit[][] = [[], [], []];
      for (const r of list) {
        const s = score(r.norm, q);
        if (s >= 0 && buckets[s].length < MAX_STATIONS) buckets[s].push({ name: r.name, place: r.place });
        if (buckets[0].length >= MAX_STATIONS) break;
      }
      return { places: foundPlaces, stations: buckets.flat().slice(0, MAX_STATIONS) };
    },
  };
}
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Живой снимок** — `npm run snapshot`, затем:
```bash
node -e "const z=require('zlib'),f=require('fs');const b=f.readFileSync('public/data/search.json');console.log('search.json gzip',z.gzipSync(b).length, JSON.parse(b).stations.length)"
```
Expected: ≈ 400 000 байт gzip, ≈ 37 700 строк.

- [ ] **Step 6: Commit** `feat(search): search index file and place/station search`

---

### Task 2: Избранное и история

**Files:**
- Create: `src/library/library.ts`, `tests/library.test.ts`

**Interfaces:**
- Produces:
  - `interface SavedStation { id: string; name: string; placeId: string; cc: string; favicon: string }`
  - `toSaved(s: StationLite): SavedStation`
  - `FAVORITES_KEY = 'favorites'`, `HISTORY_KEY = 'history'`, `HISTORY_LIMIT = 20`
  - `interface Library { favorites(): SavedStation[]; history(): SavedStation[]; isFavorite(id: string): boolean; toggleFavorite(s: SavedStation): boolean; remember(s: SavedStation): void; subscribe(l: () => void): () => void }`
  - `createLibrary(storage: Storage | null): Library`

- [ ] **Step 1: Тесты** — `tests/library.test.ts`:
```ts
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
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация** — `src/library/library.ts`:
```ts
import type { StationLite } from '../data/shards';

export interface SavedStation { id: string; name: string; placeId: string; cc: string; favicon: string }
export interface Library {
  favorites(): SavedStation[];
  history(): SavedStation[];
  isFavorite(id: string): boolean;
  toggleFavorite(s: SavedStation): boolean;
  remember(s: SavedStation): void;
  subscribe(l: () => void): () => void;
}

export const FAVORITES_KEY = 'favorites';
export const HISTORY_KEY = 'history';
export const HISTORY_LIMIT = 20;

export const toSaved = (s: StationLite): SavedStation => ({ id: s.id, name: s.name, placeId: s.placeId, cc: s.cc, favicon: s.favicon });

const isSaved = (x: unknown): x is SavedStation => {
  const o = x as Record<string, unknown> | null;
  return !!o && ['id', 'name', 'placeId', 'cc', 'favicon'].every((k) => typeof o[k] === 'string');
};

export function createLibrary(storage: Storage | null): Library {
  const read = (key: string): SavedStation[] => {
    try {
      const v: unknown = JSON.parse(storage?.getItem(key) ?? '[]');
      return Array.isArray(v) ? v.filter(isSaved) : [];
    } catch { return []; }
  };
  const write = (key: string, list: SavedStation[]) => { try { storage?.setItem(key, JSON.stringify(list)); } catch { /* unavailable */ } };
  let favs = read(FAVORITES_KEY);
  let hist = read(HISTORY_KEY);
  const listeners = new Set<() => void>();
  const notify = () => { for (const l of listeners) l(); };

  return {
    favorites: () => favs,
    history: () => hist,
    isFavorite: (id) => favs.some((x) => x.id === id),
    toggleFavorite(s) {
      const on = !favs.some((x) => x.id === s.id);
      favs = on ? [s, ...favs] : favs.filter((x) => x.id !== s.id);
      write(FAVORITES_KEY, favs);
      notify();
      return on;
    },
    remember(s) {
      hist = [s, ...hist.filter((x) => x.id !== s.id)].slice(0, HISTORY_LIMIT);
      write(HISTORY_KEY, hist);
      notify();
    },
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(library): favorites and history`

---

### Task 3: «Удиви меня» и таймер сна (логика)

**Files:**
- Create: `src/player/surprise.ts`, `src/player/sleep-timer.ts`, `tests/surprise.test.ts`, `tests/sleep-timer.test.ts`

**Interfaces:**
- Produces:
  - `weightedPick<T>(items: T[], weight: (x: T) => number, random: () => number): T | null`
  - `interface SurpriseQuery { places: Place[]; weightOf(p: Place): number; stationsOf(cc: string): Promise<StationLite[]>; isBlocked(id: string): boolean; filter?: (s: StationLite) => boolean; random?: () => number; attempts?: number }`
  - `pickSurprise(q: SurpriseQuery): Promise<{ station: StationLite; place: Place } | null>`
  - `SLEEP_OPTIONS = [15, 30, 60, 90] as const`; `FADE_MS = 10_000`
  - `interface SleepTimer { start(minutes: number): void; cancel(): void; minutesLeft(): number | null; subscribe(l: () => void): () => void }`
  - `createSleepTimer(d: { getVolume(): number; setVolume(v: number): void; stop(): void; now?: () => number }): SleepTimer`

- [ ] **Step 1: Тесты**

`tests/surprise.test.ts`:
```ts
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
```

`tests/sleep-timer.test.ts`:
```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createSleepTimer, FADE_MS, SLEEP_OPTIONS } from '../src/player/sleep-timer';

let volume: number;
let stop: ReturnType<typeof vi.fn>;
const make = () => createSleepTimer({ getVolume: () => volume, setVolume: (v) => { volume = v; }, stop });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); volume = 0.8; stop = vi.fn(); });
afterEach(() => vi.useRealTimers());

test('options are 15/30/60/90 minutes', () => expect([...SLEEP_OPTIONS]).toEqual([15, 30, 60, 90]));

test('minutes left counts down (rounded up) and notifies every minute', () => {
  const t = make();
  const l = vi.fn();
  t.subscribe(l);
  t.start(15);
  expect(t.minutesLeft()).toBe(15);
  vi.advanceTimersByTime(60_000 * 2 + 1);
  expect(t.minutesLeft()).toBe(13);
  expect(l.mock.calls.length).toBeGreaterThanOrEqual(3);
});

test('fades out over the last 10 s, stops, then restores the volume and turns itself off', () => {
  const t = make();
  t.start(15);
  vi.advanceTimersByTime(15 * 60_000 - FADE_MS + FADE_MS / 2);
  expect(volume).toBeGreaterThan(0.3);
  expect(volume).toBeLessThan(0.5);
  vi.advanceTimersByTime(FADE_MS / 2 + 500);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(volume).toBe(0.8);
  expect(t.minutesLeft()).toBeNull();
});

test('cancel during the fade restores the volume and does not stop', () => {
  const t = make();
  t.start(15);
  vi.advanceTimersByTime(15 * 60_000 - FADE_MS / 2);
  t.cancel();
  expect(volume).toBe(0.8);
  vi.advanceTimersByTime(FADE_MS);
  expect(stop).not.toHaveBeenCalled();
  expect(t.minutesLeft()).toBeNull();
});

test('restarting replaces the previous timer', () => {
  const t = make();
  t.start(15);
  t.start(30);
  vi.advanceTimersByTime(16 * 60_000);
  expect(stop).not.toHaveBeenCalled();
  expect(t.minutesLeft()).toBe(14);
});

test('volume changed by hand during the fade: the timer still ends and restores the pre-fade volume (review focus 3)', () => {
  const t = make();
  t.start(15);
  vi.advanceTimersByTime(15 * 60_000 - FADE_MS + 1000);
  volume = 1;
  vi.advanceTimersByTime(FADE_MS);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(volume).toBe(0.8);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/player/surprise.ts`:
```ts
import type { Place } from '../data/places';
import type { StationLite } from '../data/shards';

export function weightedPick<T>(items: T[], weight: (x: T) => number, random: () => number): T | null {
  const ws = items.map((x) => Math.max(0, weight(x)));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    if (ws[i] <= 0) continue;
    if (r < ws[i]) return items[i];
    r -= ws[i];
  }
  for (let i = items.length - 1; i >= 0; i--) if (ws[i] > 0) return items[i];
  return null;
}

export interface SurpriseQuery {
  places: Place[];
  weightOf(p: Place): number;
  stationsOf(cc: string): Promise<StationLite[]>;
  isBlocked(id: string): boolean;
  filter?: (s: StationLite) => boolean;
  random?: () => number;
  attempts?: number;
}

// A random place (weighted by station count), then a station in it — popular ones a little more often.
export async function pickSurprise(q: SurpriseQuery): Promise<{ station: StationLite; place: Place } | null> {
  const random = q.random ?? Math.random;
  const tried = new Set<string>();
  for (let i = 0; i < (q.attempts ?? 5); i++) {
    const place = weightedPick(q.places.filter((p) => !tried.has(p.id)), q.weightOf, random);
    if (!place) return null;
    tried.add(place.id);
    let list: StationLite[];
    try { list = await q.stationsOf(place.cc); } catch { continue; }
    const candidates = list.filter((s) => s.placeId === place.id && !q.isBlocked(s.id) && (q.filter?.(s) ?? true));
    const station = weightedPick(candidates, (s) => Math.log(s.clicks + 2), random);
    if (station) return { station, place };
  }
  return null;
}
```

`src/player/sleep-timer.ts`:
```ts
export const SLEEP_OPTIONS = [15, 30, 60, 90] as const;
export const FADE_MS = 10_000;
const STEP_MS = 250;

export interface SleepTimer { start(minutes: number): void; cancel(): void; minutesLeft(): number | null; subscribe(l: () => void): () => void }

export function createSleepTimer(d: { getVolume(): number; setVolume(v: number): void; stop(): void; now?: () => number }): SleepTimer {
  const now = d.now ?? Date.now;
  const listeners = new Set<() => void>();
  let endsAt: number | null = null;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let fadeFrom: number | null = null;
  const notify = () => { for (const l of listeners) l(); };

  function clear() {
    for (const t of timers) { clearTimeout(t); clearInterval(t); }
    timers = [];
    if (fadeFrom !== null) d.setVolume(fadeFrom);
    fadeFrom = null;
    endsAt = null;
  }

  function finish() {
    const restore = fadeFrom ?? d.getVolume();
    fadeFrom = null;
    clear();
    d.stop();
    d.setVolume(restore);
    notify();
  }

  return {
    start(minutes) {
      clear();
      endsAt = now() + minutes * 60_000;
      const total = endsAt - now();
      timers.push(setInterval(notify, 60_000));
      timers.push(setTimeout(() => {
        fadeFrom = d.getVolume();
        const from = fadeFrom;
        const started = now();
        timers.push(setInterval(() => {
          const k = Math.min(1, (now() - started) / FADE_MS);
          d.setVolume(from * (1 - k));
          if (k >= 1) finish();
        }, STEP_MS));
      }, Math.max(0, total - FADE_MS)));
      notify();
    },
    cancel() { clear(); notify(); },
    minutesLeft: () => (endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now()) / 60_000))),
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(player): surprise pick and sleep timer with fade-out`

---

### Task 4: «Поделиться» — ссылка, поиск станции, меню/буфер

**Files:**
- Create: `src/share/share-link.ts`, `src/share/share.ts`, `tests/share.test.ts`

**Interfaces:**
- Consumes: `MIRRORS` (План 2), `ShardStore`, `Place`, `StationLite`.
- Produces:
  - `buildShareUrl(pageUrl: string, s: Pick<StationLite, 'id' | 'cc'>): string`
  - `parseShareParams(search: string): { id: string; cc: string | null } | null`
  - `stripShareParams(url: string): string`
  - `resolveShared(p: { id: string; cc: string | null }, d: { places: Place[]; shards: ShardStore; fetchFn?: typeof fetch; mirrors?: readonly string[] }): Promise<{ station: StationLite; place: Place } | null>`
  - `shareStation(o: { url: string; title: string; text: string; preferShare: boolean; nav: { share?: (d: ShareData) => Promise<void>; clipboard?: { writeText(s: string): Promise<void> } } }): Promise<'shared' | 'copied' | 'cancelled' | 'failed'>`

- [ ] **Step 1: Тесты** — `tests/share.test.ts`:
```ts
import { expect, test, vi } from 'vitest';
import type { Place } from '../src/data/places';
import type { ShardStore, StationLite } from '../src/data/shards';
import { shareStation } from '../src/share/share';
import { buildShareUrl, parseShareParams, resolveShared, stripShareParams } from '../src/share/share-link';

const ID = '96062a7b-0601-11e8-ae97-52543be04c81';
const place: Place = { id: 'c:1', lat: 0, lon: 0, kind: 'exact', cc: 'PT', nameRu: 'Лиссабон', name: 'Lisbon', count: 1, pop: 1 };
const station: StationLite = { id: ID, name: 'Fado', url: 'https://x', placeId: 'c:1', cc: 'PT', langs: [], tags: [], votes: 0, clicks: 0, favicon: '', hls: false };
const shards = (list: StationLite[]): ShardStore => ({ get: vi.fn(async () => list), info: vi.fn(async () => new Map()) });

test('share url keeps the page path and replaces other parameters', () => {
  expect(buildShareUrl('https://u.github.io/globe-radio/?lang=ru#x', station))
    .toBe(`https://u.github.io/globe-radio/?station=${ID}&c=PT`);
});

test('parse share params validates id and country', () => {
  expect(parseShareParams(`?station=${ID}&c=PT`)).toEqual({ id: ID, cc: 'PT' });
  expect(parseShareParams(`?station=${ID}`)).toEqual({ id: ID, cc: null });
  expect(parseShareParams(`?station=${ID}&c=xx1`)).toEqual({ id: ID, cc: null });
  expect(parseShareParams('?station=<script>')).toBeNull();
  expect(parseShareParams('?lang=ru')).toBeNull();
});

test('strip share params leaves other parameters', () =>
  expect(stripShareParams(`https://a/b/?station=${ID}&c=PT&lang=ru`)).toBe('https://a/b/?lang=ru'));

test('resolves via the country file', async () => {
  expect(await resolveShared({ id: ID, cc: 'PT' }, { places: [place], shards: shards([station]) })).toEqual({ station, place });
});

test('without a country asks Radio Browser for it', async () => {
  const f = vi.fn(async () => new Response(JSON.stringify([{ countrycode: 'PT' }])));
  const r = await resolveShared({ id: ID, cc: null }, { places: [place], shards: shards([station]), fetchFn: f as unknown as typeof fetch, mirrors: ['m1'] });
  expect(r).toEqual({ station, place });
  expect((f.mock.calls[0] as unknown[])[0]).toBe(`https://m1/json/stations/byuuid/${ID}`);
});

test('station gone from the data, or lookup failure → null (review focus 1)', async () => {
  expect(await resolveShared({ id: ID, cc: 'PT' }, { places: [place], shards: shards([]) })).toBeNull();
  const down = (async () => { throw new Error('net'); }) as unknown as typeof fetch;
  expect(await resolveShared({ id: ID, cc: null }, { places: [place], shards: shards([station]), fetchFn: down, mirrors: ['m1'] })).toBeNull();
  const broken: ShardStore = { get: async () => { throw new Error('net'); }, info: async () => new Map() };
  expect(await resolveShared({ id: ID, cc: 'PT' }, { places: [place], shards: broken })).toBeNull();
});

const opts = { url: 'https://x', title: 'Fado', text: 'Слушаю «Fado» — Лиссабон' };

test('phones use the system share sheet', async () => {
  const share = vi.fn(async () => {});
  expect(await shareStation({ ...opts, preferShare: true, nav: { share } })).toBe('shared');
  expect(share).toHaveBeenCalledWith({ url: 'https://x', title: 'Fado', text: 'Слушаю «Fado» — Лиссабон' });
});

test('closing the share sheet is not an error and does not copy (review focus 2)', async () => {
  const writeText = vi.fn(async () => {});
  const share = vi.fn(async () => { throw new DOMException('cancel', 'AbortError'); });
  expect(await shareStation({ ...opts, preferShare: true, nav: { share, clipboard: { writeText } } })).toBe('cancelled');
  expect(writeText).not.toHaveBeenCalled();
});

test('desktop copies the link; copy failure is reported', async () => {
  const writeText = vi.fn(async () => {});
  expect(await shareStation({ ...opts, preferShare: false, nav: { share: vi.fn(), clipboard: { writeText } } })).toBe('copied');
  expect(writeText).toHaveBeenCalledWith('https://x');
  expect(await shareStation({ ...opts, preferShare: false, nav: { clipboard: { writeText: async () => { throw new Error('denied'); } } } })).toBe('failed');
  expect(await shareStation({ ...opts, preferShare: false, nav: {} })).toBe('failed');
});

test('share sheet error other than cancel falls back to copying', async () => {
  const writeText = vi.fn(async () => {});
  const share = vi.fn(async () => { throw new DOMException('no', 'NotAllowedError'); });
  expect(await shareStation({ ...opts, preferShare: true, nav: { share, clipboard: { writeText } } })).toBe('copied');
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/share/share-link.ts`:
```ts
import { MIRRORS } from '../data/mirrors';
import type { Place } from '../data/places';
import type { ShardStore, StationLite } from '../data/shards';

const ID_RE = /^[0-9a-f-]{36}$/i;

export function buildShareUrl(pageUrl: string, s: Pick<StationLite, 'id' | 'cc'>): string {
  const u = new URL(pageUrl);
  u.search = '';
  u.hash = '';
  u.searchParams.set('station', s.id);
  u.searchParams.set('c', s.cc);
  return u.toString();
}

export function parseShareParams(search: string): { id: string; cc: string | null } | null {
  const p = new URLSearchParams(search);
  const id = p.get('station') ?? '';
  if (!ID_RE.test(id)) return null;
  const cc = (p.get('c') ?? '').toUpperCase();
  return { id: id.toLowerCase(), cc: /^[A-Z]{2}$/.test(cc) ? cc : null };
}

export function stripShareParams(url: string): string {
  const u = new URL(url);
  u.searchParams.delete('station');
  u.searchParams.delete('c');
  return u.toString();
}

async function countryOf(id: string, fetchFn: typeof fetch, mirrors: readonly string[]): Promise<string | null> {
  for (const host of mirrors) {
    try {
      const r = await fetchFn(`https://${host}/json/stations/byuuid/${id}`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) continue;
      const list = (await r.json()) as { countrycode?: string }[];
      const cc = (list[0]?.countrycode ?? '').toUpperCase();
      return /^[A-Z]{2}$/.test(cc) ? cc : null;
    } catch { /* next mirror */ }
  }
  return null;
}

export async function resolveShared(
  p: { id: string; cc: string | null },
  d: { places: Place[]; shards: ShardStore; fetchFn?: typeof fetch; mirrors?: readonly string[] },
): Promise<{ station: StationLite; place: Place } | null> {
  const cc = p.cc ?? await countryOf(p.id, d.fetchFn ?? fetch, d.mirrors ?? MIRRORS);
  if (!cc) return null;
  try {
    const station = (await d.shards.get(cc)).find((s) => s.id === p.id);
    const place = station && d.places.find((pl) => pl.id === station.placeId);
    return station && place ? { station, place } : null;
  } catch {
    return null;
  }
}
```

`src/share/share.ts`:
```ts
export async function shareStation(o: {
  url: string; title: string; text: string; preferShare: boolean;
  nav: { share?: (d: ShareData) => Promise<void>; clipboard?: { writeText(s: string): Promise<void> } };
}): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (o.preferShare && o.nav.share) {
    try {
      await o.nav.share({ url: o.url, title: o.title, text: o.text });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    if (!o.nav.clipboard) return 'failed';
    await o.nav.clipboard.writeText(o.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(share): share links, shared-station lookup, share sheet or clipboard`

---

### Task 5: Поле поиска с выпадающими результатами

**Files:**
- Create: `src/ui/search-box.ts`, `src/ui/conveniences.css`, `tests/search-box.test.ts`
- Modify: `locales/ru.json`, `src/ui/shell.ts` (импорт `./conveniences.css`)

**Interfaces:**
- Consumes: `SearchResult`, `SearchHit` (Task 1), `Place`.
- Produces: `interface SearchBoxDeps { search(q: string): Promise<SearchResult>; placeLabel(p: Place): string; onPlace(p: Place): void; onStation(h: SearchHit): void }`; `createSearchBox(input: HTMLInputElement, i18n: I18n, d: SearchBoxDeps): { close(): void }`; `SEARCH_DEBOUNCE_MS = 150`.

- [ ] **Step 1: Тексты** — добавить в `locales/ru.json` (все ключи Плана 5 сразу):
```json
  "search.places": "Места",
  "search.stations": "Станции",
  "search.empty": "Ничего не найдено",
  "search.loading": "Загружаем станции…",
  "search.error": "Не удалось загрузить поиск",
  "library.emptyFavorites": "Здесь будут станции, отмеченные звёздочкой",
  "library.emptyHistory": "Здесь появятся станции, которые вы слушали",
  "library.gone": "Станция больше не вещает",
  "station.unfavorite": "Убрать из избранного",
  "surprise.none": "Не удалось найти станцию, попробуйте ещё раз",
  "share.copied": "Ссылка скопирована",
  "share.failed": "Не удалось скопировать ссылку",
  "share.text": "Слушаю «{station}» — {place}",
  "share.title": "Вам прислали станцию",
  "share.listen": "Слушать",
  "share.note": "Браузер включает звук только после нажатия — поэтому нужна эта кнопка.",
  "share.openGlobe": "Открыть глобус",
  "share.gone": "Станция из ссылки больше не вещает",
  "share.placeTime": "{place} · {time}",
  "sleep.title": "Таймер сна",
  "sleep.minutes": "{m} мин",
  "sleep.off": "Выкл",
  "sleep.active": "Сон · {m} мин"
```

- [ ] **Step 2: Тест** — `tests/search-box.test.ts`:
```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import type { Place } from '../src/data/places';
import { createI18n } from '../src/i18n/i18n';
import type { SearchResult } from '../src/search/search-index';
import { createSearchBox, SEARCH_DEBOUNCE_MS } from '../src/ui/search-box';

const i18n = createI18n('ru', ru);
const lisbon: Place = { id: 'c:1', lat: 0, lon: 0, kind: 'exact', cc: 'PT', nameRu: 'Лиссабон', name: 'Lisbon', count: 1, pop: 1 };
const result: SearchResult = { places: [lisbon], stations: [{ name: 'Fado <b>Lisboa</b>', place: lisbon }] };
let input: HTMLInputElement;
let d: { search: ReturnType<typeof vi.fn>; placeLabel: (p: Place) => string; onPlace: ReturnType<typeof vi.fn>; onStation: ReturnType<typeof vi.fn> };
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
```

- [ ] **Step 3: Run** → FAIL.

- [ ] **Step 4: Реализация**

`src/ui/search-box.ts`:
```ts
import type { Place } from '../data/places';
import type { I18n } from '../i18n/i18n';
import type { SearchHit, SearchResult } from '../search/search-index';

export const SEARCH_DEBOUNCE_MS = 150;
export interface SearchBoxDeps { search(q: string): Promise<SearchResult>; placeLabel(p: Place): string; onPlace(p: Place): void; onStation(h: SearchHit): void }

export function createSearchBox(input: HTMLInputElement, i18n: I18n, d: SearchBoxDeps): { close(): void } {
  const anchor = input.closest('label') ?? input;
  let pop: HTMLElement | null = null;
  let token = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let actions: (() => void)[] = [];
  let active = -1;

  const onOutside = (e: MouseEvent) => { if (pop && !pop.contains(e.target as Node) && !anchor.contains(e.target as Node)) close(); };
  function close() {
    token++;
    pop?.remove();
    pop = null;
    actions = [];
    active = -1;
    document.removeEventListener('mousedown', onOutside);
  }
  function ensurePop(): HTMLElement {
    if (!pop) {
      pop = document.createElement('div');
      pop.className = 'search-pop';
      pop.setAttribute('role', 'listbox');
      anchor.insertAdjacentElement('afterend', pop);
      document.addEventListener('mousedown', onOutside);
    }
    return pop;
  }
  function message(text: string) {
    const p = document.createElement('p');
    p.className = 'search-pop__msg';
    p.textContent = text;
    ensurePop().replaceChildren(p);
    actions = [];
  }
  function item(title: string, sub: string, run: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'search-pop__item';
    b.setAttribute('role', 'option');
    const t = document.createElement('span');
    t.className = 'search-pop__name';
    t.textContent = title;
    const s = document.createElement('span');
    s.className = 'search-pop__sub';
    s.textContent = sub;
    b.append(t, s);
    const go = () => { close(); input.value = ''; run(); };
    b.addEventListener('click', go);
    actions.push(go);
    return b;
  }
  function render(r: SearchResult) {
    if (!r.places.length && !r.stations.length) { message(i18n.t('search.empty')); return; }
    const host = ensurePop();
    host.replaceChildren();
    actions = [];
    active = -1;
    const section = (title: string) => { const h = document.createElement('p'); h.className = 'search-pop__title'; h.textContent = title; host.append(h); };
    if (r.places.length) {
      section(i18n.t('search.places'));
      for (const p of r.places) host.append(item(d.placeLabel(p), i18n.t('stations.count', { count: p.count }), () => d.onPlace(p)));
    }
    if (r.stations.length) {
      section(i18n.t('search.stations'));
      for (const h of r.stations) host.append(item(h.name, d.placeLabel(h.place), () => d.onStation(h)));
    }
  }
  function highlight() {
    pop?.querySelectorAll('.search-pop__item').forEach((el, i) => el.classList.toggle('is-active', i === active));
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { close(); return; }
    const my = ++token;
    timer = setTimeout(() => {
      if (my !== token) return;
      let done = false;
      void Promise.resolve().then(() => { if (!done && my === token) message(i18n.t('search.loading')); });
      d.search(q).then(
        (r) => { done = true; if (my === token) render(r); },
        () => { done = true; if (my === token) message(i18n.t('search.error')); },
      );
    }, SEARCH_DEBOUNCE_MS);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (!actions.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + actions.length) % actions.length;
      highlight();
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      actions[active]();
    }
  });
  return { close };
}
```
Примечание к тесту «loading…»: первый запрос не завершён — после `type('li')` микрозадача показывает «Загружаем станции…»; второй `type('lis')` увеличивает `token`, поэтому поздний ответ первого запроса не рисуется.

`src/ui/conveniences.css` (начало; дополняется в Task 6–7):
```css
.shell__header label.search { position: relative; }
.search-pop { position: absolute; z-index: 20; inset-block-start: 60px; inline-size: min(520px, calc(100vw - 32px)); max-block-size: 70vh; overflow-y: auto; padding: 8px; border-radius: var(--r-card); background: var(--surface-raised); border: 1px solid var(--border-popover); scrollbar-width: thin; scrollbar-color: var(--border-control) transparent; }
.search-pop__title { margin: 8px 10px 4px; font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--text-muted); }
.search-pop__item { display: flex; flex-direction: column; inline-size: 100%; gap: 2px; padding: 8px 10px; border: 0; border-radius: 10px; background: transparent; color: var(--text); text-align: start; }
.search-pop__item:hover, .search-pop__item.is-active { background: var(--item-selected); }
.search-pop__name { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-pop__sub { font-size: 13px; color: var(--text-muted); }
.search-pop__msg { margin: 10px; color: var(--text-muted); font-size: 14px; }
```
В `src/ui/shell.ts` — `import './conveniences.css';` рядом с `./learn.css`.

- [ ] **Step 5: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 6: Commit** `feat(ui): search box with places and stations`

---

### Task 6: Звёзды, вкладки «Избранное» / «История»

**Files:**
- Modify: `src/ui/station-list.ts`, `src/ui/shell.ts`, `src/ui/conveniences.css`, `tests/station-list.test.ts`, `tests/shell.test.ts`

**Interfaces:**
- Consumes: `SavedStation` (Task 2).
- Produces:
  - `StationListProps.favorites?: { isFavorite(id: string): boolean; onToggle(s: StationLite): void }`; `StationListHandle.refreshFavorites(): void`
  - `interface SavedListProps { items: SavedStation[]; playingId: string | null; empty: string; sub(item: SavedStation): string; onPick(item: SavedStation): void; isFavorite(id: string): boolean; onToggleFavorite(item: SavedStation): void }`; `renderSavedList(host: HTMLElement, i18n: I18n, p: SavedListProps): void`
  - `ShellRefs` + `tabs: HTMLButtonElement[]` (у кнопок `data-tab="here|favorites|history"`), `searchInput: HTMLInputElement`, `surpriseButton: HTMLButtonElement`

- [ ] **Step 1: Тесты**

В `tests/shell.test.ts`:
```ts
test('tabs, search input and surprise button are exposed', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.tabs.map((b) => b.dataset.tab)).toEqual(['here', 'favorites', 'history']);
  expect(refs.searchInput.type).toBe('search');
  expect(refs.surpriseButton.dataset.action).toBe('surprise');
});
```

В `tests/station-list.test.ts`:
```ts
test('active stars when favorites are wired: pressed state, toggle, refresh', () => {
  const favs = new Set(['b']);
  const onToggle = vi.fn((s: StationLite) => { if (favs.has(s.id)) favs.delete(s.id); else favs.add(s.id); });
  const list = renderStationList(el, i18n, {
    title: 'X', subtitle: '', stations: [st('a', 'A'), st('b', 'B')], playingId: null, onPick() {},
    favorites: { isFavorite: (id) => favs.has(id), onToggle },
  });
  const stars = [...el.querySelectorAll('.station__star')] as HTMLButtonElement[];
  expect(stars[0].disabled).toBe(false);
  expect(stars[1].getAttribute('aria-pressed')).toBe('true');
  expect(stars[1].getAttribute('aria-label')).toBe('Убрать из избранного');
  stars[0].click();
  expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  list.refreshFavorites();
  expect(stars[0].getAttribute('aria-pressed')).toBe('true');
});

test('saved list: rows with place subtitle, empty message, pick and unstar', async () => {
  const { renderSavedList } = await import('../src/ui/station-list');
  const onPick = vi.fn();
  const onToggleFavorite = vi.fn();
  const item = { id: 'a', name: 'Fado', placeId: 'c:1', cc: 'PT', favicon: '' };
  renderSavedList(el, i18n, { items: [item], playingId: 'a', empty: 'Пусто', sub: () => 'Лиссабон, Португалия', onPick, isFavorite: () => true, onToggleFavorite });
  expect(el.querySelector('.station__name')!.textContent).toBe('Fado');
  expect(el.querySelector('.station__tags')!.textContent).toBe('Лиссабон, Португалия');
  expect(el.querySelector('.station.is-playing')).not.toBeNull();
  (el.querySelector('.station__pick') as HTMLButtonElement).click();
  (el.querySelector('.station__star') as HTMLButtonElement).click();
  expect(onPick).toHaveBeenCalledWith(item);
  expect(onToggleFavorite).toHaveBeenCalledWith(item);
  renderSavedList(el, i18n, { items: [], playingId: null, empty: 'Пусто', sub: () => '', onPick, isFavorite: () => false, onToggleFavorite });
  expect(el.textContent).toBe('Пусто');
});
```
(Тест «favorite star is visible but disabled until Plan 5» остаётся: без `favorites` звезда по-прежнему неактивна.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/ui/shell.ts`:
- вкладки: `<button class="tabs__tab is-active" data-tab="here">…`, `<button class="tabs__tab" data-tab="favorites">…`, `<button class="tabs__tab" data-tab="history">…`
- `ShellRefs` + `tabs: HTMLButtonElement[]; searchInput: HTMLInputElement; surpriseButton: HTMLButtonElement;`
- в возврате: `tabs: [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')], searchInput: q<HTMLInputElement>('.search input'), surpriseButton: q<HTMLButtonElement>('[data-action="surprise"]'),`

`src/ui/station-list.ts`:
- импорт `import type { SavedStation } from '../library/library';`
- `StationListProps` + `favorites?: { isFavorite(id: string): boolean; onToggle(s: StationLite): void };`
- `StationListHandle` → `{ setPlaying(id: string | null): void; refreshFavorites(): void }`
- вспомогательная функция (над `renderStationList`):
```ts
function paintStar(star: HTMLButtonElement, i18n: I18n, on: boolean) {
  star.setAttribute('aria-pressed', String(on));
  star.classList.toggle('is-fav', on);
  star.setAttribute('aria-label', i18n.t(on ? 'station.unfavorite' : 'station.favorite'));
}
```
- создание звезды в `renderStationList` заменить:
```ts
    const star = el('button', 'station__star');
    star.type = 'button';
    star.innerHTML = icons.star;
    if (p.favorites) {
      const fav = p.favorites;
      paintStar(star, i18n, fav.isFavorite(s.id));
      star.addEventListener('click', () => { fav.onToggle(s); paintStar(star, i18n, fav.isFavorite(s.id)); });
    } else {
      star.disabled = true;
      star.setAttribute('aria-label', i18n.t('station.favorite'));
      star.title = i18n.t('common.soon');
    }
    stars.set(s.id, star);
```
(перед циклом: `const stars = new Map<string, HTMLButtonElement>();`)
- в возвращаемый объект: `refreshFavorites() { if (p.favorites) for (const [id, star] of stars) paintStar(star, i18n, p.favorites.isFavorite(id)); },`
- новая функция:
```ts
export interface SavedListProps {
  items: SavedStation[]; playingId: string | null; empty: string;
  sub(item: SavedStation): string; onPick(item: SavedStation): void;
  isFavorite(id: string): boolean; onToggleFavorite(item: SavedStation): void;
}

export function renderSavedList(host: HTMLElement, i18n: I18n, p: SavedListProps): void {
  if (!p.items.length) { renderListMessage(host, p.empty); return; }
  const list = el('ul', 'stations');
  for (const item of p.items) {
    const row = el('li', item.id === p.playingId ? 'station is-playing' : 'station');
    const pick = el('button', 'station__pick');
    pick.type = 'button';
    const text = el('span', 'station__text');
    text.append(el('span', 'station__name', item.name), el('span', 'station__tags', p.sub(item)));
    pick.append(tile({ name: item.name, favicon: item.favicon } as StationLite), text);
    pick.addEventListener('click', () => p.onPick(item));
    const star = el('button', 'station__star');
    star.type = 'button';
    star.innerHTML = icons.star;
    paintStar(star, i18n, p.isFavorite(item.id));
    star.addEventListener('click', () => p.onToggleFavorite(item));
    row.append(pick, star);
    list.append(row);
  }
  host.replaceChildren(list);
}
```

`src/ui/conveniences.css` — дописать:
```css
.station__star.is-fav, .pb__star.is-fav { color: var(--accent); }
.station__star.is-fav svg, .pb__star.is-fav svg { fill: currentColor; }
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(ui): working favorite stars, saved-station lists, tab and search refs`

---

### Task 7: Плеер — звезда, «Поделиться», «Сон»; меню сна; карточка «Вам прислали станцию»

**Files:**
- Create: `src/ui/sleep-menu.ts`, `src/ui/share-card.ts`, `tests/player-extras.test.ts`
- Modify: `src/ui/player-bar.ts`, `src/ui/conveniences.css`

**Interfaces:**
- Produces:
  - `PlayerBarHandlers` + `onFavorite?(): void; onShare?(): void; onSleep?(anchor: HTMLElement): void`
  - `PlayerBarView` + `favorite?: boolean; sleepLabel?: string`
  - `openSleepMenu(anchor: HTMLElement, i18n: I18n, current: number | null, onPick: (minutes: number | null) => void): { close(): void }`
  - `interface ShareCardData { name: string; flag: string | null; line: string }`; `showShareCard(host: HTMLElement, i18n: I18n, data: ShareCardData, h: { onListen(): void; onClose(): void }): { close(): void }`

- [ ] **Step 1: Тест** — `tests/player-extras.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import type { StationLite } from '../src/data/shards';
import { createI18n } from '../src/i18n/i18n';
import { createPlayerBar } from '../src/ui/player-bar';
import { showShareCard } from '../src/ui/share-card';
import { openSleepMenu } from '../src/ui/sleep-menu';

const i18n = createI18n('ru', ru);
const station: StationLite = { id: 'a', name: 'Fado', url: 'https://x', placeId: 'p', cc: 'PT', langs: [], tags: [], votes: 0, clicks: 0, favicon: '', hls: false };
let el: HTMLElement;
beforeEach(() => { document.body.innerHTML = '<footer></footer><main></main>'; el = document.querySelector('footer')!; });
const q = (s: string) => el.querySelector(s) as HTMLButtonElement;

test('player star, share and sleep become active with handlers and a station', () => {
  const h = { onToggle: vi.fn(), onNext: vi.fn(), onVolume: vi.fn(), onMute: vi.fn(), onFavorite: vi.fn(), onShare: vi.fn(), onSleep: vi.fn() };
  const bar = createPlayerBar(el, i18n, h);
  bar.render({ state: { kind: 'idle' }, place: '', volume: 1, muted: false });
  expect(q('.pb__star').disabled).toBe(true);
  expect(q('.pb__share').disabled).toBe(true);
  bar.render({ state: { kind: 'playing', station }, place: 'X', volume: 1, muted: false, favorite: true, sleepLabel: 'Сон · 23 мин' });
  expect(q('.pb__star').disabled).toBe(false);
  expect(q('.pb__star').getAttribute('aria-pressed')).toBe('true');
  expect(q('.pb__sleep').disabled).toBe(false);
  expect(q('.pb__sleep').textContent).toContain('Сон · 23 мин');
  q('.pb__star').click();
  q('.pb__share').click();
  q('.pb__sleep').click();
  expect(h.onFavorite).toHaveBeenCalled();
  expect(h.onShare).toHaveBeenCalled();
  expect(h.onSleep).toHaveBeenCalledWith(q('.pb__sleep'));
  bar.render({ state: { kind: 'playing', station }, place: 'X', volume: 1, muted: false, favorite: false });
  expect(q('.pb__sleep').textContent).toContain('Сон');
  expect(q('.pb__sleep').textContent).not.toContain('мин');
});

test('sleep menu lists options, marks the current one, picks and closes', () => {
  const anchor = document.createElement('button');
  el.append(anchor);
  const onPick = vi.fn();
  openSleepMenu(anchor, i18n, 30, onPick);
  const items = [...document.querySelectorAll('.sleep-menu button')];
  expect(items.map((b) => b.textContent)).toEqual(['15 мин', '30 мин', '60 мин', '90 мин', 'Выкл']);
  expect(items[1].getAttribute('aria-checked')).toBe('true');
  (items[0] as HTMLButtonElement).click();
  expect(onPick).toHaveBeenCalledWith(15);
  expect(document.querySelector('.sleep-menu')).toBeNull();
  openSleepMenu(anchor, i18n, null, onPick);
  ([...document.querySelectorAll('.sleep-menu button')].at(-1) as HTMLButtonElement).click();
  expect(onPick).toHaveBeenLastCalledWith(null);
  openSleepMenu(anchor, i18n, null, onPick);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(document.querySelector('.sleep-menu')).toBeNull();
});

test('share card per mockup: title, name, line, listen and open-globe', () => {
  const host = document.querySelector('main')!;
  const h = { onListen: vi.fn(), onClose: vi.fn() };
  showShareCard(host, i18n, { name: 'Fado <b>Lisboa</b>', flag: '/pt.svg', line: 'Лиссабон, Португалия · 14:32' }, h);
  const card = host.querySelector('.share-card') as HTMLElement;
  expect(card.getAttribute('role')).toBe('dialog');
  expect(card.textContent).toContain('Вам прислали станцию');
  expect(card.querySelector('b')).toBeNull();
  expect(card.textContent).toContain('Fado <b>Lisboa</b>');
  expect(card.textContent).toContain('Лиссабон, Португалия · 14:32');
  expect(card.textContent).toContain('Браузер включает звук только после нажатия');
  expect(document.activeElement).toBe(card.querySelector('.share-card__listen'));
  expect(host.classList.contains('is-dimmed')).toBe(true);
  (card.querySelector('.share-card__listen') as HTMLButtonElement).click();
  expect(h.onListen).toHaveBeenCalled();
  expect(host.querySelector('.share-card')).toBeNull();
  expect(host.classList.contains('is-dimmed')).toBe(false);
  showShareCard(host, i18n, { name: 'X', flag: null, line: '' }, h);
  (host.querySelector('.share-card__globe') as HTMLButtonElement).click();
  expect(h.onClose).toHaveBeenCalled();
  expect(host.querySelector('.share-card')).toBeNull();
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/ui/player-bar.ts`:
- `PlayerBarHandlers` → `{ onToggle(): void; onNext(): void; onVolume(v: number): void; onMute(): void; onFavorite?(): void; onShare?(): void; onSleep?(anchor: HTMLElement): void }`
- `PlayerBarView` → `{ state: PlayerState; place: string; volume: number; muted: boolean; nextLabel?: string; favorite?: boolean; sleepLabel?: string }`
- в шаблоне звезда, сон и «Поделиться» — без `disabled`/`title` (состояние ставит `render`): `<button class="pb__star">${icons.star}</button>`, `<button class="btn btn--outline pb__sleep">${icons.moon}<span>${t('player.sleep')}</span></button>`, `<button class="btn btn--outline btn--icon pb__share" aria-label="${t('player.share')}">${icons.share}</button>`
- после получения `range`:
```ts
  const star = q<HTMLButtonElement>('.pb__star');
  const sleep = q<HTMLButtonElement>('.pb__sleep');
  const sleepLabel = sleep.querySelector('span')!;
  const share = q<HTMLButtonElement>('.pb__share');
  star.addEventListener('click', () => h.onFavorite?.());
  share.addEventListener('click', () => h.onShare?.());
  sleep.addEventListener('click', () => h.onSleep?.(sleep));
  const soon = (b: HTMLButtonElement, enabled: boolean) => {
    b.disabled = !enabled;
    if (enabled) b.removeAttribute('title'); else b.title = i18n.t('common.soon');
  };
```
- в `render` (сигнатура + `favorite`, `sleepLabel: sleepText`) в конце:
```ts
      soon(star, !!h.onFavorite && !!station);
      star.classList.toggle('is-fav', !!favorite);
      star.setAttribute('aria-pressed', String(!!favorite));
      star.setAttribute('aria-label', i18n.t(favorite ? 'station.unfavorite' : 'station.favorite'));
      soon(share, !!h.onShare && !!station);
      soon(sleep, !!h.onSleep);
      sleepLabel.textContent = sleepText ?? i18n.t('player.sleep');
```
(сон доступен и без станции — таймер может быть запущен заранее; тесты Плана 2 без обработчиков остаются зелёными: кнопки неактивны.)

`src/ui/sleep-menu.ts`:
```ts
import type { I18n } from '../i18n/i18n';
import { SLEEP_OPTIONS } from '../player/sleep-timer';

export function openSleepMenu(anchor: HTMLElement, i18n: I18n, current: number | null, onPick: (minutes: number | null) => void): { close(): void } {
  document.querySelector('.sleep-menu')?.remove();
  const menu = document.createElement('div');
  menu.className = 'sleep-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', i18n.t('sleep.title'));
  const options: (number | null)[] = [...SLEEP_OPTIONS, null];
  for (const m of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitemradio');
    b.setAttribute('aria-checked', String(m === current));
    b.textContent = m === null ? i18n.t('sleep.off') : i18n.t('sleep.minutes', { m });
    b.addEventListener('click', () => { close(); onPick(m); });
    menu.append(b);
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); anchor.focus(); } };
  const onOutside = (e: MouseEvent) => { if (!menu.contains(e.target as Node) && e.target !== anchor) close(); };
  function close() {
    menu.remove();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('mousedown', onOutside);
  }
  anchor.insertAdjacentElement('afterend', menu);
  document.addEventListener('keydown', onKey);
  document.addEventListener('mousedown', onOutside);
  (menu.querySelector('[aria-checked="true"]') as HTMLElement | null ?? menu.querySelector('button'))?.focus();
  return { close };
}
```

`src/ui/share-card.ts`:
```ts
import type { I18n } from '../i18n/i18n';
import { escapeHtml } from './html';
import { icons } from './icons';

export interface ShareCardData { name: string; flag: string | null; line: string }

export function showShareCard(host: HTMLElement, i18n: I18n, data: ShareCardData, h: { onListen(): void; onClose(): void }): { close(): void } {
  host.querySelector('.share-card')?.remove();
  const t = (k: string) => escapeHtml(i18n.t(k));
  const card = document.createElement('section');
  card.className = 'share-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', i18n.t('share.title'));
  card.innerHTML = `
    <div class="share-card__label">${t('share.title')}</div>
    <div class="share-card__tile"></div>
    <div class="share-card__name"></div>
    <div class="share-card__line"><img class="share-card__flag" width="24" height="16" alt="" hidden><span></span></div>
    <button class="share-card__listen" type="button">${icons.play}<span>${t('share.listen')}</span></button>
    <p class="share-card__note">${t('share.note')}</p>
    <button class="share-card__globe" type="button">${t('share.openGlobe')}</button>`;
  card.querySelector('.share-card__tile')!.textContent = (data.name.trim()[0] ?? '?').toUpperCase();
  card.querySelector('.share-card__name')!.textContent = data.name;
  card.querySelector('.share-card__line span')!.textContent = data.line;
  const flag = card.querySelector<HTMLImageElement>('.share-card__flag')!;
  if (data.flag) { flag.src = data.flag; flag.hidden = false; }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); h.onClose(); } };
  function close() {
    card.remove();
    host.classList.remove('is-dimmed');
    document.removeEventListener('keydown', onKey);
  }
  card.querySelector('.share-card__listen')!.addEventListener('click', () => { close(); h.onListen(); });
  card.querySelector('.share-card__globe')!.addEventListener('click', () => { close(); h.onClose(); });
  host.classList.add('is-dimmed');
  host.append(card);
  document.addEventListener('keydown', onKey);
  card.querySelector<HTMLButtonElement>('.share-card__listen')!.focus();
  return { close };
}
```

`src/ui/conveniences.css` — дописать (по `03_design.md` §6.4):
```css
.pb__right { position: relative; }
.sleep-menu { position: absolute; z-index: 20; inset-block-end: 56px; display: flex; flex-direction: column; padding: 6px; border-radius: var(--r-card); background: var(--surface-raised); border: 1px solid var(--border-popover); }
.sleep-menu button { padding: 8px 14px; border: 0; border-radius: 10px; background: transparent; color: var(--text); text-align: start; font-size: 14px; }
.sleep-menu button:hover, .sleep-menu button[aria-checked="true"] { background: var(--item-selected); }
.shell__stage.is-dimmed .stage__map { opacity: .35; }
.share-card { position: absolute; z-index: 30; inset-block-start: 50%; inset-inline-start: 50%; transform: translate(-50%, -50%); inline-size: min(360px, calc(100% - 32px)); display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 20px; border-radius: 22px; background: var(--surface-raised); border: 1px solid var(--border-popover); text-align: center; }
.share-card__label { font-size: 13px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--text-muted); }
.share-card__tile { inline-size: 72px; block-size: 72px; border-radius: var(--r-card); background: var(--tile); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 700; font-size: 30px; color: var(--accent); }
.share-card__name { font-family: var(--font-display); font-size: 20px; font-weight: 500; }
.share-card__line { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-muted); }
.share-card__flag { border-radius: 3px; object-fit: cover; }
.share-card__listen { inline-size: 100%; block-size: 56px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: var(--r-control); background: var(--accent); color: var(--on-accent); font-size: 16px; font-weight: 600; }
.share-card__note { margin: 0; font-size: 12px; color: var(--text-faint); }
.share-card__globe { border: 0; background: none; color: var(--link); font-size: 14px; }
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS (в т. ч. старые тесты плеера: без обработчиков звезда и «Поделиться» неактивны).

- [ ] **Step 5: Commit** `feat(ui): player favorite/share/sleep buttons, sleep menu, shared-station card`

---

### Task 8: Превью ссылки — картинка и метатеги

**Files:**
- Create: `scripts/og-image.ts`, `public/og.png` (генерируется), `tests/og-meta.test.ts`
- Modify: `index.html`, `package.json` (скрипт `og`, devDependency `@resvg/resvg-js`), `.github/workflows/deploy.yml`

- [ ] **Step 1: Тест** — `tests/og-meta.test.ts`:
```ts
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('index.html carries Open Graph and Twitter preview tags', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:type', 'twitter:card']) expect(html).toContain(tag);
  expect(html).toContain('%VITE_SITE_URL%/og.png');
});

test('the preview image exists and is a 1200×630 PNG', () => {
  expect(existsSync('public/og.png')).toBe(true);
  const b = readFileSync('public/og.png');
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([1200, 630]);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

```bash
npm i -D @resvg/resvg-js
npm pkg set scripts.og="tsx scripts/og-image.ts"
```

`scripts/og-image.ts`:
```ts
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

// One-off generator for the link preview image (1200×630) in the site's dark/amber style.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g" cx="0.34" cy="0.3" r="0.8"><stop offset="0" stop-color="#1E2C55"/><stop offset="0.55" stop-color="#111A3A"/><stop offset="1" stop-color="#070B1A"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0A0F1E"/>
  <circle cx="930" cy="315" r="250" fill="url(#g)" stroke="#2A3768" stroke-width="2"/>
  ${[[860, 240], [990, 300], [900, 390], [1040, 200], [820, 330], [960, 450], [1080, 360]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#FFB547" opacity="0.9"/>`).join('')}
  <g transform="translate(90 170)" fill="none" stroke="#FFB547" stroke-width="7" stroke-linecap="round">
    <circle cx="45" cy="45" r="40"/><ellipse cx="45" cy="45" rx="18" ry="40"/><path d="M8 32h74M8 58h74"/>
  </g>
  <text x="90" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="700" fill="#EEF1F8">Радио планеты</text>
  <text x="90" y="400" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#A3ADC8">Живое радио со всего мира на глобусе</text>
</svg>`;

const png = new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
writeFileSync('public/og.png', png);
console.log(`public/og.png ${png.length} bytes`);
```
Run: `npm run og` → `public/og.png` создан. Проверить, что `.gitignore` не скрывает `public/og.png` (скрыт только `public/data/`).

`index.html` — в `<head>` после `<meta name="theme-color" …>`:
```html
  <meta name="description" content="Крутите глобус и слушайте живое радио из любого города мира">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Радио планеты">
  <meta property="og:description" content="Крутите глобус и слушайте живое радио из любого города мира">
  <meta property="og:image" content="%VITE_SITE_URL%/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
```
`.github/workflows/deploy.yml` — в шаге `npm run build` к `env:` добавить `VITE_SITE_URL: ${{ steps.pages.outputs.base_url }}`. Для локальной сборки создать `.env` с `VITE_SITE_URL=` (пустое значение — тогда путь `/og.png`).

- [ ] **Step 4: Run** `npx vitest run && npm run build` → PASS; в `dist/index.html` нет текста `%VITE_SITE_URL%`.

- [ ] **Step 5: Commit** `feat(share): link preview image and Open Graph tags`

---

### Task 9: Связка в приложении и приёмка

**Files:**
- Modify: `src/app/app.ts`, `src/app/main.ts`, `tests/app.test.ts`, `README.md`

**Interfaces:**
- Consumes: всё из Tasks 1–8.
- Produces:
  ```ts
  // AppDeps — новые поля
  library: Library;
  sleep: SleepTimer;
  share(o: { url: string; title: string; text: string }): Promise<'shared' | 'copied' | 'cancelled' | 'failed'>;
  createSearch(places: Place[]): { search(q: string): Promise<SearchResult> };
  location: { href: string; search: string };
  replaceUrl(url: string): void;
  flagUrl(cc: string): string | null;
  now(): Date;
  fetchFn?: typeof fetch;
  // AppHandle — новые методы
  surprise(): Promise<void>;
  tab(name: 'here' | 'favorites' | 'history'): void;
  ```

- [ ] **Step 1: Тесты** — в `tests/app.test.ts`:
- импорты: `import { createLibrary } from '../src/library/library';`, `import type { SearchResult } from '../src/search/search-index';`
- в `beforeEach` к `deps`:
```ts
    library: createLibrary(null),
    sleep: { start: vi.fn(), cancel: vi.fn(), minutesLeft: () => null, subscribe: () => () => {} },
    share: vi.fn(async () => 'copied' as const),
    createSearch: () => ({ search: vi.fn(async (): Promise<SearchResult> => ({ places: [porto], stations: [{ name: 'Radio a', place: lisbon }] })) }),
    location: { href: 'https://u.github.io/globe-radio/', search: '' },
    replaceUrl: vi.fn(),
    flagUrl: () => null,
    now: () => new Date(Date.UTC(2026, 0, 15, 14, 32)),
```
- дописать:
```ts
test('history and favorites tabs list saved stations; picking plays them', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  (deps.refs.panelBody.querySelector('.station__star') as HTMLButtonElement).click();
  app.tab('history');
  expect([...deps.refs.panelBody.querySelectorAll('.station__name')].map((n) => n.textContent)).toEqual(['Radio a']);
  app.tab('favorites');
  expect(deps.refs.panelBody.querySelector('.station__tags')!.textContent).toBe('Лиссабон, Португалия');
  expect(deps.refs.tabs[1].classList.contains('is-active')).toBe(true);
  player.set({ kind: 'idle' });
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a' }));
});

test('a favorite that left the data says so and can be unstarred (review focus 5)', async () => {
  deps.library.toggleFavorite({ id: 'gone', name: 'Old FM', placeId: 'c:1', cc: 'PT', favicon: '' });
  const app = await startApp(deps);
  app.tab('favorites');
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.stage.textContent).toContain('Станция больше не вещает');
  (deps.refs.panelBody.querySelector('.station__star') as HTMLButtonElement).click();
  expect(deps.refs.panelBody.textContent).toContain('Здесь будут станции, отмеченные звёздочкой');
});

test('player star follows the playing station', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  (deps.refs.player.querySelector('.pb__star') as HTMLButtonElement).click();
  expect(deps.library.isFavorite('a')).toBe(true);
  expect(deps.refs.player.querySelector('.pb__star')!.getAttribute('aria-pressed')).toBe('true');
  expect(deps.refs.panelBody.querySelector('.station__star')!.getAttribute('aria-pressed')).toBe('true');
});

test('surprise flies to a place, opens it and plays; in learn mode only the language', async () => {
  const app = await startApp(deps);
  app.learn('en');
  await app.surprise();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }));
  expect(globe.views[0].flyTo).toHaveBeenCalledWith(lisbon.lat, lisbon.lon);
  expect(deps.refs.panelBody.querySelector('.list-title')!.textContent).toBe('Лиссабон');
});

test('surprise with nothing to pick shows a notice', async () => {
  const app = await startApp({ ...deps, blacklist: { add: vi.fn(), has: () => true } });
  await app.surprise();
  expect(deps.refs.stage.textContent).toContain('Не удалось найти станцию');
});

test('search: a place opens it, a station plays it', async () => {
  await startApp(deps);
  deps.refs.searchInput.value = 'ра';
  deps.refs.searchInput.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  const items = [...document.querySelectorAll('.search-pop__item')] as HTMLButtonElement[];
  items[0].click();
  await flush();
  expect(deps.refs.panelBody.querySelector('.list-title')!.textContent).toBe('Порту');
  deps.refs.searchInput.value = 'ра';
  deps.refs.searchInput.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  ([...document.querySelectorAll('.search-pop__item')][1] as HTMLButtonElement).click();
  await flush();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a' }));
});

test('share button: link with station and country, copied notice', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  (deps.refs.player.querySelector('.pb__share') as HTMLButtonElement).click();
  await flush();
  expect(deps.share).toHaveBeenCalledWith({ url: 'https://u.github.io/globe-radio/?station=a&c=PT', title: 'Radio a', text: 'Слушаю «Radio a» — Лиссабон, Португалия' });
  expect(deps.refs.stage.textContent).toContain('Ссылка скопирована');
});

test('opening a shared link shows the card; "Слушать" plays the station', async () => {
  const ID = '96062a7b-0601-11e8-ae97-52543be04c81';
  shards.get.mockResolvedValue([{ ...st('x', 'c:1', 1, ['pt']), id: ID }]);
  await startApp({ ...deps, location: { href: `https://u.github.io/globe-radio/?station=${ID}&c=PT`, search: `?station=${ID}&c=PT` } });
  await flush();
  expect(deps.replaceUrl).toHaveBeenCalledWith('https://u.github.io/globe-radio/');
  const card = deps.refs.stage.querySelector('.share-card')!;
  expect(card.textContent).toContain('Radio x');
  expect(card.textContent).toContain('Лиссабон, Португалия · 14:32');
  (card.querySelector('.share-card__listen') as HTMLButtonElement).click();
  await flush();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: ID }));
});

test('a shared link to a missing station shows a notice (review focus 1)', async () => {
  const ID = '96062a7b-0601-11e8-ae97-52543be04c81';
  await startApp({ ...deps, location: { href: `https://u/?station=${ID}&c=PT`, search: `?station=${ID}&c=PT` } });
  await flush();
  expect(deps.refs.stage.querySelector('.share-card')).toBeNull();
  expect(deps.refs.stage.textContent).toContain('Станция из ссылки больше не вещает');
});

test('sleep menu starts the timer and the button shows the minutes left', async () => {
  let left: number | null = null;
  const listeners: (() => void)[] = [];
  const sleep = { start: vi.fn((m: number) => { left = m; listeners.forEach((l) => l()); }), cancel: vi.fn(), minutesLeft: () => left, subscribe: (l: () => void) => { listeners.push(l); return () => {}; } };
  await startApp({ ...deps, sleep });
  (deps.refs.player.querySelector('.pb__sleep') as HTMLButtonElement).click();
  (document.querySelector('.sleep-menu button') as HTMLButtonElement).click();
  expect(sleep.start).toHaveBeenCalledWith(15);
  expect(deps.refs.player.querySelector('.pb__sleep')!.textContent).toContain('Сон · 15 мин');
});
```

- [ ] **Step 2: Run** `npx vitest run tests/app.test.ts` → FAIL.

- [ ] **Step 3: Реализация** `src/app/app.ts`:

Импорты:
```ts
import { createLibrary, toSaved, type Library, type SavedStation } from '../library/library';
import { pickSurprise } from '../player/surprise';
import type { SleepTimer } from '../player/sleep-timer';
import type { SearchResult } from '../search/search-index';
import { buildShareUrl, parseShareParams, resolveShared, stripShareParams } from '../share/share-link';
import { formatClock, isValidTimeZone } from '../place-card/time';
import { createSearchBox } from '../ui/search-box';
import { showShareCard } from '../ui/share-card';
import { openSleepMenu } from '../ui/sleep-menu';
import { renderListMessage, renderSavedList, renderStationList, type StationListHandle } from '../ui/station-list';
```
(`createLibrary` не нужен в app — только тип; импортировать `type Library`.)

`AppDeps` и `AppHandle` — дополнить полями из блока Interfaces.

Состояние (рядом с `let list…`): `let tab: 'here' | 'favorites' | 'history' = 'here';` и `const placeById = () => new Map(places.map((p) => [p.id, p]));` (или поле `let byId = new Map<string, Place>()`, заполняемое после загрузки мест — использовать его).

`renderBar` — добавить поля:
```ts
    favorite: (() => { const s = player.getState(); return s.kind === 'idle' ? false : d.library.isFavorite(s.station.id); })(),
    sleepLabel: d.sleep.minutesLeft() === null ? undefined : t('sleep.active', { m: d.sleep.minutesLeft()! }),
```
`createPlayerBar` — добавить обработчики:
```ts
    onFavorite: () => { const s = player.getState(); if (s.kind !== 'idle') d.library.toggleFavorite(toSaved(s.station)); },
    onShare: () => { void shareCurrent(); },
    onSleep: (anchor) => { openSleepMenu(anchor, i18n, sleepChoice, (m) => { sleepChoice = m; if (m) d.sleep.start(m); else d.sleep.cancel(); }); },
```
и `let sleepChoice: number | null = null;` над ним; `d.sleep.subscribe(() => { if (d.sleep.minutesLeft() === null) sleepChoice = null; renderBar(); });` после создания `bar`.

В `renderStationList(...)` (в `renderList`) добавить:
```ts
        favorites: { isFavorite: (id) => d.library.isFavorite(id), onToggle: (s) => { d.library.toggleFavorite(toSaved(s)); } },
```

Вкладки:
```ts
  function placeOfSaved(item: SavedStation) { return byId.get(item.placeId) ?? null; }
  function savedSub(item: SavedStation) { return placeLabel(placeOfSaved(item)) || countryName(item.cc, i18n.locale); }
  function renderTab() {
    for (const b of refs.tabs) b.classList.toggle('is-active', b.dataset.tab === tab);
    if (tab === 'here') {
      if (selected) void renderList(selected, false);
      else renderListMessage(refs.panelBody, t('panel.empty'));
      return;
    }
    list = null;
    const st = player.getState();
    renderSavedList(refs.panelBody, i18n, {
      items: tab === 'favorites' ? d.library.favorites() : d.library.history(),
      playingId: st.kind === 'idle' ? null : st.station.id,
      empty: t(tab === 'favorites' ? 'library.emptyFavorites' : 'library.emptyHistory'),
      sub: savedSub,
      onPick: (item) => { void playSaved(item); },
      isFavorite: (id) => d.library.isFavorite(id),
      onToggleFavorite: (item) => { d.library.toggleFavorite(item); },
    });
  }
  function setTab(name: typeof tab) { tab = name; renderTab(); }
  for (const b of refs.tabs) b.addEventListener('click', () => setTab(b.dataset.tab as typeof tab));
  d.library.subscribe(() => {
    if (tab !== 'here') renderTab();
    list?.handle.refreshFavorites();
    renderBar();
  });

  async function playSaved(item: SavedStation) {
    const place = placeOfSaved(item);
    let station: StationLite | undefined;
    try { station = (await d.shards.get(item.cc)).find((s) => s.id === item.id); } catch { station = undefined; }
    if (!station || !place) { showToast(refs.stage, t('library.gone')); return; }
    view?.flyTo(place.lat, place.lon);
    await playStation(station, place);
    if (tab !== 'here') renderTab();
  }
```
`selectPlace(p)` — в начале `tab = 'here'; for (const b of refs.tabs) b.classList.toggle('is-active', b.dataset.tab === 'here');`.
`playStation` — после обновления `recent`: `d.library.remember(toSaved(s));`.
В `player.subscribe` — заменить строку `if (list && selected …)` на:
```ts
    if (tab === 'here' && list && selected && list.placeId === selected.id) list.handle.setPlaying(station?.id ?? null);
```

«Удиви меня»:
```ts
  async function surprise() {
    const code = learnCode;
    const found = await pickSurprise({
      places,
      weightOf: (p) => (code ? p.langs?.[code] ?? 0 : p.count),
      stationsOf: (cc) => d.shards.get(cc),
      isBlocked: (id) => d.blacklist.has(id) || recent.includes(id),
      filter: code ? (s) => s.langs.includes(code) : undefined,
    });
    if (!found) { showToast(refs.stage, t('surprise.none')); return; }
    view?.flyTo(found.place.lat, found.place.lon);
    await selectPlace(found.place);
    await playStation(found.station, found.place);
  }
  refs.surpriseButton.addEventListener('click', () => { void surprise(); });
```

«Поделиться»:
```ts
  async function shareCurrent() {
    const s = player.getState();
    if (s.kind === 'idle') return;
    const result = await d.share({
      url: buildShareUrl(d.location.href, s.station),
      title: s.station.name,
      text: t('share.text', { station: s.station.name, place: placeLabel(playingPlace) }),
    });
    if (result === 'copied') showToast(refs.stage, t('share.copied'));
    if (result === 'failed') showToast(refs.stage, t('share.failed'));
  }

  async function openShared() {
    const params = parseShareParams(d.location.search);
    if (!params) return;
    d.replaceUrl(stripShareParams(d.location.href));
    const found = await resolveShared(params, { places, shards: d.shards, fetchFn: d.fetchFn });
    if (!found) { showToast(refs.stage, t('share.gone')); return; }
    view?.flyTo(found.place.lat, found.place.lon);
    void selectPlace(found.place);
    let tz = '';
    try { tz = (await d.shards.info(found.place.cc)).get(found.place.id)?.tz ?? ''; } catch { tz = ''; }
    const where = placeLabel(found.place);
    const line = isValidTimeZone(tz) ? t('share.placeTime', { place: where, time: formatClock(tz, d.now(), i18n.locale) }) : where;
    showShareCard(refs.stage, i18n, { name: found.station.name, flag: d.flagUrl(found.place.cc), line }, {
      onListen: () => { void playStation(found.station, found.place); },
      onClose: () => {},
    });
  }
```

Поиск (после загрузки мест и `applyLearn`):
```ts
  const searchIndex = d.createSearch(places);
  createSearchBox(refs.searchInput, i18n, {
    search: (q) => searchIndex.search(q),
    placeLabel: (p) => placeLabel(p),
    onPlace: (p) => { view?.flyTo(p.lat, p.lon); void selectPlace(p); },
    onStation: async (h) => {
      view?.flyTo(h.place.lat, h.place.lon);
      await selectPlace(h.place);
      try {
        const station = (await d.shards.get(h.place.cc)).find((s) => s.placeId === h.place.id && s.name === h.name);
        if (station) await playStation(station, h.place);
      } catch { /* list shows the load error */ }
    },
  });
```
После `await mountSafe(...)`: `await openShared();`. `handle` — добавить `surprise, tab: setTab`. `byId` заполнить сразу после `places = await d.loadPlaces();`: `byId = new Map(places.map((p) => [p.id, p]));`.

`src/app/main.ts`:
```ts
import { createLibrary } from '../library/library';
import { createSleepTimer } from '../player/sleep-timer';
import { createSearchIndex } from '../search/search-index';
import { shareStation } from '../share/share';
```
после создания `player`:
```ts
const sleep = createSleepTimer({ getVolume: () => audio.volume, setVolume: (v) => player.setVolume(v), stop: () => player.pause() });
const coarse = matchMedia('(pointer: coarse)').matches;
```
в `startApp({...})`:
```ts
  library: createLibrary(storage),
  sleep,
  share: (o) => shareStation({ ...o, preferShare: coarse, nav: navigator }),
  createSearch: (places) => createSearchIndex(base, places, i18n.locale),
  location,
  replaceUrl: (url) => history.replaceState(null, '', url),
  flagUrl,
  now: () => new Date(),
```

`README.md` — раздел «Удобства»: `search.json` (≈ 400 КБ, грузится при первом поиске), избранное/история в браузере (`favorites`, `history`), «Удиви меня» с учётом языка, ссылки `?station=<id>&c=<CC>`, превью `public/og.png` (`npm run og`), таймер сна.

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit && npm run build` → PASS; `index-*.js` gzip вырос не больше чем на ~10 КБ.

- [ ] **Step 5: Commit** `feat(app): search, favorites, history, surprise, share links and sleep timer`

- [ ] **Step 6: Приёмка в браузере** (`npm run snapshot`, `npm run dev`; записать в журнал):
1. Поиск: «лисс» → место «Лиссабон», «fado» → станции; клик — перелёт, список, эфир.
2. Звезда у станции → вкладка «Избранное»; перезагрузка — на месте; «История» — последние станции.
3. «Удиви меня» ×10 в режиме «Испанский» — все станции с `es`.
4. «Поделиться» → «Ссылка скопирована»; ссылку открыть в новой вкладке — карточка «Вам прислали станцию» → «Слушать» — играет та же станция.
5. Таймер сна: включить 15 мин, в консоли ускорить (или проверить подпись «Сон · 15 мин» и отмену «Выкл»).
6. Сравнить карточку ссылки с `design/mockups/MobileShare.dc.html` (телефон 390×844).
