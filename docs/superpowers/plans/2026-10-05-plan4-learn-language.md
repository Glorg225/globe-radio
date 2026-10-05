# План 4: режим «Учу язык» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Режим «Учу язык»: выбор языка, бирюзовая подсветка мест на карте, список и «Следующая на …» только на этом языке, плашка, метка «речь», связь с карточкой места (этап 5 ТЗ).

**Architecture:** В `places.json` у каждого места появляются счётчики языков; из них в браузере строится индекс языков. Выбранный язык живёт в маленьком хранилище состояния (`learn-state`) с запоминанием. Карта получает «слоистый» источник точек: приглушённые все места + бирюзовые места языка (у элементов поле `tone`), виды только раскрашивают по `tone` и умеют `refresh()`. Контроллер `app.ts` при смене языка перестраивает слой, плашку, список, кнопку плеера и карточку.

**Tech Stack:** TypeScript, Vitest + jsdom, supercluster, `Intl.DisplayNames` / `Intl.PluralRules`.

**Spec:** `docs/superpowers/specs/2026-10-05-plan4-learn-language-design.md` (+ `docs/02_tz.md` §4.4, `docs/03_design.md` §1, §6.2, `design/mockups/Language.dc.html`).

## Global Constraints

- Ни одной строки интерфейса в `src/` — только `locales/ru.json`; исключение — словари данных (`languages.ts`, `gazetteer.ts`) и новый модуль грамматики `src/i18n/ru-grammar.ts` (добавить в `ALLOWED` теста `no-hardcoded-strings`).
- Цвета режима — только токены: `--teal`, `--on-teal`, `--teal-banner-bg`, `--teal-banner-border`, `--teal-tip-bg`, `--teal-chip-bg`, `--teal-tile`, `--teal-text-muted`, `--teal-tip-text`, `--teal-link`, `--dot-muted`.
- Приглушённые места на карте: `--dot-muted`, прозрачность 35 %, без свечения; места языка: `--teal` со свечением.
- Плашка под шапкой: высота 48 px.
- Данные станций/мест в разметку — только `textContent` / `escapeHtml`.
- Первая загрузка: не больше ~20 КБ gzip сверх Плана 3.
- «Удиви меня» в этом плане не делаем; в плашке упоминается только «Следующая рядом».

## Review Focus

1. **Смена языка, когда открыт список и играет станция** → список сразу перефильтровывается, эфир не прерывается, кнопка плеера меняет подпись (тест в Task 6).
2. **Сохранённый язык исчез из данных** → режим молча сброшен, без ошибок (тест в Task 2).
3. **Станция на нескольких языках** (`es,ca`) → видна и в режиме «испанский», и в режиме «каталанский»; «Следующая на …» её находит (тесты в Task 2 и Task 6).
4. **Выпадающий список с клавиатуры**: Esc закрывает и возвращает фокус на кнопку, клик мимо закрывает, стрелки + Enter выбирают (тест в Task 4).
5. **«Учить этот язык» у станции без распознанного языка** → кнопки нет; у станции с языком режима → «совпадает с выбранным» (тест в Task 5).

---

## File Structure

```
scripts/build-snapshot.ts      — счётчики языков мест
src/data/places.ts             — Place.langs, кодирование 10-го поля
src/learn/language-index.ts    — индекс языков, поиск
src/learn/learn-state.ts       — выбранный язык, запоминание, подписка
src/learn/talk.ts              — «разговорная» станция (news/talk)
src/i18n/ru-grammar.ts         — предложный падеж названий языков
src/map/cluster.ts             — вес мест, слоистый источник, MapItem.tone
src/map/map-view.ts            — MapView.refresh()
src/map/globe3d.ts, map2d.ts   — раскраска по tone, refresh
src/ui/shell.ts / shell.css    — место под плашку, ссылка на кнопку «Учу язык»
src/ui/learn-picker.ts         — выпадающий список языков
src/ui/learn-banner.ts         — плашка режима
src/ui/learn.css               — стили режима
src/ui/station-list.ts         — вариант режима (совет, бирюзовые плитки, «речь»)
src/ui/player-bar.ts           — подпись кнопки «Следующая …»
src/place-card/place-card.ts   — бирюзовая плитка языка, «Учить этот язык»
src/app/app.ts, main.ts        — связка
locales/ru.json
```

---

### Task 1: Счётчики языков у мест

**Files:**
- Modify: `src/data/places.ts`, `scripts/build-snapshot.ts`, `tests/build-snapshot.test.ts`, `tests/places-client.test.ts`

**Interfaces:**
- Produces: `Place.langs?: Record<string, number>`; `CompactPlace` + необязательный 10-й элемент `langs: string` (`"es:12,ca:3"`); `encodeLangs(m: Record<string, number> | undefined): string`, `decodeLangs(s: string | undefined): Record<string, number>`; `decodePlace` всегда возвращает `langs` (пустой объект, если поля нет).

- [ ] **Step 1: Тесты**

В `tests/build-snapshot.test.ts` дописать:
```ts
test('places count their stations per language', () => {
  const { places } = buildSnapshot([
    raw({ stationuuid: 'a', state: 'Bayern', languagecodes: 'de' }),
    raw({ stationuuid: 'b', state: 'Bayern', languagecodes: 'de,en' }),
    raw({ stationuuid: 'c', state: 'Bayern', languagecodes: '', language: '' }),
  ], centroids, matcher);
  expect(places.find((p) => p.id === 'a:DE.02')!.langs).toEqual({ de: 2, en: 1 });
});

test('language counts survive encode/decode; old rows without them decode to {}', async () => {
  const { encodeLangs, decodeLangs } = await import('../src/data/places');
  const p: Place = { id: 'c:1', lat: 1, lon: 2, kind: 'exact', cc: 'ES', nameRu: '', name: 'M', count: 15, pop: 9, langs: { es: 12, ca: 3 } };
  expect(encodeLangs(p.langs)).toBe('es:12,ca:3');
  expect(decodePlace(encodePlace(p)).langs).toEqual({ es: 12, ca: 3 });
  expect(decodePlace(['c:2', 0, 0, 0, 'ES', '', 'X', 1, 1]).langs).toEqual({});
  expect(decodeLangs('es:x,:3,ca:2')).toEqual({ ca: 2 });
});
```
В существующем тесте `place and station encodings roundtrip` у объекта `p` добавить `langs: {}` (иначе `toEqual` упадёт на новом поле).

- [ ] **Step 2: Run** `npx vitest run tests/build-snapshot.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`src/data/places.ts`:
```ts
export interface Place extends PlaceRef { count: number; pop: number; langs?: Record<string, number> }
export type CompactPlace = [id: string, lat: number, lon: number, kind: 0 | 1 | 2, cc: string, nameRu: string, name: string, count: number, pop: number, langs?: string];

export function encodeLangs(m: Record<string, number> | undefined): string {
  return Object.entries(m ?? {}).map(([code, n]) => `${code}:${n}`).join(',');
}

export function decodeLangs(s: string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of (s ?? '').split(',')) {
    const [code, n] = part.split(':');
    const count = Number(n);
    if (code && Number.isInteger(count) && count > 0) out[code] = count;
  }
  return out;
}

export function encodePlace(p: Place): CompactPlace {
  return [p.id, p.lat, p.lon, KINDS.indexOf(p.kind) as 0 | 1 | 2, p.cc, p.nameRu, p.name, p.count, p.pop, encodeLangs(p.langs)];
}

export function decodePlace(c: CompactPlace): Place {
  const [id, lat, lon, kind, cc, nameRu, name, count, pop, langs] = c;
  return { id, lat, lon, kind: KINDS[kind], cc, nameRu, name, count, pop, langs: decodeLangs(langs) };
}
```
(заменить старые `Place`, `CompactPlace`, `encodePlace`, `decodePlace`.)

`scripts/build-snapshot.ts` — в цикле после `place.pop += s.clicks;`:
```ts
    place.langs ??= {};
    for (const l of s.langs) place.langs[l] = (place.langs[l] ?? 0) + 1;
```

Проверить существующие тесты, сравнивающие места через `toEqual`/`toMatchObject` (`tests/places-client.test.ts` — `toMatchObject`, не мешает).

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Живой снимок** — `npm run snapshot`, затем:
```bash
node -e "const z=require('zlib'),f=require('fs');const b=f.readFileSync('public/data/places.json');console.log('gzip',z.gzipSync(b).length);const p=JSON.parse(b).places.find(x=>x[6]==='Madrid');console.log(p)"
```
Expected: gzip ≈ 186 000 (было ≈ 172 000); у Мадрида 10-е поле вида `es:…`.

- [ ] **Step 6: Commit** `feat(data): per-place language counts in places.json`

---

### Task 2: Индекс языков, падежи, «речь», состояние режима

**Files:**
- Create: `src/learn/language-index.ts`, `src/learn/talk.ts`, `src/learn/learn-state.ts`, `src/i18n/ru-grammar.ts`, `tests/learn.test.ts`
- Modify: `tests/no-hardcoded-strings.test.ts` (ALLOWED + `ru-grammar.ts`)

**Interfaces:**
- Consumes: `Place.langs` (Task 1).
- Produces:
  - `interface LanguageEntry { code: string; name: string; stations: number; countries: number }`
  - `buildLanguageIndex(places: Place[], locale: string): LanguageEntry[]` — `name` с заглавной буквы; сортировка по `stations` убыв., затем по имени; языки без названия в `Intl` исключены
  - `searchLanguages(list: LanguageEntry[], query: string): LanguageEntry[]` — без учёта регистра, по имени (вхождение) и по коду (точное совпадение)
  - `lowerFirst(s: string, locale: string): string`
  - `isTalk(s: StationLite): boolean` — теги `news` или `talk`
  - `prepositional(name: string): string` (`src/i18n/ru-grammar.ts`) — вход/выход в нижнем регистре
  - `LEARN_KEY = 'learnLang'`; `interface LearnState { get(): string | null; set(code: string | null): void; subscribe(l: (code: string | null) => void): () => void }`; `createLearnState(storage: Storage | null, isKnown: (code: string) => boolean): LearnState`

- [ ] **Step 1: Тесты**

`tests/learn.test.ts`:
```ts
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
```

- [ ] **Step 2: Run** `npx vitest run tests/learn.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`src/i18n/ru-grammar.ts`:
```ts
// Russian prepositional case for language names ("на испанском", "на иврите", "на латыни", "на хинди").
export function prepositional(name: string): string {
  const n = name.trim();
  if (/(ий|ый|ой)$/.test(n)) return `${n.slice(0, -2)}ом`;
  if (n.endsWith('ь')) return `${n.slice(0, -1)}и`;
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(n)) return `${n}е`;
  return n;
}
```
В `tests/no-hardcoded-strings.test.ts`: `const ALLOWED = new Set([join('src', 'data', 'languages.ts'), join('src', 'data', 'gazetteer.ts'), join('src', 'i18n', 'ru-grammar.ts')]);`

`src/learn/language-index.ts`:
```ts
import type { Place } from '../data/places';

export interface LanguageEntry { code: string; name: string; stations: number; countries: number }

const names = new Map<string, Intl.DisplayNames>();
function languageName(code: string, locale: string): string | undefined {
  let d = names.get(locale);
  if (!d) { d = new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' }); names.set(locale, d); }
  try { return d.of(code); } catch { return undefined; }
}

export const upperFirst = (s: string, locale: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
export const lowerFirst = (s: string, locale: string) => s.charAt(0).toLocaleLowerCase(locale) + s.slice(1);

export function buildLanguageIndex(places: Place[], locale: string): LanguageEntry[] {
  const stations = new Map<string, number>();
  const countries = new Map<string, Set<string>>();
  for (const p of places) {
    for (const [code, n] of Object.entries(p.langs ?? {})) {
      stations.set(code, (stations.get(code) ?? 0) + n);
      (countries.get(code) ?? countries.set(code, new Set()).get(code)!).add(p.cc);
    }
  }
  const out: LanguageEntry[] = [];
  for (const [code, n] of stations) {
    const name = languageName(code, locale);
    if (name) out.push({ code, name: upperFirst(name, locale), stations: n, countries: countries.get(code)!.size });
  }
  return out.sort((a, b) => b.stations - a.stations || a.name.localeCompare(b.name, locale));
}

export function searchLanguages(list: LanguageEntry[], query: string): LanguageEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((e) => e.code === q || e.name.toLowerCase().includes(q));
}
```

`src/learn/talk.ts`:
```ts
import type { StationLite } from '../data/shards';

const TALK = new Set(['news', 'talk']);
export const isTalk = (s: Pick<StationLite, 'tags'>) => s.tags.some((t) => TALK.has(t));
```

`src/learn/learn-state.ts`:
```ts
export const LEARN_KEY = 'learnLang';

export interface LearnState {
  get(): string | null;
  set(code: string | null): void;
  subscribe(l: (code: string | null) => void): () => void;
}

export function createLearnState(storage: Storage | null, isKnown: (code: string) => boolean): LearnState {
  let current: string | null = null;
  try { current = storage?.getItem(LEARN_KEY) ?? null; } catch { current = null; }
  if (current && !isKnown(current)) {
    current = null;
    try { storage?.removeItem(LEARN_KEY); } catch { /* unavailable */ }
  }
  const listeners = new Set<(code: string | null) => void>();
  return {
    get: () => current,
    set(code) {
      if (code === current) return;
      current = code;
      try {
        if (code) storage?.setItem(LEARN_KEY, code);
        else storage?.removeItem(LEARN_KEY);
      } catch { /* unavailable */ }
      for (const l of listeners) l(code);
    },
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(learn): language index, Russian prepositional case, talk stations, learn state`

---

### Task 3: Карта — вес мест, приглушённый слой, раскраска

**Files:**
- Modify: `src/map/cluster.ts`, `src/map/map-view.ts`, `src/map/globe3d.ts`, `src/map/map2d.ts`, `tests/cluster.test.ts`, `tests/app.test.ts` (поддельные виды получают `refresh`)

**Interfaces:**
- Consumes: `Place.langs` (Task 1).
- Produces:
  - `MapItem` (оба варианта) + `tone?: 'muted' | 'teal'`
  - `createClusterer(places: Place[], weight?: (p: Place) => number): Clusterer` — с `weight` в индекс попадают только места с `weight > 0`, `count = pop = weight(p)`
  - `layered(base: Clusterer, highlight: Clusterer | null): Clusterer` — без `highlight` отдаёт `base`; иначе сначала элементы `base` с `tone: 'muted'`, затем `highlight` с `tone: 'teal'`
  - `MapView.refresh(): void` — перечитать точки из источника

- [ ] **Step 1: Тесты** — дописать в `tests/cluster.test.ts`:
```ts
test('weighted clusterer counts only the weight and skips zero-weight places', async () => {
  const withLangs = [
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
  expect(items.filter((i) => i.tone === 'muted')).toHaveLength(4);
  expect(items.at(-1)).toMatchObject({ key: 'far', tone: 'teal' });
});
```
В `tests/app.test.ts` в `fakeFactory` объект вида: `{ setPlaying: vi.fn(), flyTo: vi.fn(), zoomBy: vi.fn(), refresh: vi.fn(), destroy: vi.fn() }`; в тесте `rapid view toggles…` — тоже добавить `refresh: vi.fn()`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/map/cluster.ts`:
```ts
export type MapItem =
  | { type: 'place'; key: string; place: Place; lat: number; lon: number; count: number; pop: number; tone?: 'muted' | 'teal' }
  | { type: 'cluster'; key: string; lat: number; lon: number; count: number; pop: number; zoomTo: number; tone?: 'muted' | 'teal' };
```
`createClusterer(places: Place[], weight?: (p: Place) => number)`:
```ts
export function createClusterer(all: Place[], weight?: (p: Place) => number): Clusterer {
  const places = weight ? all.filter((p) => weight(p) > 0) : all;
  const countOf = (p: Place) => (weight ? weight(p) : p.count);
  const popOf = (p: Place) => (weight ? weight(p) : p.pop);
  const index = new Supercluster<Props, Reduced>({ /* как было */ });
  index.load(places.map((p, i) => ({
    type: 'Feature' as const,
    properties: { i, count: countOf(p), pop: popOf(p) },
    geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
  })));
  // items(): у места — count: countOf(place), pop: popOf(place); остальное как было
}

export function layered(base: Clusterer, highlight: Clusterer | null): Clusterer {
  if (!highlight) return base;
  return {
    items: (zoom) => [
      ...base.items(zoom).map((i) => ({ ...i, tone: 'muted' as const })),
      ...highlight.items(zoom).map((i) => ({ ...i, tone: 'teal' as const })),
    ],
  };
}
```

`src/map/map-view.ts` — в `MapView` добавить `refresh(): void;`.

`src/map/globe3d.ts`:
- после `const glow = …`: `const teal = css.getPropertyValue('--teal').trim(); const muted = css.getPropertyValue('--dot-muted').trim();`
- в `refresh`: `maxPop = Math.max(1, ...items.filter((i) => i.tone !== 'muted').map((i) => i.pop));`
- `radiusOf`: для `tone === 'muted'` размер 3 px: `const item = o as MapItem; const size = item.tone === 'muted' ? 3 : dotStyle(item.pop, maxPop).size; return (size / 2) * DEG_PER_PX_PER_ALT * altitude();`
- `pointColor`:
```ts
    .pointColor((o: object) => {
      const item = o as MapItem;
      if (item.tone === 'muted') return hexToRgba(muted, 0.35);
      return hexToRgba(item.tone === 'teal' ? teal : accent, dotStyle(item.pop, maxPop).opacity);
    })
```
- в возвращаемый объект: `refresh() { refresh(true); },`

`src/map/map2d.ts`:
- `color` + `teal: token('--teal'), muted: token('--dot-muted')`
- цикл отрисовки точек заменить на:
```ts
    const items = clusterer.items(scaleToZoom(transform.k));
    const maxPop = Math.max(1, ...items.filter((i) => i.tone !== 'muted').map((i) => i.pop));
    screen = [];
    for (const item of items) {
      const p = projection([item.lon, item.lat]);
      if (!p) continue;
      const x = transform.applyX(p[0]);
      const y = transform.applyY(p[1]);
      if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
      const muted = item.tone === 'muted';
      const { size, opacity } = muted ? { size: 3, opacity: 0.35 } : dotStyle(item.pop, maxPop);
      const fill = muted ? color.muted : item.tone === 'teal' ? color.teal : color.accent;
      ctx.shadowColor = fill;
      ctx.shadowBlur = muted ? 0 : 8;
      ctx.fillStyle = fill;
      ctx.globalAlpha = opacity;
      ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
      screen.push({ x, y, r: size / 2, item });
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
```
- в возвращаемый объект: `refresh() { draw(); },`
- `hitTest` берёт ближайшую точку; приглушённая и бирюзовая точка одного места совпадают — при равенстве расстояния выигрывает первая в массиве, поэтому `screen` проверять с конца: в `at(e)` заменить `hitTest(screen, …)` на `hitTest([...screen].reverse(), …)` (бирюзовая — сверху).

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(map): weighted clusters and a muted base layer for the learn mode`

---

### Task 4: Выпадающий список языков и плашка

**Files:**
- Create: `src/ui/learn-picker.ts`, `src/ui/learn-banner.ts`, `src/ui/learn.css`, `tests/learn-ui.test.ts`
- Modify: `src/ui/shell.ts` (слот плашки, ссылки), `locales/ru.json`, `tests/shell.test.ts`

**Interfaces:**
- Consumes: `LanguageEntry` (Task 2), `prepositional`, `lowerFirst`.
- Produces:
  - `ShellRefs` + `banner: HTMLElement; learnButton: HTMLButtonElement`
  - `createLearnPicker(i18n: I18n, button: HTMLButtonElement, p: { languages(): LanguageEntry[]; current(): string | null; onPick(code: string): void }): { update(): void; close(): void }`
  - `createLearnBanner(host: HTMLElement, i18n: I18n, onOff: () => void): { show(e: LanguageEntry | null): void }`
  - ключи `locales/ru.json` (ниже)

- [ ] **Step 1: Тексты** — добавить в `locales/ru.json`:
```json
  "learn.button": "Учу язык",
  "learn.buttonActive": "Учу язык: {lang}",
  "learn.search": "Найти язык",
  "learn.notFound": "Ничего не найдено",
  "learn.banner.title": "Режим «Учу язык»",
  "learn.banner.info": "{lang} · {stations} в {countries} · «Следующая рядом» выбирает только из них",
  "learn.countries": { "one": "{count} стране", "few": "{count} странах", "many": "{count} странах", "other": "{count} странах" },
  "learn.off": "Выключить",
  "learn.tip": "Совет: выбирайте разговорные и новостные станции — там больше живой речи, чем музыки.",
  "learn.talk": "речь",
  "learn.subtitle": "{country} · {stations} на {langPrep}",
  "learn.subtitleApprox": "Примерное расположение · {stations} на {langPrep}",
  "learn.empty": "Здесь нет станций на {langPrep}",
  "learn.showAll": "Показать все станции этого места",
  "learn.tooltip": "{place} · {stations} на {langPrep}",
  "learn.stationsIn": "{stations} на {langPrep}",
  "learn.next": "Следующая на {langPrep}",
  "learn.noNext": "Рядом больше нет станций на {langPrep}",
  "place.lang.match": "совпадает с выбранным"
```

- [ ] **Step 2: Тесты**

В `tests/shell.test.ts` дописать:
```ts
test('exposes the learn button and an empty banner slot under the header', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.learnButton.dataset.action).toBe('learn');
  expect(refs.banner.hidden).toBe(true);
  expect(refs.banner.previousElementSibling).toBe(refs.header);
});
```

`tests/learn-ui.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import { createI18n } from '../src/i18n/i18n';
import type { LanguageEntry } from '../src/learn/language-index';
import { createLearnBanner } from '../src/ui/learn-banner';
import { createLearnPicker } from '../src/ui/learn-picker';

const i18n = createI18n('ru', ru);
const langs: LanguageEntry[] = [
  { code: 'es', name: 'Испанский', stations: 5081, countries: 66 },
  { code: 'en', name: 'Английский', stations: 7111, countries: 138 },
  { code: 'pt', name: 'Португальский', stations: 911, countries: 17 },
];
let button: HTMLButtonElement;
let current: string | null;
let onPick: ReturnType<typeof vi.fn>;
beforeEach(() => {
  document.body.innerHTML = '<header><button data-action="learn"><span>Учу язык</span></button></header><main></main>';
  button = document.querySelector('button')!;
  current = null;
  onPick = vi.fn((c: string) => { current = c; });
});
const open = () => createLearnPicker(i18n, button, { languages: () => langs, current: () => current, onPick });
const pop = () => document.querySelector('.learn-pop') as HTMLElement;

test('button opens a list with search, counts and aria-expanded', () => {
  open();
  button.click();
  expect(button.getAttribute('aria-expanded')).toBe('true');
  expect((pop().querySelector('input') as HTMLInputElement).placeholder).toBe('Найти язык');
  const rows = [...pop().querySelectorAll('.learn-pop__item')].map((r) => r.textContent);
  expect(rows[0]).toContain('Испанский');
  expect(rows[0]).toContain('5 081 станция');
  expect(document.activeElement).toBe(pop().querySelector('input'));
});

test('typing filters; nothing found shows a message', () => {
  open();
  button.click();
  const input = pop().querySelector('input')!;
  input.value = 'порт';
  input.dispatchEvent(new Event('input'));
  expect(pop().querySelectorAll('.learn-pop__item')).toHaveLength(1);
  input.value = 'клингонский';
  input.dispatchEvent(new Event('input'));
  expect(pop().textContent).toContain('Ничего не найдено');
});

test('arrows + Enter pick; Esc closes and returns focus to the button (review focus 4)', () => {
  open();
  button.click();
  const input = pop().querySelector('input')!;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(onPick).toHaveBeenCalledWith('en');
  expect(pop()).toBeNull();
  button.click();
  pop().querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(pop()).toBeNull();
  expect(document.activeElement).toBe(button);
  expect(button.getAttribute('aria-expanded')).toBe('false');
});

test('click outside closes; click on an item picks it', () => {
  open();
  button.click();
  document.querySelector('main')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  expect(pop()).toBeNull();
  button.click();
  (pop().querySelectorAll('.learn-pop__item')[2] as HTMLButtonElement).click();
  expect(onPick).toHaveBeenCalledWith('pt');
});

test('update(): active language turns the button teal with "Учу язык: испанский"', () => {
  const picker = open();
  current = 'es';
  picker.update();
  expect(button.classList.contains('is-learning')).toBe(true);
  expect(button.textContent).toContain('Учу язык: испанский');
  current = null;
  picker.update();
  expect(button.classList.contains('is-learning')).toBe(false);
  expect(button.textContent).toContain('Учу язык');
});

test('selected language is highlighted in the list', () => {
  current = 'pt';
  open();
  button.click();
  expect(pop().querySelector('.learn-pop__item.is-selected')!.textContent).toContain('Португальский');
});

test('banner shows language, stations and countries, and turns the mode off', () => {
  const host = document.createElement('div');
  host.hidden = true;
  const onOff = vi.fn();
  const b = createLearnBanner(host, i18n, onOff);
  b.show(langs[0]);
  expect(host.hidden).toBe(false);
  expect(host.textContent).toContain('Режим «Учу язык»');
  expect(host.textContent).toContain('Испанский · 5 081 станция в 66 странах');
  (host.querySelector('button') as HTMLButtonElement).click();
  expect(onOff).toHaveBeenCalled();
  b.show(null);
  expect(host.hidden).toBe(true);
});
```

- [ ] **Step 3: Run** → FAIL.

- [ ] **Step 4: Реализация**

`src/ui/shell.ts`:
- после `</header>` в шаблоне вставить `<div class="learn-banner" hidden></div>`;
- `ShellRefs` + `banner: HTMLElement; learnButton: HTMLButtonElement;`, в возврате `banner: q('.learn-banner'), learnButton: q<HTMLButtonElement>('[data-action="learn"]'),`
- импорт стилей режима: `import './learn.css';` (рядом с `./shell.css`).

`src/ui/learn-picker.ts`:
```ts
import type { I18n } from '../i18n/i18n';
import { lowerFirst, searchLanguages, type LanguageEntry } from '../learn/language-index';
import { escapeHtml } from './html';
import { icons } from './icons';

export interface LearnPickerProps { languages(): LanguageEntry[]; current(): string | null; onPick(code: string): void }

export function createLearnPicker(i18n: I18n, button: HTMLButtonElement, p: LearnPickerProps): { update(): void; close(): void } {
  let pop: HTMLElement | null = null;
  let active = 0;
  let shown: LanguageEntry[] = [];
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');

  const onOutside = (e: MouseEvent) => {
    if (pop && !pop.contains(e.target as Node) && !button.contains(e.target as Node)) close();
  };

  function close(returnFocus = false) {
    if (!pop) return;
    pop.remove();
    pop = null;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside);
    if (returnFocus) button.focus();
  }

  function renderItems(list: HTMLElement, query: string) {
    shown = searchLanguages(p.languages(), query);
    active = Math.min(active, Math.max(0, shown.length - 1));
    list.replaceChildren();
    if (!shown.length) {
      const empty = document.createElement('p');
      empty.className = 'learn-pop__empty';
      empty.textContent = i18n.t('learn.notFound');
      list.append(empty);
      return;
    }
    shown.forEach((e, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'learn-pop__item';
      item.setAttribute('role', 'option');
      item.classList.toggle('is-selected', e.code === p.current());
      item.classList.toggle('is-active', i === active);
      const name = document.createElement('span');
      name.textContent = e.name;
      const count = document.createElement('span');
      count.className = 'learn-pop__count';
      count.textContent = i18n.t('stations.count', { count: e.stations });
      item.append(name, count);
      item.addEventListener('click', () => pick(e.code));
      list.append(item);
    });
  }

  function pick(code: string) {
    close();
    p.onPick(code);
  }

  function open() {
    pop = document.createElement('div');
    pop.className = 'learn-pop';
    pop.innerHTML = `<label class="learn-pop__search">${icons.search}<input type="search" placeholder="${escapeHtml(i18n.t('learn.search'))}" aria-label="${escapeHtml(i18n.t('learn.search'))}"></label><div class="learn-pop__list" role="listbox"></div>`;
    const input = pop.querySelector('input')!;
    const list = pop.querySelector<HTMLElement>('.learn-pop__list')!;
    active = Math.max(0, p.languages().findIndex((e) => e.code === p.current()));
    renderItems(list, '');
    input.addEventListener('input', () => { active = 0; renderItems(list, input.value); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = Math.min(shown.length - 1, Math.max(0, active + (e.key === 'ArrowDown' ? 1 : -1)));
        renderItems(list, input.value);
        list.querySelector('.is-active')?.scrollIntoView?.({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter' && shown[active]) { e.preventDefault(); pick(shown[active].code); }
    });
    button.insertAdjacentElement('afterend', pop);
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onOutside);
    input.focus();
  }

  button.addEventListener('click', () => (pop ? close() : open()));

  return {
    update() {
      const code = p.current();
      const entry = code ? p.languages().find((e) => e.code === code) : undefined;
      button.classList.toggle('is-learning', !!entry);
      const label = entry ? i18n.t('learn.buttonActive', { lang: lowerFirst(entry.name, i18n.locale) }) : i18n.t('learn.button');
      button.setAttribute('aria-label', label);
      const span = button.querySelector('span');
      if (span) span.textContent = label;
    },
    close: () => close(),
  };
}
```

`src/ui/learn-banner.ts`:
```ts
import type { I18n } from '../i18n/i18n';
import type { LanguageEntry } from '../learn/language-index';
import { escapeHtml } from './html';
import { icons } from './icons';

export function createLearnBanner(host: HTMLElement, i18n: I18n, onOff: () => void): { show(e: LanguageEntry | null): void } {
  host.innerHTML = `${icons.message}<b class="learn-banner__title">${escapeHtml(i18n.t('learn.banner.title'))}</b><span class="learn-banner__info"></span><span class="spacer"></span><button class="learn-banner__off" type="button">${escapeHtml(i18n.t('learn.off'))}</button>`;
  const info = host.querySelector<HTMLElement>('.learn-banner__info')!;
  host.querySelector('button')!.addEventListener('click', onOff);
  return {
    show(e) {
      host.hidden = !e;
      if (!e) return;
      info.textContent = i18n.t('learn.banner.info', {
        lang: e.name,
        stations: i18n.t('stations.count', { count: e.stations }),
        countries: i18n.t('learn.countries', { count: e.countries }),
      });
    },
  };
}
```

`src/ui/learn.css` (по `03_design.md` §6.2):
```css
[data-action="learn"].is-learning { background: var(--teal); border-color: var(--teal); color: var(--on-teal); font-weight: 600; }
.shell__header { position: relative; }
.learn-pop { position: absolute; z-index: 20; inset-block-start: 60px; inline-size: 300px; max-block-size: 420px; display: flex; flex-direction: column; padding: 10px; border-radius: var(--r-card); background: var(--surface-raised); border: 1px solid var(--border-popover); }
.learn-pop__search { display: flex; align-items: center; gap: 8px; block-size: 40px; padding-inline: 12px; border-radius: var(--r-control); background: var(--surface-card); border: 1px solid var(--border-control); color: var(--text-muted); }
.learn-pop__search input { flex: 1; min-inline-size: 0; background: transparent; border: 0; outline: 0; color: var(--text); font: inherit; }
.learn-pop__list { margin-block-start: 8px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.learn-pop__item { display: flex; justify-content: space-between; gap: 10px; padding: 9px 10px; border: 0; border-radius: 10px; background: transparent; color: var(--text); font-size: 15px; text-align: start; }
.learn-pop__item:hover, .learn-pop__item.is-active { background: var(--item-selected); }
.learn-pop__item.is-selected { background: var(--teal-chip-bg); color: var(--teal); }
.learn-pop__count { color: var(--text-muted); font-size: 13px; white-space: nowrap; }
.learn-pop__empty { margin: 10px; color: var(--text-muted); font-size: 14px; }
.learn-banner { block-size: 48px; flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding-inline: 24px; background: var(--teal-banner-bg); border-block-end: 1px solid var(--teal-banner-border); color: var(--teal); font-size: 14px; }
.learn-banner__info { color: var(--teal-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
.learn-banner__off { block-size: 32px; padding-inline: 14px; border-radius: 10px; border: 1px solid var(--teal-banner-border); background: transparent; color: var(--teal); }
@media (max-width: 760px) {
  .learn-pop { inset-inline: 8px; inline-size: auto; }
  .learn-banner { padding-inline: 12px; gap: 8px; font-size: 13px; }
  .learn-banner__title { display: none; }
}
```

- [ ] **Step 5: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 6: Commit** `feat(ui): language picker and learn-mode banner`

---

### Task 5: Список, плеер и карточка в режиме

**Files:**
- Modify: `src/ui/station-list.ts`, `src/ui/player-bar.ts`, `src/place-card/place-card.ts`, `src/place-card/place-card.css`, `src/ui/learn.css`, `tests/station-list.test.ts`, `tests/player-bar.test.ts`, `tests/place-card.test.ts`

**Interfaces:**
- Consumes: `isTalk` (Task 2), `languageNames` (План 3).
- Produces:
  - `StationListProps.learn?: { tip: string; talkLabel: string }`
  - `PlayerBarView.nextLabel?: string` (подпись кнопки «Следующая», кроме состояния ошибки)
  - `PlaceCard.setLearn(code: string | null, onLearn: (code: string) => void): void`

- [ ] **Step 1: Тесты**

В `tests/station-list.test.ts` дописать:
```ts
test('learn variant: tip on top, teal list, "речь" chip only on talk/news stations', () => {
  renderStationList(el, i18n, {
    title: 'Мадрид', subtitle: 'Испания · 2 станции на испанском',
    stations: [st('a', 'Charla Madrid', ['talk', 'spanish']), st('b', 'Radio Gran Vía', ['pop'])],
    playingId: null, onPick() {},
    learn: { tip: 'Совет: выбирайте разговорные…', talkLabel: 'речь' },
  });
  expect(el.querySelector('.learn-tip')!.textContent).toBe('Совет: выбирайте разговорные…');
  expect(el.querySelector('.stations')!.classList.contains('stations--learn')).toBe(true);
  const rows = el.querySelectorAll('.station');
  expect(rows[0].querySelector('.talk-chip')!.textContent).toBe('речь');
  expect(rows[1].querySelector('.talk-chip')).toBeNull();
  expect(rows[0].querySelector('.station__tags')!.textContent).toContain('talk · spanish');
});
```

В `tests/player-bar.test.ts` дописать:
```ts
test('custom next label in learn mode; error still offers "try next nearby"', () => {
  const bar = createPlayerBar(el, i18n, h);
  bar.render({ state: { kind: 'playing', station }, place: 'X', volume: 1, muted: false, nextLabel: 'Следующая на испанском' });
  expect(q('.pb__next').textContent).toBe('Следующая на испанском');
  bar.render({ state: { kind: 'error', station }, place: 'X', volume: 1, muted: false, nextLabel: 'Следующая на испанском' });
  expect(q('.pb__next').textContent).toBe('Попробовать следующую рядом');
});
```

В `tests/place-card.test.ts`:
- в тесте `city card: …` заменить проверки кнопки:
```ts
  const learn = q('.pc__learn') as HTMLButtonElement;
  expect(learn.hidden).toBe(false);
  expect(learn.disabled).toBe(false);
```
- дописать:
```ts
test('"Учить этот язык" turns the learn mode on with the station language', () => {
  const card = createPlaceCard(panel, stage, deps);
  const onLearn = vi.fn();
  card.setLearn(null, onLearn);
  card.show({ place: lisbon, station: st(['pt', 'en']), info });
  (q('.pc__learn') as HTMLButtonElement).click();
  expect(onLearn).toHaveBeenCalledWith('pt');
});

test('language tile turns teal and says "совпадает с выбранным" when it matches the learn mode', () => {
  const card = createPlaceCard(panel, stage, deps);
  card.show({ place: lisbon, station: st(['pt']), info });
  card.setLearn('pt', vi.fn());
  expect(q('.pc__langtile').classList.contains('is-match')).toBe(true);
  expect(q('.pc__match').hidden).toBe(false);
  expect(q('.pc__match').textContent).toBe('совпадает с выбранным');
  expect(q('.pc__learn').hidden).toBe(true);
  card.setLearn('es', vi.fn());
  expect(q('.pc__langtile').classList.contains('is-match')).toBe(false);
  expect(q('.pc__learn').hidden).toBe(false);
});

test('no recognised station language → no learn button (review focus 5)', () => {
  const card = createPlaceCard(panel, stage, deps);
  card.setLearn(null, vi.fn());
  card.show({ place: lisbon, station: st([]), info });
  expect(q('.pc__learn').hidden).toBe(true);
  card.show({ place: { ...lisbon, id: 'c:9' }, station: st(['zz']), info });
  expect(q('.pc__learn').hidden).toBe(true);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/ui/station-list.ts`:
- импорт `import { isTalk } from '../learn/talk';`
- `StationListProps` + `learn?: { tip: string; talkLabel: string };`
- строку `text.append(el('span', 'station__name', s.name), el('span', 'station__tags', s.tags.slice(0, 3).join(' · ')));` заменить на:
```ts
    const tags = el('span', 'station__tags');
    if (p.learn && isTalk(s)) {
      const chip = el('span', 'talk-chip');
      chip.innerHTML = icons.message;
      chip.append(p.learn.talkLabel);
      tags.append(chip);
    }
    tags.append(s.tags.slice(0, 3).join(' · '));
    text.append(el('span', 'station__name', s.name), tags);
```
- `const list = el('ul', 'stations');` → `const list = el('ul', p.learn ? 'stations stations--learn' : 'stations');`
- `host.replaceChildren(head, list);` → 
```ts
  if (p.learn) host.replaceChildren(head, el('p', 'learn-tip', p.learn.tip), list);
  else host.replaceChildren(head, list);
```
(Проверка теста «речь»: `chip.textContent` — `''` от SVG + `'речь'` = `'речь'`.)

`src/ui/player-bar.ts`:
- `PlayerBarView` + `nextLabel?: string`
- в `render({ state, place, volume, muted })` → `render({ state, place, volume, muted, nextLabel: custom })`, и строку подписи:
```ts
      nextLabel.textContent = state.kind === 'error' ? i18n.t('player.tryNext') : custom ?? i18n.t('player.next');
```

`src/place-card/place-card.ts`:
- `PlaceCard` → `export interface PlaceCard { show(d: PlaceCardData | null): void; setLearn(code: string | null, onLearn: (code: string) => void): void; destroy(): void }`
- в шаблоне плитку языка заменить на:
```html
        <div class="pc__tile pc__langtile"><div class="pc__label">${t('place.lang')}</div><div class="pc__langs"></div>
          <div class="pc__match" hidden>${t('place.lang.match')}</div>
          <button class="pc__learn" type="button" hidden>${t('place.learn')}</button></div>
```
- в `el` добавить `langTile: q(panel, '.pc__langtile'), match: q(panel, '.pc__match'), learnBtn: q<HTMLButtonElement>(panel, '.pc__learn'),`
- перед `return {`:
```ts
  let learnCode: string | null = null;
  let onLearn: ((code: string) => void) | null = null;
  let stationLangs: string[] = [];
  let learnTarget: string | null = null;
  function renderLearn() {
    const match = !!learnCode && stationLangs.includes(learnCode);
    el.langTile.classList.toggle('is-match', match);
    el.match.hidden = !match;
    learnTarget = stationLangs.find((c) => languageNames([c], i18n.locale) !== '') ?? null;
    el.learnBtn.hidden = match || !learnTarget;
  }
  el.learnBtn.addEventListener('click', () => { if (learnTarget) onLearn?.(learnTarget); });
```
- в `show(d)` сразу после `el.langs.textContent = langs;`: `stationLangs = d.station.langs; renderLearn();`
- в возвращаемый объект:
```ts
    setLearn(code, cb) {
      learnCode = code;
      onLearn = cb;
      renderLearn();
    },
```

`src/place-card/place-card.css` — дописать:
```css
.pc__langtile.is-match { background: var(--teal-tip-bg); border-color: var(--teal-banner-border); }
.pc__langtile.is-match .pc__langs, .pc__match { color: var(--teal); }
.pc__match { font-size: 13px; }
```
(правило `.pc__learn` уже есть.)

`src/ui/learn.css` — дописать:
```css
.learn-tip { margin: 0 var(--pad-panel) 10px; padding: 10px 12px; border-radius: var(--r-card); background: var(--teal-tip-bg); color: var(--teal-tip-text); font-size: 13px; line-height: 1.45; }
.stations--learn .station__tile { background: var(--teal-tile); color: var(--teal); }
.stations--learn .station.is-playing { background: var(--teal-tip-bg); }
.talk-chip { display: inline-flex; align-items: center; gap: 4px; margin-inline-end: 6px; padding: 1px 6px; border-radius: 6px; background: var(--teal-chip-bg); color: var(--teal); font-size: 12px; vertical-align: middle; }
.talk-chip svg { inline-size: 12px; block-size: 12px; }
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS (в `tests/app.test.ts` поддельная карточка без `setLearn` пока не мешает: тип `AppDeps.card` меняется в Task 6).

- [ ] **Step 5: Commit** `feat(learn): learn variant of the station list, next label, place-card language tile`

---

### Task 6: Связка в приложении и приёмка

**Files:**
- Modify: `src/app/app.ts`, `tests/app.test.ts`, `README.md`

**Interfaces:**
- Consumes: всё из Tasks 1–5.
- Produces: `AppDeps.card: { show(d: PlaceCardData | null): void; setLearn(code: string | null, onLearn: (code: string) => void): void }`; `AppHandle` + `learn(code: string | null): void` (для тестов и будущих планов).

- [ ] **Step 1: Тесты** — в `tests/app.test.ts`:
- фикстуры:
```ts
const lisbon: Place = { id: 'c:1', lat: 38.7, lon: -9.1, kind: 'exact', cc: 'PT', nameRu: 'Лиссабон', name: 'Lisbon', count: 2, pop: 10, langs: { pt: 1, en: 1 } };
const porto: Place = { id: 'c:2', lat: 41.1, lon: -8.6, kind: 'exact', cc: 'PT', nameRu: 'Порту', name: 'Porto', count: 1, pop: 5, langs: { pt: 1 } };
const st = (id: string, placeId: string, clicks = 1, langs: string[] = ['pt']): StationLite =>
  ({ id, name: `Radio ${id}`, url: 'https://x', placeId, cc: 'PT', langs, tags: [], votes: 0, clicks, favicon: '', hls: false });
const pt = [st('a', 'c:1', 9, ['pt']), st('b', 'c:1', 3, ['en']), st('p', 'c:2', 1, ['pt'])];
```
- `deps.card = { show: vi.fn(), setLearn: vi.fn() }`
- дописать:
```ts
test('learn mode filters the list, shows the tip and the language subtitle', async () => {
  const app = await startApp(deps);
  app.learn('pt');
  await app.selectPlace(lisbon);
  const body = deps.refs.panelBody;
  expect([...body.querySelectorAll('.station__name')].map((n) => n.textContent)).toEqual(['Radio a']);
  expect(body.querySelector('.list-sub')!.textContent).toBe('Португалия · 1 станция на португальском');
  expect(body.querySelector('.learn-tip')).not.toBeNull();
  expect(deps.refs.banner.hidden).toBe(false);
  expect(deps.refs.learnButton.textContent).toContain('Учу язык: португальский');
});

test('switching the language with an open list and a playing station re-filters without stopping (review focus 1)', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  const plays = player.play.mock.calls.length;
  app.learn('en');
  await flush();
  expect([...deps.refs.panelBody.querySelectorAll('.station__name')].map((n) => n.textContent)).toEqual(['Radio b']);
  expect(player.play.mock.calls.length).toBe(plays);
  expect(player.pause).not.toHaveBeenCalled();
  expect(deps.refs.player.querySelector('.pb__next')!.textContent).toBe('Следующая на английском');
  expect(globe.views[0].refresh).toHaveBeenCalled();
  expect(deps.card.setLearn).toHaveBeenLastCalledWith('en', expect.any(Function));
});

test('a place without stations in the language offers to show all of them', async () => {
  const app = await startApp(deps);
  app.learn('en');
  await app.selectPlace(porto);
  const body = deps.refs.panelBody;
  expect(body.textContent).toContain('Здесь нет станций на английском');
  (body.querySelector('button') as HTMLButtonElement).click();
  await flush();
  expect([...body.querySelectorAll('.station__name')].map((n) => n.textContent)).toEqual(['Radio p']);
});

test('"Следующая на …" only picks stations in the language (review focus 3)', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  app.learn('pt');
  await app.next();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'p' }));
});

test('no next station in the language → language-specific notice', async () => {
  const app = await startApp({ ...deps, blacklist: { add: vi.fn(), has: (id) => id === 'p' } });
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  app.learn('pt');
  await app.next();
  expect(deps.refs.stage.textContent).toContain('Рядом больше нет станций на португальском');
});

test('the card can switch the learn mode on; turning off restores the normal view', async () => {
  const app = await startApp(deps);
  const onLearn = (deps.card.setLearn as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1] as (c: string) => void;
  onLearn('pt');
  expect(deps.refs.banner.hidden).toBe(false);
  (deps.refs.banner.querySelector('button') as HTMLButtonElement).click();
  expect(deps.refs.banner.hidden).toBe(true);
  expect(deps.refs.learnButton.classList.contains('is-learning')).toBe(false);
  app.learn(null);
});

test('learn language is restored from storage at start; unknown one is dropped', async () => {
  deps.storage!.setItem('learnLang', 'pt');
  await startApp(deps);
  expect(deps.refs.banner.hidden).toBe(false);
  deps.storage!.setItem('learnLang', 'tlh');
  document.body.innerHTML = '<div id="app"></div>';
  const refs = renderShell(document.getElementById('app')!, i18n);
  await startApp({ ...deps, refs });
  expect(refs.banner.hidden).toBe(true);
});

test('teal map items get language tooltips', async () => {
  const app = await startApp(deps);
  app.learn('pt');
  const label = globe.cb().label;
  expect(label({ type: 'place', key: 'c:1', place: lisbon, lat: 0, lon: 0, count: 1, pop: 1, tone: 'teal' })).toBe('Лиссабон · 1 станция на португальском');
  expect(label({ type: 'cluster', key: 'cl:1', lat: 0, lon: 0, count: 12, pop: 1, zoomTo: 3, tone: 'teal' })).toBe('12 станций на португальском');
  expect(label({ type: 'place', key: 'c:1', place: lisbon, lat: 0, lon: 0, count: 2, pop: 1, tone: 'muted' })).toBe('Лиссабон · 2 станции');
});
```

- [ ] **Step 2: Run** `npx vitest run tests/app.test.ts` → FAIL.

- [ ] **Step 3: Реализация** `src/app/app.ts`:

Импорты:
```ts
import { prepositional } from '../i18n/ru-grammar';
import { buildLanguageIndex, lowerFirst, type LanguageEntry } from '../learn/language-index';
import { createLearnState, type LearnState } from '../learn/learn-state';
import { createClusterer, layered, type Clusterer, type MapItem } from '../map/cluster';
import { createLearnBanner } from '../ui/learn-banner';
import { createLearnPicker } from '../ui/learn-picker';
```
(старый импорт из `../map/cluster` заменить.)

`AppDeps.card` → `card: { show(d: PlaceCardData | null): void; setLearn(code: string | null, onLearn: (code: string) => void): void };`
`AppHandle` → `export interface AppHandle { mode(): ViewMode; selectPlace(p: Place): Promise<void>; next(): Promise<void>; learn(code: string | null): void }`

Состояние (рядом с `let places…`):
```ts
  let base: Clusterer | null = null;
  let layer: Clusterer | null = null;
  const source: Clusterer = { items: (z) => layer?.items(z) ?? [] };
  let languages: LanguageEntry[] = [];
  let learnState: LearnState | null = null;
  let learnCode: string | null = null;
  let langPrep = '';
```
и удалить `let clusterer: Clusterer | null = null;` (везде, где он использовался, — `source`; проверка готовности `!clusterer` → `!base`).

`label`:
```ts
  const label = (item: MapItem) => {
    if (item.tone === 'teal') {
      return item.type === 'place'
        ? t('learn.tooltip', { place: placeTitle(item.place, i18n.locale), stations: stationsLabel(item.count), langPrep })
        : t('learn.stationsIn', { stations: stationsLabel(item.count), langPrep });
    }
    return item.type === 'place'
      ? t('map.tooltip', { place: placeTitle(item.place, i18n.locale), stations: stationsLabel(item.count) })
      : stationsLabel(item.count);
  };
```

`renderBar`:
```ts
  const renderBar = () => bar.render({
    state: player.getState(), place: placeLabel(playingPlace), volume, muted,
    nextLabel: learnCode ? t('learn.next', { langPrep }) : undefined,
  });
```

`renderList(place, showLoading = true, showAll = false)` — тело после получения `all`:
```ts
      const inPlace = all.filter((s) => s.placeId === place.id);
      const lang = showAll ? null : learnCode;
      const stations = lang ? inPlace.filter((s) => s.langs.includes(lang)) : inPlace;
      if (lang && stations.length === 0) {
        renderListMessage(refs.panelBody, t('learn.empty', { langPrep }), { label: t('learn.showAll'), onClick: () => { void renderList(place, false, true); } });
        return;
      }
      const state = player.getState();
      const count = stationsLabel(stations.length);
      const subtitle = lang
        ? place.kind === 'country' ? t('learn.subtitleApprox', { stations: count, langPrep }) : t('learn.subtitle', { country: countryName(place.cc, i18n.locale), stations: count, langPrep })
        : place.kind === 'country' ? t('list.subtitleApprox', { stations: count }) : t('list.subtitle', { country: countryName(place.cc, i18n.locale), stations: count });
      const handle = renderStationList(refs.panelBody, i18n, {
        title: placeTitle(place, i18n.locale),
        subtitle,
        stations,
        playingId: state.kind === 'idle' ? null : state.station.id,
        onPick: (s) => { void playStation(s, place); },
        learn: lang ? { tip: t('learn.tip'), talkLabel: t('learn.talk') } : undefined,
      });
      list = { placeId: place.id, handle };
```

`next()` — в `findNextNearby({...})` добавить `filter: learnCode ? (s) => s.langs.includes(learnCode!) : undefined,`; уведомление:
```ts
    if (!found) { showToast(refs.stage, learnCode ? t('learn.noNext', { langPrep }) : t('player.noNext')); return; }
```

Применение режима (перед `const handle: AppHandle`):
```ts
  let picker: { update(): void } | null = null;
  const banner = createLearnBanner(refs.banner, i18n, () => learnState?.set(null));
  function applyLearn(code: string | null) {
    learnCode = code;
    const entry = code ? languages.find((e) => e.code === code) ?? null : null;
    langPrep = entry ? prepositional(lowerFirst(entry.name, i18n.locale)) : '';
    if (base) layer = layered(base, code ? createClusterer(places, (p) => p.langs?.[code] ?? 0) : null);
    view?.refresh();
    picker?.update();
    banner.show(entry);
    d.card.setLearn(code, (c) => learnState?.set(c));
    renderBar();
    if (selected) void renderList(selected, false);
  }
```
`handle`:
```ts
  const handle: AppHandle = { mode: () => mode, selectPlace, next, learn: (code) => learnState?.set(code) };
```
После загрузки мест (вместо `clusterer = createClusterer(places);`):
```ts
  base = createClusterer(places);
  layer = base;
  languages = buildLanguageIndex(places, i18n.locale);
  const known = new Set(languages.map((e) => e.code));
  learnState = createLearnState(d.storage, (c) => known.has(c));
  picker = createLearnPicker(i18n, refs.learnButton, {
    languages: () => languages,
    current: () => learnState!.get(),
    onPick: (c) => learnState!.set(c === learnState!.get() ? null : c),
  });
  learnState.subscribe(applyLearn);
  applyLearn(learnState.get());
```
В `mount` вызов фабрики: `d.factories[m](refs.map, source, {...})`. В обработчике кнопок вида: `if (m === mode || !base) return;`. До загрузки мест `d.card.setLearn(null, …)` ещё не вызван — вызвать один раз рядом с `d.card.show(null);`: `d.card.setLearn(null, (c) => learnState?.set(c));`.

`README.md` — раздел «Режим „Учу язык“»: счётчики языков в `places.json`, индекс в браузере, запоминание (`learnLang`), склонение названий языков (`src/i18n/ru-grammar.ts`).

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit && npm run build` → PASS; `index-*.js` gzip вырос не больше чем на ~10 КБ, `places.json` gzip ≈ 186 КБ.

- [ ] **Step 5: Commit** `feat(app): learn-a-language mode wired into map, list, player and card`

- [ ] **Step 6: Приёмка в браузере** (записать в журнал):
1. «Учу язык» → «Испанский» → плашка, бирюзовые места, приглушённые остальные; открыть место в Испании или Мексике → только испанские станции, совет, метки «речь»; включить станцию и нажать «Следующая на испанском» 10 раз — каждая станция с `es` в языках (проверить по `__` в консоли или по списку).
2. Нажать приглушённое место (например, Германия) → «Здесь нет станций на испанском» и «Показать все станции этого места».
3. Карточка: у испанской станции плитка бирюзовая «совпадает с выбранным»; у другой — «Учить этот язык» переключает режим.
4. Перезагрузка — режим восстановлен; «Выключить» — обычный вид.
5. Сравнение с `design/mockups/Language.dc.html` на 1440×900; телефон 390×844 — плашка и список языков без горизонтальной прокрутки.
