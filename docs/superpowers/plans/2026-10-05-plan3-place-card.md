# План 3: карточка места — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Карточка места играющей станции: флаг, место и страна, живое местное время, язык эфира, факт из Википедии (этап 4 ТЗ).

**Architecture:** Часовой пояс и названия статей Википедии готовятся заранее: справочник GeoNames дополняется поясом и ссылками на статьи, снимок кладёт по каждому месту `[id, tz, wikiRu, wikiEn]` в файл страны (первая загрузка не растёт). В браузере чистые модули считают время и названия языков, модуль `wiki` находит статью (ru → межъязыковая ссылка → en) с кешем на 30 дней, модуль `place-card` рисует карточку (ПК и шторка телефона), контроллер `app.ts` показывает её при смене играющей станции с отбрасыванием устаревших ответов.

**Tech Stack:** TypeScript, Vitest + jsdom, flag-icons (MIT, SVG-флаги), Wikipedia REST + Action API (без ключа), `Intl.DateTimeFormat` / `Intl.DisplayNames`.

**Spec:** `docs/superpowers/specs/2026-10-05-plan3-place-card-design.md` (+ `docs/02_tz.md` §4.3, `docs/03_design.md` §6.1, §6.3, `design/mockups/Main.dc.html`).

## Global Constraints

- Ни одной строки интерфейса в `src/` — только `locales/ru.json` (тест `no-hardcoded-strings`).
- Тексты из Википедии и данные станций — только через `textContent`; ссылки строятся из названия статьи (`encodeURIComponent`), не из ответа.
- Цвета — только токены `src/ui/tokens.css`; логические CSS-свойства.
- Флаги — SVG (не эмодзи); грузится только флаг нужной страны.
- Кнопка «Учить этот язык» — неактивна до Плана 4 (подсказка «Появится скоро»).
- Кеш Википедии — `localStorage`, 30 дней, не больше ~200 записей; ошибки сети не кешируются.
- `places.json` не меняется; данные карточки — в файлах стран (`stations/<CC>.json`, поле `places`).
- Размеры по макету: флаг 54×36, заголовок Unbounded 24, время Unbounded 28, фото 150 px, текст 15 px.

## Review Focus

1. **Быстрая смена станций** → в карточке только место последней станции, поздний ответ Википедии для прошлой не попадает (тесты в Task 5 и Task 6).
2. **Текст Википедии с разметкой или очень длинный** → показан как текст, обрезан до ~3 предложений (тесты в Task 4 и Task 5).
3. **Часовые пояса с половинами и четвертями часа (Индия +5:30, Непал +5:45) и летнее время** → правильная подпись разницы (тест в Task 3).
4. **Хранилище переполнено или недоступно** (`QuotaExceededError`) → кеш молча не пишется, карточка работает (тест в Task 4).
5. **Нет данных места** (старый файл страны без `places`, неизвестный id) → флаг, заголовок и язык видны, без времени и Википедии (тесты в Task 5 и Task 6).

---

## File Structure

```
src/data/gazetteer.ts        — + tz, wikiRu, wikiEn (формат v2)
scripts/build-gazetteer.ts   — + чтение timezone и ссылок link
src/data/types.ts            — PlaceRef + необязательные tz / wikiRu / wikiEn
src/data/place-match.ts      — заполняет tz и статьи
src/data/shards.ts           — PlaceInfo, PlaceInfoRow, ShardStore.info(cc)
scripts/build-snapshot.ts    — placeInfoRows()
scripts/snapshot.ts          — пишет places в файлы стран
src/place-card/time.ts       — смещение пояса, часы, подпись разницы
src/place-card/language.ts   — названия языков
src/place-card/flag.ts       — URL SVG-флага
src/place-card/wiki-cache.ts — кеш 30 дней с лимитом
src/place-card/wiki.ts       — поиск статьи и краткого текста
src/place-card/place-card.ts — разметка карточки (ПК + шторка телефона), сворачивание
src/place-card/place-card.css
src/app/app.ts, src/app/main.ts — показ карточки
locales/ru.json
```

---

### Task 1: Справочник — часовые пояса и статьи Википедии

**Files:**
- Modify: `src/data/gazetteer.ts`, `scripts/build-gazetteer.ts`, `tests/gazetteer.test.ts`, `data/gazetteer.json` (пересборка)

**Interfaces:**
- Produces: `GzCity` + `tz: string; wikiRu: string; wikiEn: string`; `GzAdmin1` + `wikiRu: string; wikiEn: string`; `GazetteerFile.v = 2`; `decodeGazetteer` читает и v1 (новые поля = `''`).

- [ ] **Step 1: Тесты** — дописать в `tests/gazetteer.test.ts`:
```ts
test('parseCities reads the timezone column', () => {
  const [c] = parseCities(cityLine(2867714, 'Munich', '', 48.1, 11.5, 'DE', '02', 1260391));
  expect(c.tz).toBe('Europe/Berlin');
  expect([c.wikiRu, c.wikiEn]).toEqual(['', '']);
});

test('applyAltName takes en/ru Wikipedia titles from link rows (first wins, decoded, underscores → spaces)', () => {
  const [city] = parseCities(cityLine(2267057, 'Lisbon', '', 38.7, -9.1, 'PT', '14', 500000));
  const [a] = parseAdmin1('DE.02\tBavaria\tBavaria\t2951839');
  const cities = new Map([[city.id, city]]);
  const admins = new Map([[2951839, a]]);
  applyAltName(['1', '2267057', 'link', 'https://en.wikipedia.org/wiki/Lisbon', '', '', '', ''], cities, admins);
  applyAltName(['2', '2267057', 'link', 'https://en.wikipedia.org/wiki/Lisbon_(other)', '', '', '', ''], cities, admins);
  applyAltName(['3', '2951839', 'link', 'https://ru.wikipedia.org/wiki/%D0%91%D0%B0%D0%B2%D0%B0%D1%80%D0%B8%D1%8F', '', '', '', ''], cities, admins);
  applyAltName(['4', '2951839', 'link', 'https://en.wikipedia.org/wiki/Free_State_of_Bavaria', '', '', '', ''], cities, admins);
  applyAltName(['5', '2951839', 'link', 'https://de.wikipedia.org/wiki/Bayern', '', '', '', ''], cities, admins);
  expect(city.wikiEn).toBe('Lisbon');
  expect(a.wikiRu).toBe('Бавария');
  expect(a.wikiEn).toBe('Free State of Bavaria');
  expect(a.aliases.some((x) => x.includes('wikipedia'))).toBe(false);
});

test('decode reads v1 files without the new fields', () => {
  const v1 = { v: 1, cities: [[1, '', 'X', 1, 2, 'DE', '01', 5, 'x']], admin1: [['DE', '01', '', 'Y', 'y']] };
  const g = decodeGazetteer(v1 as never);
  expect(g.cities[0]).toMatchObject({ tz: '', wikiRu: '', wikiEn: '' });
  expect(g.admin1[0]).toMatchObject({ wikiRu: '', wikiEn: '' });
});
```
В существующем тесте `encode/decode roundtrip` добавить новые поля в объекты: у города `tz: 'Europe/Berlin', wikiRu: 'Мюнхен', wikiEn: 'Munich'`, у региона `wikiRu: 'Бавария', wikiEn: 'Bavaria'`.

- [ ] **Step 2: Run** `npx vitest run tests/gazetteer.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`src/data/gazetteer.ts` — типы и кодирование (заменить соответствующие строки):
```ts
export interface GzCity { id: number; nameRu: string; name: string; lat: number; lon: number; cc: string; admin1: string; pop: number; aliases: string[]; tz: string; wikiRu: string; wikiEn: string }
export interface GzAdmin1 { cc: string; code: string; nameRu: string; name: string; aliases: string[]; wikiRu: string; wikiEn: string }

type CityRow = [id: number, nameRu: string, name: string, lat: number, lon: number, cc: string, admin1: string, pop: number, aliases: string, tz?: string, wikiRu?: string, wikiEn?: string];
type Admin1Row = [cc: string, code: string, nameRu: string, name: string, aliases: string, wikiRu?: string, wikiEn?: string];
export interface GazetteerFile { v: 1 | 2; cities: CityRow[]; admin1: Admin1Row[] }
```
```ts
export function encodeGazetteer(g: Gazetteer): GazetteerFile {
  return {
    v: 2,
    cities: g.cities.map((c) => [c.id, c.nameRu, c.name, c.lat, c.lon, c.cc, c.admin1, c.pop, c.aliases.join('|'), c.tz, c.wikiRu, c.wikiEn]),
    admin1: g.admin1.map((a) => [a.cc, a.code, a.nameRu, a.name, a.aliases.join('|'), a.wikiRu, a.wikiEn]),
  };
}

export function decodeGazetteer(f: GazetteerFile): Gazetteer {
  return {
    cities: f.cities.map(([id, nameRu, name, lat, lon, cc, admin1, pop, aliases, tz, wikiRu, wikiEn]) =>
      ({ id, nameRu, name, lat, lon, cc, admin1, pop, aliases: split(aliases), tz: tz ?? '', wikiRu: wikiRu ?? '', wikiEn: wikiEn ?? '' })),
    admin1: f.admin1.map(([cc, code, nameRu, name, aliases, wikiRu, wikiEn]) =>
      ({ cc, code, nameRu, name, aliases: split(aliases), wikiRu: wikiRu ?? '', wikiEn: wikiEn ?? '' })),
  };
}
```

`scripts/build-gazetteer.ts`:
- в `parseCities` объект города дополнить `tz: f[17] ?? '', wikiRu: '', wikiEn: ''`;
- в `parseAdmin1` объект дополнить `wikiRu: '', wikiEn: ''`;
- в `applyAltName` сразу после вычисления `target` (до проверки `SKIP_LANGS`) вставить:
```ts
  if (target && lang === 'link') {
    const m = WIKI.exec(name ?? '');
    if (m) {
      let title = m[2];
      try { title = decodeURIComponent(title); } catch { /* keep raw */ }
      title = title.replace(/_/g, ' ');
      if (m[1] === 'ru' && !target.wikiRu) target.wikiRu = title;
      if (m[1] === 'en' && !target.wikiEn) target.wikiEn = title;
    }
    return;
  }
```
и над функцией добавить константу `const WIKI = /^https?:\/\/(en|ru)\.wikipedia\.org\/wiki\/(.+)$/;`.

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS (в тестах place-match, где города создаются литералами без новых полей, TypeScript потребует поля — дописать в фикстуры `tz: '', wikiRu: '', wikiEn: ''` у городов и `wikiRu: '', wikiEn: ''` у регионов).

- [ ] **Step 5: Пересобрать справочник** — `npm run gazetteer` (файлы GeoNames уже в `.cache/`).
Expected: `cities: ~34000, admin1: ~3865`; проверка:
```bash
node -e "const g=require('./data/gazetteer.json');const c=g.cities.find(c=>c[2]==='Lisbon');console.log(c[9],c[10],c[11]);const a=g.admin1.find(a=>a[0]==='DE'&&a[1]==='02');console.log(a[5],a[6])"
```
→ `Europe/Lisbon` + статьи; `Бавария`, `Bavaria`/`Free State of Bavaria`.

- [ ] **Step 6: Commit** `feat(data): gazetteer stores timezone and Wikipedia titles`

---

### Task 2: Данные места в файлах стран

**Files:**
- Modify: `src/data/types.ts`, `src/data/place-match.ts`, `src/data/shards.ts`, `scripts/build-snapshot.ts`, `scripts/snapshot.ts`, `tests/place-match.test.ts`, `tests/build-snapshot.test.ts`, `tests/places-client.test.ts`

**Interfaces:**
- Produces:
  - `PlaceRef` + `tz?: string; wikiRu?: string; wikiEn?: string`
  - `src/data/shards.ts`: `interface PlaceInfo { tz: string; wikiRu: string; wikiEn: string }`, `type PlaceInfoRow = [id: string, tz: string, wikiRu: string, wikiEn: string]`, `ShardFile.places?: PlaceInfoRow[]`, `ShardStore.info(cc: string): Promise<Map<string, PlaceInfo>>`
  - `scripts/build-snapshot.ts`: `placeInfoRows(places: Place[], cc: string): PlaceInfoRow[]` (для мест «страна» статьи = `nameRu` / `name`)

- [ ] **Step 1: Тесты**

В `tests/place-match.test.ts` — у города Мюнхен в фикстуре `tz: 'Europe/Berlin', wikiRu: 'Мюнхен', wikiEn: 'Munich'`, у Нюрнберга `tz: 'Europe/Berlin', wikiEn: 'Nuremberg'`, у Москвы и Красногорска `tz: 'Europe/Moscow'`, у Парижа `tz: 'Europe/Paris'`; у Баварии `wikiRu: 'Бавария', wikiEn: 'Bavaria'`; остальные новые поля — `''`. Обновить ожидания:
```ts
test('exact coords within 30 km snap to the city', () =>
  expect(m.match(st({ approx: false, lat: 48.2, lon: 11.6 }))).toEqual({
    id: 'c:1', lat: 48.137, lon: 11.575, kind: 'exact', cc: 'DE', nameRu: 'Мюнхен', name: 'Munich',
    tz: 'Europe/Berlin', wikiRu: 'Мюнхен', wikiEn: 'Munich',
  }));
```
```ts
test('region field matches admin1 and uses its most populous city', () =>
  expect(m.match(st({ state: 'Bayern' }))).toEqual({
    id: 'a:DE.02', lat: 48.137, lon: 11.575, kind: 'region', cc: 'DE', nameRu: 'Бавария', name: 'Bavaria',
    tz: 'Europe/Berlin', wikiRu: 'Бавария', wikiEn: 'Bavaria',
  }));
```
```ts
test('unknown region → country centroid', () =>
  expect(m.match(st({ state: 'Atlantis' }))).toEqual({
    id: 'k:DE', lat: 51, lon: 9, kind: 'country', cc: 'DE', nameRu: 'Германия', name: 'Germany', tz: 'Europe/Berlin',
  }));
```
и дописать:
```ts
test('far exact point takes the nearest same-country city timezone and article', () =>
  expect(m.match(st({ approx: false, lat: 48.9, lon: 11.3 }))).toMatchObject({ tz: 'Europe/Berlin', wikiEn: 'Nuremberg' }));

test('country timezone is set only when every city of the country shares one', () => {
  const multi = createPlaceMatcher({
    cities: [
      { id: 7, nameRu: '', name: 'A', lat: 40, lon: -74, cc: 'US', admin1: 'NY', pop: 1, aliases: ['a'], tz: 'America/New_York', wikiRu: '', wikiEn: '' },
      { id: 8, nameRu: '', name: 'B', lat: 34, lon: -118, cc: 'US', admin1: 'CA', pop: 1, aliases: ['b'], tz: 'America/Los_Angeles', wikiRu: '', wikiEn: '' },
    ],
    admin1: [],
  }, { US: [39, -98] }, (cc) => cc);
  expect(multi.match(st({ cc: 'US' }))!.tz).toBeUndefined();
});
```

В `tests/build-snapshot.test.ts` дописать:
```ts
test('placeInfoRows: per-country place data, countries use their own names as articles', async () => {
  const { placeInfoRows } = await import('../scripts/build-snapshot');
  const places: Place[] = [
    { id: 'c:1', lat: 0, lon: 0, kind: 'exact', cc: 'DE', nameRu: 'Мюнхен', name: 'Munich', count: 1, pop: 1, tz: 'Europe/Berlin', wikiRu: 'Мюнхен', wikiEn: 'Munich' },
    { id: 'k:DE', lat: 0, lon: 0, kind: 'country', cc: 'DE', nameRu: 'Германия', name: 'Germany', count: 1, pop: 1, tz: 'Europe/Berlin' },
    { id: 'k:FR', lat: 0, lon: 0, kind: 'country', cc: 'FR', nameRu: 'Франция', name: 'France', count: 1, pop: 1 },
  ];
  expect(placeInfoRows(places, 'DE')).toEqual([
    ['c:1', 'Europe/Berlin', 'Мюнхен', 'Munich'],
    ['k:DE', 'Europe/Berlin', 'Германия', 'Germany'],
  ]);
  expect(placeInfoRows(places, 'FR')).toEqual([['k:FR', '', 'Франция', 'France']]);
});
```

В `tests/places-client.test.ts` дописать:
```ts
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
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/data/types.ts` — `PlaceRef`:
```ts
export interface PlaceRef { id: string; lat: number; lon: number; kind: PlaceKind; cc: string; nameRu: string; name: string; tz?: string; wikiRu?: string; wikiEn?: string }
```

`src/data/place-match.ts`:
- после построения индексов:
```ts
  // A country gets a timezone only if all its cities share one (single-zone countries).
  const countryZones = new Map<string, Set<string>>();
  for (const c of gz.cities) if (c.tz) (countryZones.get(c.cc) ?? countryZones.set(c.cc, new Set()).get(c.cc)!).add(c.tz);
  const countryTz = (cc: string) => { const z = countryZones.get(cc); return z && z.size === 1 ? [...z][0] : undefined; };
```
- `cityRef` возвращает также `tz: c.tz, wikiRu: c.wikiRu, wikiEn: c.wikiEn`;
- точка вдали от города: добавить `tz: named?.tz || countryTz(s.cc), wikiRu: named?.wikiRu, wikiEn: named?.wikiEn`;
- регион: добавить `tz: center.tz, wikiRu: a.wikiRu, wikiEn: a.wikiEn`;
- страна: добавить `tz: countryTz(s.cc)`.
(Поля со значением `undefined` не мешают `toEqual`.)

`src/data/shards.ts` — добавить типы и переписать хранилище:
```ts
export interface PlaceInfo { tz: string; wikiRu: string; wikiEn: string }
export type PlaceInfoRow = [id: string, tz: string, wikiRu: string, wikiEn: string];
```
`ShardFile` → `export interface ShardFile { v: 2; cc: string; stations: CompactStationV2[]; places?: PlaceInfoRow[] }`
```ts
export interface ShardStore { get(cc: string): Promise<StationLite[]>; info(cc: string): Promise<Map<string, PlaceInfo>> }

interface LoadedShard { stations: StationLite[]; info: Map<string, PlaceInfo> }

export function createShardStore(baseUrl: string, fetchFn: typeof fetch = fetch): ShardStore {
  const cache = new Map<string, Promise<LoadedShard>>();
  async function load(cc: string): Promise<LoadedShard> {
    const r = await fetchFn(`${baseUrl}data/stations/${cc}.json`);
    if (!r.ok) throw new Error(`stations ${cc} HTTP ${r.status}`);
    const body = (await r.json()) as Partial<ShardFile>;
    if (body.v !== 2 || !Array.isArray(body.stations)) throw new Error('unsupported stations format');
    const info = new Map<string, PlaceInfo>((body.places ?? []).map(([id, tz, wikiRu, wikiEn]) => [id, { tz, wikiRu, wikiEn }]));
    return { stations: body.stations.map((c) => decodeStation(c, cc)), info };
  }
  function file(cc: string): Promise<LoadedShard> {
    let p = cache.get(cc);
    if (!p) {
      p = load(cc);
      cache.set(cc, p);
      p.catch(() => cache.delete(cc));
    }
    return p;
  }
  return {
    get: (cc) => file(cc).then((f) => f.stations),
    info: (cc) => file(cc).then((f) => f.info),
  };
}
```
(Тест `shard store caches…` проверяет `a toBe b` — `.then(f => f.stations)` возвращает один и тот же массив.)

`scripts/build-snapshot.ts` — дописать:
```ts
import type { PlaceInfoRow } from '../src/data/shards';

export function placeInfoRows(places: Place[], cc: string): PlaceInfoRow[] {
  return places
    .filter((p) => p.cc === cc)
    .map((p) => p.kind === 'country'
      ? [p.id, p.tz ?? '', p.nameRu, p.name]
      : [p.id, p.tz ?? '', p.wikiRu ?? '', p.wikiEn ?? '']);
}
```
(импорт — к остальным импортам вверху файла.)

`scripts/snapshot.ts` — в цикле записи файлов стран:
```ts
  const file: ShardFile = { v: 2, cc, stations: list.map(encodeStation), places: placeInfoRows(places, cc) };
```
и импорт `import { buildSnapshot, placeInfoRows } from './build-snapshot';`.

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Живой снимок** — `npm run snapshot`, затем:
```bash
node -e "const f=require('./public/data/stations/PT.json');console.log(f.places.length, f.places.find(p=>p[3]==='Lisbon'));const de=require('./public/data/stations/DE.json');console.log(de.places.find(p=>p[0]==='k:DE'))"
```
Expected: место Лиссабона с `Europe/Lisbon` и статьёй; `k:DE` → `Europe/Berlin`, `Германия`, `Germany`. `public/data/places.json` по размеру gzip не изменился (±1 %).

- [ ] **Step 6: Commit** `feat(data): per-country place info (timezone, Wikipedia titles) in station files`

---

### Task 3: Время, языки, флаги

**Files:**
- Create: `src/place-card/time.ts`, `src/place-card/language.ts`, `src/place-card/flag.ts`, `tests/place-time.test.ts`
- Modify: `package.json` (`flag-icons`), `locales/ru.json`

**Interfaces:**
- Produces:
  - `isValidTimeZone(tz: string): boolean`
  - `offsetMinutes(tz: string, at: Date): number` — смещение пояса от UTC в минутах
  - `formatClock(tz: string, at: Date, locale: string): string` — «14:32»
  - `diffLabel(i18n: I18n, placeOffset: number, userOffset: number): string`
  - `msUntilNextMinute(nowMs: number): number`
  - `languageNames(codes: string[], locale: string): string` — «португальский, английский» или `''`
  - `flagUrl(cc: string): string | null`

- [ ] **Step 1: Зависимость и тексты**

```bash
npm i flag-icons
```
В `locales/ru.json` добавить:
```json
  "place.empty": "Карточка места появится, когда начнёт играть станция",
  "place.approx": "Примерное расположение станций",
  "place.expand": "Развернуть карточку",
  "place.time": "Местное время",
  "place.time.same": "как у вас",
  "place.time.earlier": "на {diff} раньше вас",
  "place.time.later": "на {diff} позже вас",
  "place.time.h": "{h} ч",
  "place.time.m": "{m} мин",
  "place.time.hm": "{h} ч {m} мин",
  "place.lang": "Язык эфира",
  "place.lang.none": "Язык не указан",
  "place.learn": "Учить этот язык",
  "place.wiki.read": "Читать в Википедии",
  "place.wiki.more": "Подробнее в Википедии",
  "place.wiki.english": "Статья на английском"
```

- [ ] **Step 2: Тесты**

`tests/place-time.test.ts`:
```ts
import { expect, test } from 'vitest';
import ru from '../locales/ru.json';
import { createI18n } from '../src/i18n/i18n';
import { flagUrl } from '../src/place-card/flag';
import { languageNames } from '../src/place-card/language';
import { diffLabel, formatClock, isValidTimeZone, msUntilNextMinute, offsetMinutes } from '../src/place-card/time';

const i18n = createI18n('ru', ru);
const jan = new Date(Date.UTC(2026, 0, 15, 12, 0));
const jul = new Date(Date.UTC(2026, 6, 15, 12, 0));

test('offsets incl. DST and half/quarter hours (review focus 3)', () => {
  expect(offsetMinutes('Europe/Berlin', jan)).toBe(60);
  expect(offsetMinutes('Europe/Berlin', jul)).toBe(120);
  expect(offsetMinutes('Asia/Kolkata', jan)).toBe(330);
  expect(offsetMinutes('Asia/Kathmandu', jan)).toBe(345);
  expect(offsetMinutes('America/New_York', jan)).toBe(-300);
  expect(offsetMinutes('UTC', jan)).toBe(0);
});

test('clock in the place timezone', () => {
  expect(formatClock('Europe/Lisbon', new Date(Date.UTC(2026, 0, 15, 14, 32)), 'ru')).toBe('14:32');
  expect(formatClock('Asia/Tokyo', new Date(Date.UTC(2026, 0, 15, 23, 5)), 'ru')).toBe('08:05');
});

test('difference label', () => {
  expect(diffLabel(i18n, 60, 180)).toBe('на 2 ч раньше вас');
  expect(diffLabel(i18n, 330, 180)).toBe('на 2 ч 30 мин позже вас');
  expect(diffLabel(i18n, 225, 180)).toBe('на 45 мин позже вас');
  expect(diffLabel(i18n, 180, 180)).toBe('как у вас');
});

test('timezone validation', () => {
  expect(isValidTimeZone('Europe/Lisbon')).toBe(true);
  expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  expect(isValidTimeZone('')).toBe(false);
});

test('next minute boundary', () => {
  expect(msUntilNextMinute(Date.UTC(2026, 0, 1, 0, 0, 59, 500))).toBe(500);
  expect(msUntilNextMinute(Date.UTC(2026, 0, 1, 0, 1, 0, 0))).toBe(60000);
});

test('language names in the UI language, lower-case, comma-separated', () => {
  expect(languageNames(['pt'], 'ru')).toBe('португальский');
  expect(languageNames(['es', 'ca'], 'ru')).toBe('испанский, каталанский');
  expect(languageNames([], 'ru')).toBe('');
});

test('flag url for known countries only', () => {
  expect(flagUrl('PT')).toMatch(/pt.*\.svg/);
  expect(flagUrl('pt')).toBe(flagUrl('PT'));
  expect(flagUrl('QQ')).toBeNull();
});
```

- [ ] **Step 3: Run** → FAIL.

- [ ] **Step 4: Реализация**

`src/place-card/time.ts`:
```ts
import type { I18n } from '../i18n/i18n';

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

const partsFormat = new Map<string, Intl.DateTimeFormat>();
export function offsetMinutes(tz: string, at: Date): number {
  let f = partsFormat.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    partsFormat.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  const atMinute = Math.floor(at.getTime() / 60000) * 60000;
  return Math.round((asUtc - atMinute) / 60000);
}

export function formatClock(tz: string, at: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
}

export function diffLabel(i18n: I18n, placeOffset: number, userOffset: number): string {
  const diff = placeOffset - userOffset;
  if (diff === 0) return i18n.t('place.time.same');
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const text = h && m ? i18n.t('place.time.hm', { h, m }) : h ? i18n.t('place.time.h', { h }) : i18n.t('place.time.m', { m });
  return i18n.t(diff > 0 ? 'place.time.later' : 'place.time.earlier', { diff: text });
}

export function msUntilNextMinute(nowMs: number): number {
  return 60000 - (nowMs % 60000);
}
```

`src/place-card/language.ts`:
```ts
const cache = new Map<string, Intl.DisplayNames>();

export function languageNames(codes: string[], locale: string): string {
  let d = cache.get(locale);
  if (!d) { d = new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' }); cache.set(locale, d); }
  const names = codes.map((c) => { try { return d!.of(c); } catch { return undefined; } }).filter((n): n is string => !!n);
  return names.map((n) => n.charAt(0).toLocaleLowerCase(locale) + n.slice(1)).join(', ');
}
```

`src/place-card/flag.ts`:
```ts
// Only the URLs are bundled (a few KB); each SVG is fetched when its flag is shown.
const urls = import.meta.glob('../../node_modules/flag-icons/flags/4x3/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const byCode = new Map(Object.entries(urls).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]));

export function flagUrl(cc: string): string | null {
  return byCode.get(cc.toLowerCase()) ?? null;
}
```

- [ ] **Step 5: Run** `npx vitest run && npx tsc --noEmit` → PASS. Если glob по `node_modules` не находит файлы — проверить путь `node_modules/flag-icons/flags/4x3/pt.svg` и поправить шаблон (Ruling).

- [ ] **Step 6: Commit** `feat(place-card): local time, language names and SVG flags`

---

### Task 4: Википедия — поиск статьи и кеш

**Files:**
- Create: `src/place-card/wiki-cache.ts`, `src/place-card/wiki.ts`, `tests/wiki.test.ts`

**Interfaces:**
- Consumes: `PlaceInfo` (Task 2).
- Produces:
  - `interface WikiCache { get<T>(key: string): T | undefined; set(key: string, value: unknown): void }`; `createWikiCache(storage: Storage | null, now?: () => number, ttlMs?: number, limit?: number): WikiCache`; `WIKI_TTL_MS = 30 * 24 * 3600 * 1000`
  - `interface WikiSummary { lang: 'ru' | 'en'; title: string; text: string; image: string; url: string }`
  - `interface WikiResult { summary: WikiSummary | null; link: string | null }`
  - `articleUrl(lang: 'ru' | 'en', title: string): string`
  - `trimSentences(text: string, max?: number, maxChars?: number): string`
  - `findArticle(info: Pick<PlaceInfo, 'wikiRu' | 'wikiEn'>, fetchFn: typeof fetch, cache: WikiCache): Promise<WikiResult>`

- [ ] **Step 1: Тесты**

`tests/wiki.test.ts`:
```ts
import { expect, test, vi } from 'vitest';
import { createWikiCache, WIKI_TTL_MS } from '../src/place-card/wiki-cache';
import { articleUrl, findArticle, trimSentences } from '../src/place-card/wiki';

class Mem {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const summary = (title: string, extract: string, img = 'https://upload.wikimedia.org/x.jpg') =>
  ({ type: 'standard', title, extract, thumbnail: { source: img } });

function wikiFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (u: string) => {
    for (const [k, r] of Object.entries(routes)) if (u.includes(k)) return r();
    return json({}, 404);
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

test('Russian article first, url built from the title', async () => {
  const f = wikiFetch({ 'ru.wikipedia.org/api/rest_v1/page/summary/%D0%9B%D0%B8%D1%81%D1%81%D0%B0%D0%B1%D0%BE%D0%BD': () => json(summary('Лиссабон', 'Лиссабон — столица Португалии. Город на реке Тежу.')) });
  const r = await findArticle({ wikiRu: 'Лиссабон', wikiEn: 'Lisbon' }, f, createWikiCache(null));
  expect(r.summary).toMatchObject({ lang: 'ru', title: 'Лиссабон', text: 'Лиссабон — столица Португалии. Город на реке Тежу.', image: 'https://upload.wikimedia.org/x.jpg' });
  expect(r.link).toBe(articleUrl('ru', 'Лиссабон'));
  expect(r.link).toBe('https://ru.wikipedia.org/wiki/%D0%9B%D0%B8%D1%81%D1%81%D0%B0%D0%B1%D0%BE%D0%BD');
});

test('no Russian title → Russian article via langlinks of the English one', async () => {
  const f = wikiFetch({
    'en.wikipedia.org/w/api.php': () => json({ query: { pages: [{ title: 'Lisbon', langlinks: [{ lang: 'ru', title: 'Лиссабон' }] }] } }),
    'ru.wikipedia.org/api/rest_v1/page/summary/': () => json(summary('Лиссабон', 'Текст.')),
  });
  const r = await findArticle({ wikiRu: '', wikiEn: 'Lisbon' }, f, createWikiCache(null));
  expect(r.summary).toMatchObject({ lang: 'ru', title: 'Лиссабон' });
});

test('no Russian article at all → English with lang en', async () => {
  const f = wikiFetch({
    'en.wikipedia.org/w/api.php': () => json({ query: { pages: [{ title: 'Smallville' }] } }),
    'en.wikipedia.org/api/rest_v1/page/summary/Smallville': () => json(summary('Smallville', 'A town.')),
  });
  const r = await findArticle({ wikiRu: '', wikiEn: 'Smallville' }, f, createWikiCache(null));
  expect(r.summary).toMatchObject({ lang: 'en', text: 'A town.' });
  expect(r.link).toBe('https://en.wikipedia.org/wiki/Smallville');
});

test('network error → link only; nothing known → nothing', async () => {
  const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  expect(await findArticle({ wikiRu: 'Лиссабон', wikiEn: '' }, down, createWikiCache(null))).toEqual({ summary: null, link: articleUrl('ru', 'Лиссабон') });
  expect(await findArticle({ wikiRu: '', wikiEn: '' }, down, createWikiCache(null))).toEqual({ summary: null, link: null });
});

test('disambiguation pages and non-Wikimedia images are not shown', async () => {
  const f = wikiFetch({
    'summary/A': () => json({ type: 'disambiguation', title: 'A', extract: 'A may refer to:' }),
    'summary/B': () => json(summary('B', 'Bee.', 'https://evil.example/x.jpg')),
  });
  expect((await findArticle({ wikiRu: 'A', wikiEn: '' }, f, createWikiCache(null))).summary).toBeNull();
  expect((await findArticle({ wikiRu: 'B', wikiEn: '' }, f, createWikiCache(null))).summary!.image).toBe('');
});

test('long text is trimmed to 3 sentences / ~320 chars (review focus 2)', () => {
  expect(trimSentences('Один. Два! Три? Четыре.')).toBe('Один. Два! Три?');
  const long = `${'слово '.repeat(100)}конец.`;
  const t = trimSentences(long);
  expect(t.length).toBeLessThanOrEqual(321);
  expect(t.endsWith('…')).toBe(true);
  expect(trimSentences('')).toBe('');
});

test('successful answers are cached, errors are not', async () => {
  const cache = createWikiCache(new Mem() as unknown as Storage);
  const f = wikiFetch({ 'summary/X': () => json(summary('X', 'Икс.')) });
  await findArticle({ wikiRu: 'X', wikiEn: '' }, f, cache);
  await findArticle({ wikiRu: 'X', wikiEn: '' }, f, cache);
  expect(f).toHaveBeenCalledTimes(1);
  let n = 0;
  const flaky = (async () => { n++; throw new Error('net'); }) as unknown as typeof fetch;
  await findArticle({ wikiRu: 'Y', wikiEn: '' }, flaky, cache);
  await findArticle({ wikiRu: 'Y', wikiEn: '' }, flaky, cache);
  expect(n).toBe(2);
});

test('cache expires after 30 days and keeps at most the limit', () => {
  let t = 0;
  const s = new Mem() as unknown as Storage;
  const c = createWikiCache(s, () => t, WIKI_TTL_MS, 2);
  c.set('a', 1);
  c.set('b', 2);
  c.set('c', 3);
  expect(c.get('a')).toBeUndefined();
  expect(c.get('c')).toBe(3);
  t += WIKI_TTL_MS + 1;
  expect(c.get('c')).toBeUndefined();
});

test('storage that throws on write (quota) does not break anything (review focus 4)', () => {
  const quota = { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); }, removeItem: () => {} } as unknown as Storage;
  const c = createWikiCache(quota);
  expect(() => c.set('a', 1)).not.toThrow();
  expect(c.get('a')).toBeUndefined();
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/place-card/wiki-cache.ts`:
```ts
export const WIKI_TTL_MS = 30 * 24 * 3600 * 1000;
const INDEX = 'wiki:index';

export interface WikiCache { get<T>(key: string): T | undefined; set(key: string, value: unknown): void }

export function createWikiCache(storage: Storage | null, now: () => number = Date.now, ttlMs = WIKI_TTL_MS, limit = 200): WikiCache {
  const read = (k: string): unknown => { try { const s = storage?.getItem(k); return s ? JSON.parse(s) : undefined; } catch { return undefined; } };
  const write = (k: string, v: unknown) => { try { storage?.setItem(k, JSON.stringify(v)); } catch { /* full or unavailable */ } };
  const remove = (k: string) => { try { storage?.removeItem(k); } catch { /* unavailable */ } };

  return {
    get<T>(key: string): T | undefined {
      const e = read(`wiki:${key}`) as { at: number; v: T } | undefined;
      if (!e || typeof e.at !== 'number') return undefined;
      if (now() - e.at > ttlMs) { remove(`wiki:${key}`); return undefined; }
      return e.v;
    },
    set(key, value) {
      const index = ((read(INDEX) as string[] | undefined) ?? []).filter((k) => k !== key);
      index.push(key);
      while (index.length > limit) remove(`wiki:${index.shift()!}`);
      write(`wiki:${key}`, { at: now(), v: value });
      write(INDEX, index);
    },
  };
}
```

`src/place-card/wiki.ts`:
```ts
import type { PlaceInfo } from '../data/shards';
import type { WikiCache } from './wiki-cache';

export interface WikiSummary { lang: 'ru' | 'en'; title: string; text: string; image: string; url: string }
export interface WikiResult { summary: WikiSummary | null; link: string | null }
type Lang = 'ru' | 'en';

const path = (title: string) => encodeURIComponent(title.replace(/ /g, '_'));
export const articleUrl = (lang: Lang, title: string) => `https://${lang}.wikipedia.org/wiki/${path(title)}`;

export function trimSentences(text: string, max = 3, maxChars = 320): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentences = clean.split(/(?<=[.!?…])\s+/);
  let out = '';
  for (const s of sentences.slice(0, max)) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > maxChars) break;
    out = next;
  }
  if (out) return out;
  const cut = clean.slice(0, maxChars);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 1)).trimEnd()}…`;
}

class NetworkError extends Error {}

// Returns undefined when the article does not exist; throws NetworkError on connectivity problems.
async function summary(lang: Lang, title: string, fetchFn: typeof fetch, cache: WikiCache): Promise<WikiSummary | undefined> {
  const key = `${lang}:${title}`;
  const hit = cache.get<WikiSummary | null>(key);
  if (hit !== undefined) return hit ?? undefined;
  let r: Response;
  try { r = await fetchFn(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${path(title)}`); } catch { throw new NetworkError(); }
  if (r.status === 404) { cache.set(key, null); return undefined; }
  if (!r.ok) throw new NetworkError();
  const b = (await r.json()) as { type?: string; extract?: string; thumbnail?: { source?: string } };
  if (b.type === 'disambiguation' || !b.extract) { cache.set(key, null); return undefined; }
  const img = b.thumbnail?.source ?? '';
  const s: WikiSummary = { lang, title, text: trimSentences(b.extract), image: img.startsWith('https://upload.wikimedia.org/') ? img : '', url: articleUrl(lang, title) };
  cache.set(key, s);
  return s;
}

async function ruTitleFor(enTitle: string, fetchFn: typeof fetch, cache: WikiCache): Promise<string | null> {
  const key = `ll:${enTitle}`;
  const hit = cache.get<string | null>(key);
  if (hit !== undefined) return hit;
  let r: Response;
  try {
    r = await fetchFn(`https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=ru&redirects=1&format=json&formatversion=2&origin=*&titles=${encodeURIComponent(enTitle)}`);
  } catch { throw new NetworkError(); }
  if (!r.ok) throw new NetworkError();
  const b = (await r.json()) as { query?: { pages?: { langlinks?: { title?: string }[] }[] } };
  const ru = b.query?.pages?.[0]?.langlinks?.[0]?.title ?? null;
  cache.set(key, ru);
  return ru;
}

export async function findArticle(info: Pick<PlaceInfo, 'wikiRu' | 'wikiEn'>, fetchFn: typeof fetch, cache: WikiCache): Promise<WikiResult> {
  let fallback: string | null = info.wikiRu ? articleUrl('ru', info.wikiRu) : info.wikiEn ? articleUrl('en', info.wikiEn) : null;
  try {
    let ruTitle = info.wikiRu || null;
    if (!ruTitle && info.wikiEn) ruTitle = await ruTitleFor(info.wikiEn, fetchFn, cache);
    if (ruTitle) {
      fallback = articleUrl('ru', ruTitle);
      const s = await summary('ru', ruTitle, fetchFn, cache);
      if (s) return { summary: s, link: s.url };
    }
    if (info.wikiEn) {
      const s = await summary('en', info.wikiEn, fetchFn, cache);
      if (s) return { summary: s, link: s.url };
    }
    return { summary: null, link: null };
  } catch {
    return { summary: null, link: fallback };
  }
}
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(place-card): Wikipedia article lookup (ru → langlinks → en) with 30-day cache`

---

### Task 5: Карточка места — разметка, ПК и телефон

**Files:**
- Create: `src/place-card/place-card.ts`, `src/place-card/place-card.css`, `tests/place-card.test.ts`
- Modify: `src/ui/shell.css` (удалить правило `.place__head`, если мешает; см. Step 4)

**Interfaces:**
- Consumes: `Place` (План 2), `StationLite`, `PlaceInfo` (Task 2), `WikiResult` (Task 4), time/language/flag (Task 3), `I18n`.
- Produces:
  ```ts
  export interface PlaceCardData { place: Place; station: StationLite; info: PlaceInfo | null }
  export interface PlaceCardDeps {
    i18n: I18n; storage: Storage | null;
    flagUrl(cc: string): string | null;
    findArticle(info: PlaceInfo): Promise<WikiResult>;
    now(): Date; userOffset(): number;
  }
  export interface PlaceCard { show(d: PlaceCardData | null): void; destroy(): void }
  export const COLLAPSE_KEY = 'placeCardCollapsed';
  export function createPlaceCard(panel: HTMLElement, sheetHost: HTMLElement, deps: PlaceCardDeps): PlaceCard
  ```
  `panel` — правая панель (`refs.placeCard`), её содержимое заменяется; `sheetHost` — `refs.stage` (туда добавляется шторка телефона `.pc-sheet`).

- [ ] **Step 1: Тесты**

`tests/place-card.test.ts`:
```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import type { Place } from '../src/data/places';
import type { PlaceInfo, StationLite } from '../src/data/shards';
import { createI18n } from '../src/i18n/i18n';
import { COLLAPSE_KEY, createPlaceCard, type PlaceCardDeps } from '../src/place-card/place-card';
import type { WikiResult } from '../src/place-card/wiki';

const i18n = createI18n('ru', ru);
const lisbon: Place = { id: 'c:1', lat: 38.7, lon: -9.1, kind: 'exact', cc: 'PT', nameRu: 'Лиссабон', name: 'Lisbon', count: 12, pop: 1 };
const country: Place = { ...lisbon, id: 'k:PT', kind: 'country' };
const st = (langs: string[] = ['pt']): StationLite =>
  ({ id: 's', name: 'Fado', url: 'https://x', placeId: 'c:1', cc: 'PT', langs, tags: [], votes: 0, clicks: 0, favicon: '', hls: false });
const info: PlaceInfo = { tz: 'Europe/Lisbon', wikiRu: 'Лиссабон', wikiEn: 'Lisbon' };
const wiki = (text: string, lang: 'ru' | 'en' = 'ru'): WikiResult =>
  ({ summary: { lang, title: 'T', text, image: 'https://upload.wikimedia.org/p.jpg', url: 'https://ru.wikipedia.org/wiki/T' }, link: 'https://ru.wikipedia.org/wiki/T' });

class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } }

let panel: HTMLElement;
let stage: HTMLElement;
let deps: PlaceCardDeps;
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 0, 15, 14, 32, 30)));
  document.body.innerHTML = '<aside class="shell__place"></aside><main></main>';
  panel = document.querySelector('aside')!;
  stage = document.querySelector('main')!;
  deps = {
    i18n,
    storage: new Mem() as unknown as Storage,
    flagUrl: (cc) => (cc === 'PT' ? '/flags/pt.svg' : null),
    findArticle: vi.fn(async () => wiki('Лиссабон — столица Португалии.')),
    now: () => new Date(),
    userOffset: () => 180,
  };
});
afterEach(() => vi.useRealTimers());
const q = (s: string) => panel.querySelector(s) as HTMLElement;

test('empty state before anything plays', () => {
  createPlaceCard(panel, stage, deps).show(null);
  expect(panel.textContent).toContain('Карточка места появится');
  expect(q('.pc__content').hidden).toBe(true);
});

test('city card: flag, title, country, time, difference, language, disabled learn button, wiki', async () => {
  createPlaceCard(panel, stage, deps).show({ place: lisbon, station: st(['pt']), info });
  await flush();
  expect((q('.pc__flag') as HTMLImageElement).src).toContain('/flags/pt.svg');
  expect(q('.pc__name').textContent).toBe('Лиссабон');
  expect(q('.pc__country').textContent).toBe('Португалия');
  expect(q('.pc__clock').textContent).toBe('14:32');
  expect(q('.pc__diff').textContent).toBe('на 3 ч раньше вас');
  expect(q('.pc__langs').textContent).toBe('португальский');
  const learn = q('.pc__learn') as HTMLButtonElement;
  expect(learn.disabled).toBe(true);
  expect(learn.title).toBe('Появится скоро');
  expect(q('.pc__text').textContent).toBe('Лиссабон — столица Португалии.');
  expect((q('.pc__link') as HTMLAnchorElement).href).toBe('https://ru.wikipedia.org/wiki/T');
  expect(q('.pc__link').textContent).toContain('Читать в Википедии');
  expect(q('.pc__note').hidden).toBe(true);
});

test('country card says the location is approximate', () => {
  createPlaceCard(panel, stage, deps).show({ place: country, station: st(), info });
  expect(q('.pc__name').textContent).toBe('Португалия');
  expect(q('.pc__country').textContent).toBe('Примерное расположение станций');
});

test('missing place info: no time tile, no wiki, flag/title/language still shown (review focus 5)', async () => {
  createPlaceCard(panel, stage, deps).show({ place: lisbon, station: st([]), info: null });
  await flush();
  expect(q('.pc__time').hidden).toBe(true);
  expect(q('.pc__wiki').hidden).toBe(true);
  expect(q('.pc__langs').textContent).toBe('Язык не указан');
  expect(deps.findArticle).not.toHaveBeenCalled();
});

test('unknown timezone hides the time tile; unknown flag hides the flag', () => {
  createPlaceCard(panel, stage, deps).show({ place: { ...lisbon, cc: 'QQ' }, station: st(), info: { ...info, tz: 'Mars/Olympus' } });
  expect(q('.pc__time').hidden).toBe(true);
  expect(q('.pc__flag').hidden).toBe(true);
});

test('English article gets a note; link-only result shows "Подробнее"; nothing hides the block', async () => {
  const card = createPlaceCard(panel, stage, deps);
  deps.findArticle = vi.fn(async () => wiki('A town.', 'en'));
  card.show({ place: lisbon, station: st(), info });
  await flush();
  expect(q('.pc__note').hidden).toBe(false);
  expect(q('.pc__note').textContent).toBe('Статья на английском');
  deps.findArticle = vi.fn(async () => ({ summary: null, link: 'https://ru.wikipedia.org/wiki/X' }));
  card.show({ place: { ...lisbon, id: 'c:2' }, station: st(), info });
  await flush();
  expect(q('.pc__text').hidden).toBe(true);
  expect(q('.pc__link').textContent).toContain('Подробнее в Википедии');
  deps.findArticle = vi.fn(async () => ({ summary: null, link: null }));
  card.show({ place: { ...lisbon, id: 'c:3' }, station: st(), info });
  await flush();
  expect(q('.pc__wiki').hidden).toBe(true);
});

test('Wikipedia text with markup is shown as text (review focus 2)', async () => {
  deps.findArticle = vi.fn(async () => wiki('<img src=x onerror=alert(1)> текст'));
  createPlaceCard(panel, stage, deps).show({ place: lisbon, station: st(), info });
  await flush();
  expect(panel.querySelector('.pc__text img')).toBeNull();
  expect(q('.pc__text').textContent).toBe('<img src=x onerror=alert(1)> текст');
});

test('a late answer for a previous place is dropped (review focus 1)', async () => {
  let releaseA!: (r: WikiResult) => void;
  deps.findArticle = vi.fn((i: PlaceInfo) => (i.wikiRu === 'A' ? new Promise<WikiResult>((r) => { releaseA = r; }) : Promise.resolve(wiki('B text'))));
  const card = createPlaceCard(panel, stage, deps);
  card.show({ place: lisbon, station: st(), info: { ...info, wikiRu: 'A' } });
  card.show({ place: { ...lisbon, id: 'c:2', nameRu: 'Порту' }, station: st(), info: { ...info, wikiRu: 'B' } });
  await flush();
  releaseA(wiki('A text'));
  await flush();
  expect(q('.pc__name').textContent).toBe('Порту');
  expect(q('.pc__text').textContent).toBe('B text');
});

test('same place again (pause/resume) does not refetch; new station updates language only', async () => {
  const card = createPlaceCard(panel, stage, deps);
  card.show({ place: lisbon, station: st(['pt']), info });
  await flush();
  card.show({ place: lisbon, station: { ...st(['en']), id: 's2' }, info });
  await flush();
  expect(deps.findArticle).toHaveBeenCalledTimes(1);
  expect(q('.pc__langs').textContent).toBe('английский');
});

test('clock ticks on the minute boundary', async () => {
  createPlaceCard(panel, stage, deps).show({ place: lisbon, station: st(), info });
  expect(q('.pc__clock').textContent).toBe('14:32');
  await vi.advanceTimersByTimeAsync(30_000);
  expect(q('.pc__clock').textContent).toBe('14:33');
  await vi.advanceTimersByTimeAsync(60_000);
  expect(q('.pc__clock').textContent).toBe('14:34');
});

test('collapse toggles the panel, swaps the label and is remembered', () => {
  createPlaceCard(panel, stage, deps).show(null);
  const btn = q('.pc__collapse') as HTMLButtonElement;
  expect(btn.getAttribute('aria-label')).toBe('Свернуть');
  btn.click();
  expect(panel.classList.contains('is-collapsed')).toBe(true);
  expect(btn.getAttribute('aria-label')).toBe('Развернуть карточку');
  expect(deps.storage!.getItem(COLLAPSE_KEY)).toBe('1');
  document.body.innerHTML = '<aside class="shell__place"></aside><main></main>';
  panel = document.querySelector('aside')!;
  createPlaceCard(panel, document.querySelector('main')!, deps);
  expect(panel.classList.contains('is-collapsed')).toBe(true);
});

test('phone sheet mirrors the card and hides when nothing plays', async () => {
  const card = createPlaceCard(panel, stage, deps);
  const sheet = stage.querySelector('.pc-sheet') as HTMLElement;
  card.show(null);
  expect(sheet.hidden).toBe(true);
  card.show({ place: lisbon, station: st(['pt']), info });
  await flush();
  expect(sheet.hidden).toBe(false);
  expect(sheet.querySelector('.pcs__name')!.textContent).toBe('Лиссабон');
  expect(sheet.querySelector('.pcs__meta')!.textContent).toBe('Португалия · португальский');
  expect(sheet.querySelector('.pcs__clock')!.textContent).toBe('14:32');
  expect(sheet.querySelector('.pcs__text')!.textContent).toBe('Лиссабон — столица Португалии.');
  expect(sheet.querySelector('.pcs__link')!.textContent).toContain('Подробнее в Википедии');
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/place-card/place-card.ts`:
```ts
import { countryName, placeTitle } from '../data/place-name';
import type { Place } from '../data/places';
import type { PlaceInfo, StationLite } from '../data/shards';
import type { I18n } from '../i18n/i18n';
import { escapeHtml } from '../ui/html';
import { icons } from '../ui/icons';
import { languageNames } from './language';
import './place-card.css';
import { diffLabel, formatClock, isValidTimeZone, msUntilNextMinute, offsetMinutes } from './time';
import type { WikiResult } from './wiki';

export interface PlaceCardData { place: Place; station: StationLite; info: PlaceInfo | null }
export interface PlaceCardDeps {
  i18n: I18n; storage: Storage | null;
  flagUrl(cc: string): string | null;
  findArticle(info: PlaceInfo): Promise<WikiResult>;
  now(): Date; userOffset(): number;
}
export interface PlaceCard { show(d: PlaceCardData | null): void; destroy(): void }
export const COLLAPSE_KEY = 'placeCardCollapsed';

export function createPlaceCard(panel: HTMLElement, sheetHost: HTMLElement, deps: PlaceCardDeps): PlaceCard {
  const { i18n } = deps;
  const t = (k: string) => escapeHtml(i18n.t(k));
  panel.innerHTML = `
    <div class="place__head">
      <span class="section-label">${t('place.title')}</span>
      <button class="btn--ghost pc__collapse">${icons.chevronRight}</button>
    </div>
    <p class="panel-empty pc__empty">${t('place.empty')}</p>
    <div class="pc__content" hidden>
      <div class="pc__title">
        <img class="pc__flag" width="54" height="36" alt="">
        <div><div class="pc__name"></div><div class="pc__country"></div></div>
      </div>
      <div class="pc__tiles">
        <div class="pc__tile pc__time"><div class="pc__label">${t('place.time')}</div><div class="pc__clock"></div><div class="pc__diff"></div></div>
        <div class="pc__tile"><div class="pc__label">${t('place.lang')}</div><div class="pc__langs"></div>
          <button class="pc__learn" disabled title="${t('common.soon')}">${t('place.learn')}</button></div>
      </div>
      <div class="pc__wiki" hidden>
        <img class="pc__photo" alt="" referrerpolicy="no-referrer">
        <p class="pc__note" hidden>${t('place.wiki.english')}</p>
        <p class="pc__text"></p>
        <a class="pc__link" target="_blank" rel="noopener noreferrer"></a>
      </div>
    </div>`;
  const sheet = document.createElement('div');
  sheet.className = 'pc-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="pcs__handle"></div>
    <div class="pcs__top">
      <img class="pcs__flag" width="36" height="24" alt="">
      <div class="pcs__head"><div class="pcs__name"></div><div class="pcs__meta"></div></div>
      <div class="pcs__clock"></div>
    </div>
    <p class="pcs__text"></p>
    <a class="pcs__link" target="_blank" rel="noopener noreferrer"></a>`;
  sheetHost.append(sheet);

  const q = <T extends HTMLElement>(root: HTMLElement, s: string) => root.querySelector<T>(s)!;
  const el = {
    collapse: q<HTMLButtonElement>(panel, '.pc__collapse'), empty: q(panel, '.pc__empty'), content: q(panel, '.pc__content'),
    flag: q<HTMLImageElement>(panel, '.pc__flag'), name: q(panel, '.pc__name'), country: q(panel, '.pc__country'),
    time: q(panel, '.pc__time'), clock: q(panel, '.pc__clock'), diff: q(panel, '.pc__diff'), langs: q(panel, '.pc__langs'),
    wiki: q(panel, '.pc__wiki'), photo: q<HTMLImageElement>(panel, '.pc__photo'), note: q(panel, '.pc__note'),
    text: q(panel, '.pc__text'), link: q<HTMLAnchorElement>(panel, '.pc__link'),
    sFlag: q<HTMLImageElement>(sheet, '.pcs__flag'), sName: q(sheet, '.pcs__name'), sMeta: q(sheet, '.pcs__meta'),
    sClock: q(sheet, '.pcs__clock'), sText: q(sheet, '.pcs__text'), sLink: q<HTMLAnchorElement>(sheet, '.pcs__link'),
  };

  let collapsed = false;
  try { collapsed = deps.storage?.getItem(COLLAPSE_KEY) === '1'; } catch { collapsed = false; }
  const applyCollapse = () => {
    panel.classList.toggle('is-collapsed', collapsed);
    el.collapse.setAttribute('aria-label', i18n.t(collapsed ? 'place.expand' : 'place.collapse'));
  };
  el.collapse.addEventListener('click', () => {
    collapsed = !collapsed;
    try { deps.storage?.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* unavailable */ }
    applyCollapse();
  });
  applyCollapse();
  el.photo.addEventListener('error', () => { el.photo.hidden = true; });
  el.flag.addEventListener('error', () => { el.flag.hidden = true; el.sFlag.hidden = true; });

  let token = 0;
  let currentPlaceId: string | null = null;
  let tz = '';
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = () => {
    if (!tz) return;
    const now = deps.now();
    el.clock.textContent = formatClock(tz, now, i18n.locale);
    el.sClock.textContent = el.clock.textContent;
    el.diff.textContent = diffLabel(i18n, offsetMinutes(tz, now), deps.userOffset());
  };
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (!tz) return;
    timer = setTimeout(() => { tick(); schedule(); }, msUntilNextMinute(deps.now().getTime()));
  };

  function renderWiki(r: WikiResult) {
    const s = r.summary;
    el.wiki.hidden = !s && !r.link;
    el.photo.hidden = !s?.image;
    if (s?.image) el.photo.src = s.image;
    el.note.hidden = s?.lang !== 'en';
    el.text.hidden = !s;
    el.text.textContent = s?.text ?? '';
    el.sText.textContent = s?.text ?? '';
    el.sText.hidden = !s;
    const label = i18n.t(s ? 'place.wiki.read' : 'place.wiki.more');
    for (const a of [el.link, el.sLink]) {
      a.hidden = !r.link;
      if (r.link) a.href = r.link;
    }
    el.link.textContent = `${label} ↗`;
    el.sLink.textContent = `${i18n.t('place.wiki.more')} ↗`;
  }

  return {
    show(d) {
      if (!d) {
        token++;
        currentPlaceId = null;
        tz = '';
        schedule();
        el.empty.hidden = false;
        el.content.hidden = true;
        sheet.hidden = true;
        return;
      }
      // Language depends on the station: refresh it even when the place is the same (pause/resume, next in the same city).
      const langs = languageNames(d.station.langs, i18n.locale) || i18n.t('place.lang.none');
      el.langs.textContent = langs;
      const country = countryName(d.place.cc, i18n.locale);
      el.sMeta.textContent = `${d.place.kind === 'country' ? i18n.t('place.approx') : country} · ${langs}`;
      if (d.place.id === currentPlaceId) return;
      currentPlaceId = d.place.id;
      const my = ++token;

      el.empty.hidden = true;
      el.content.hidden = false;
      sheet.hidden = false;
      const title = placeTitle(d.place, i18n.locale);
      el.name.textContent = title;
      el.sName.textContent = title;
      el.country.textContent = d.place.kind === 'country' ? i18n.t('place.approx') : country;
      const flag = deps.flagUrl(d.place.cc);
      for (const img of [el.flag, el.sFlag]) { img.hidden = !flag; if (flag) img.src = flag; }

      tz = d.info && isValidTimeZone(d.info.tz) ? d.info.tz : '';
      el.time.hidden = !tz;
      el.sClock.hidden = !tz;
      tick();
      schedule();

      el.wiki.hidden = true;
      el.sText.hidden = true;
      el.sLink.hidden = true;
      if (!d.info || (!d.info.wikiRu && !d.info.wikiEn)) return;
      void deps.findArticle(d.info).then((r) => { if (my === token) renderWiki(r); });
    },
    destroy() {
      token++;
      if (timer !== undefined) clearTimeout(timer);
      sheet.remove();
    },
  };
}
```
`src/place-card/place-card.css`, `tests/place-card.test.ts`
- Modify: `src/ui/shell.css` (удалить правило `.place__head`, если мешает; см. Step 4)

**Interfaces:**
- Consumes: `Place` (План 2), `StationLite`, `PlaceInfo` (Task 2), `WikiResult` (Task 4), time/language/flag (Task 3), `I18n`.
- Produces:
  ```ts
  export interface PlaceCardData { place: Place; station: StationLite; info: PlaceInfo | null }
  export interface PlaceCardDeps {
    i18n: I18n; storage: Storage | null;
    flagUrl(cc: string): string | null;
    findArticle(info: PlaceInfo): Promise<WikiResult>;
    now(): Date; userOffset(): number;
  }
  export interface PlaceCard { show(d: PlaceCardData | null): void; destroy(): void }
  export const COLLAPSE_KEY = 'placeCardCollapsed';
  export function createPlaceCard(panel: HTMLElement, sheetHost: HTMLElement, deps: PlaceCardDeps): PlaceCard
  ```
  `panel` — правая панель (`refs.placeCard`), её содержимое заменяется; `sheetHost` — `refs.stage` (туда добавляется шторка телефона `.pc-sheet`).

- [ ] **Step 1: Тесты**

`tests/place-card.test.ts`:
```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import type { Place } from '../src/data/places';
import type { PlaceInfo, StationLite } from '../src/data/shards';
import { createI18n } from '../src/i18n/i18n';
import { COLLAPSE_KEY, createPlaceCard, type PlaceCardDeps } from '../src/place-card/place-card';
import type { WikiResult } from '../src/place-card/wiki';

const i18n = createI18n('ru', ru);
const lisbon: Place = { id: 'c:1', lat: 38.7, lon: -9.1, kind: 'exact', cc: 'PT', nameRu: 'Лиссабон', name: 'Lisbon', count: 12, pop: 1 };
const country: Place = { ...lisbon, id: 'k:PT', kind: 'country' };
const st = (langs: string[] = ['pt']): StationLite =>
  ({ id: 's', name: 'Fado', url: 'https://x', placeId: 'c:1', cc: 'PT', langs, tags: [], votes: 0, clicks: 0, favicon: '', hls: false });
const info: PlaceInfo = { tz: 'Europe/Lisbon', wikiRu: 'Лиссабон', wikiEn: 'Lisbon' };
const wiki = (text: string, lang: 'ru' | 'en' = 'ru'): WikiResult =>
  ({ summary: { lang, title: 'T', text, image: 'https://upload.wikimedia.org/p.jpg', url: 'https://ru.wikipedia.org/wiki/T' }, link: 'https://ru.wikipedia.org/wiki/T' });

class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } }

let panel: HTMLElement;
let stage: HTMLElement;
let deps: PlaceCardDeps;
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 0, 15, 14, 32, 30)));
  document.body.innerHTML = '<aside class="shell__place"></aside><main></main>';
  panel = document.querySelector('aside')!;
  stage = document.querySelector('main')!;
  deps = {
    i18n,
    storage: new Mem() as unknown as Storage,
    flagUrl: (cc) => (cc === 'PT' ? '/flags/pt.svg' : null),
    findArticle: vi.fn(async () => wiki('Лиссабон — столица Португалии.')),
    now: () => new Date(),
    userOffset: () => 180,
  };
});
afterEach(() => vi.useRealTimers());
const q = (s: string) => panel.querySelector(s) as HTMLElement;

test('empty state before anything plays', () => {
  createPlaceCard(panel, stage, deps).show(null);
  expect(panel.textContent).toContain('Карточка места появится');
  expect(q('.pc__content').hidden).toBe(true);
});

test('city card: flag, title, country, time, difference, language, disabled learn button, wiki', async () => {
  createPlaceCard(panel, stage, deps).show({ place: lisbon, station: st(['pt']), info });
  await flush();
  expect((q('.pc__flag') as HTMLImageElement).src).toContain('/flags/pt.svg');
  expect(q('.pc__name').textContent).toBe('Лиссабон');
  expect(q('.pc__country').textContent).toBe('Португалия');
  expect(q('.pc__clock').textContent).toBe('14:32');
  expect(q('.pc__diff').textContent).toBe('на 3 ч раньше вас');
  expect(q('.pc__langs').textContent).toBe('португальский');
  const learn = q('.pc__learn') as HTMLButtonElement;
  expect(learn.disabled).toBe(true);
  expect(learn.title).toBe('Появится скоро');
  expect(q('.pc__text').textContent).toBe('Лиссабон — столица Португалии.');
  expect((q('.pc__link') as HTMLAnchorElement).href).toBe('https://ru.wikipedia.org/wiki/T');
  expect(q('.pc__link').textContent).toContain('Читать в Википедии');
  expect(q('.pc__note').hidden).toBe(true);
});

test('country card says the location is approximate', () => {
  createPlaceCard(panel, stage, deps).show({ place: country, station: st(), info });
  expect(q('.pc__name').textContent).toBe('Португалия');
  expect(q('.pc__country').textContent).toBe('Примерное расположение станций');
});

test('missing place info: no time tile, no wiki, flag/title/language still shown (review focus 5)', async () => {
  createPlaceCard(panel, stage, deps).show({ place: lisbon, station: st([]), info: null });
  await flush();
  expect(q('.pc__time').hidden).toBe(true);
  expect(q('.pc__wiki').hidden).toBe(true);
  expect(q('.pc__langs').textContent).toBe('Язык не указан');
  expect(deps.findArticle).not.toHaveBeenCalled();
});

test('unknown timezone hides the time tile; unknown flag hides the flag', () => {
  createPlaceCard(panel, stage, deps).show({ place: { ...lisbon, cc: 'QQ' }, station: st(), info: { ...info, tz: 'Mars/Olympus' } });
  expect(q('.pc__time').hidden).toBe(true);
  expect(q('.pc__flag').hidden).toBe(true);
});

test('English article gets a note; link-only result shows "Подробнее"; nothing hides the block', async () => {
  const card = createPlaceCard(panel, stage, deps);
  deps.findArticle = vi.fn(async () => wiki('A town.', 'en'));
  card.show({ place: lisbon, station: st(), info });
  await flush();
  expect(q('.pc__note').hidden).toBe(false);
  expect(q('.pc__note').textContent).toBe('Статья на английском');
  deps.findArticle = vi.fn(async () => ({ summary: null, link: 'https://ru.wikipedia.org/wiki/X' }));
  card.show({ place: { ...lisbon, id: 'c:2' }, station: st(), info });
  await flush();
  expect(q('.pc__text').hidden).toBe(true);
  expect(q('.pc__link').textContent).toContain('Подробнее в Википедии');
  deps.findArticle = vi.fn(async () => ({ summary: null, link: null }));
  card.show({ place: { ...lisbon, id: 'c:3' }, station: st(), info });
  await flush();
  expect(q('.pc__wiki').hidden).toBe(true);
});

test('Wikipedia text with markup is shown as text (review focus 2)', async () => {
  deps.findArticle = vi.fn(async () => wiki('<img src=x onerror=alert(1)> текст'));
  createPlaceCard(panel, stage, deps).show({ place: lisbon, station: st(), info });
  await flush();
  expect(panel.querySelector('.pc__text img')).toBeNull();
  expect(q('.pc__text').textContent).toBe('<img src=x onerror=alert(1)> текст');
});

test('a late answer for a previous place is dropped (review focus 1)', async () => {
  let releaseA!: (r: WikiResult) => void;
  deps.findArticle = vi.fn((i: PlaceInfo) => (i.wikiRu === 'A' ? new Promise<WikiResult>((r) => { releaseA = r; }) : Promise.resolve(wiki('B text'))));
  const card = createPlaceCard(panel, stage, deps);
  card.show({ place: lisbon, station: st(), info: { ...info, wikiRu: 'A' } });
  card.show({ place: { ...lisbon, id: 'c:2', nameRu: 'Порту' }, station: st(), info: { ...info, wikiRu: 'B' } });
  await flush();
  releaseA(wiki('A text'));
  await flush();
  expect(q('.pc__name').textContent).toBe('Порту');
  expect(q('.pc__text').textContent).toBe('B text');
});

test('same place again (pause/resume) does not refetch; new station updates language only', async () => {
  const card = createPlaceCard(panel, stage, deps);
  card.show({ place: lisbon, station: st(['pt']), info });
  await flush();
  card.show({ place: lisbon, station: { ...st(['en']), id: 's2' }, info });
  await flush();
  expect(deps.findArticle).toHaveBeenCalledTimes(1);
  expect(q('.pc__langs').textContent).toBe('английский');
});

test('clock ticks on the minute boundary', async () => {
  createPlaceCard(panel, stage, deps).show({ place: lisbon, station: st(), info });
  expect(q('.pc__clock').textContent).toBe('14:32');
  await vi.advanceTimersByTimeAsync(30_000);
  expect(q('.pc__clock').textContent).toBe('14:33');
  await vi.advanceTimersByTimeAsync(60_000);
  expect(q('.pc__clock').textContent).toBe('14:34');
});

test('collapse toggles the panel, swaps the label and is remembered', () => {
  createPlaceCard(panel, stage, deps).show(null);
  const btn = q('.pc__collapse') as HTMLButtonElement;
  expect(btn.getAttribute('aria-label')).toBe('Свернуть');
  btn.click();
  expect(panel.classList.contains('is-collapsed')).toBe(true);
  expect(btn.getAttribute('aria-label')).toBe('Развернуть карточку');
  expect(deps.storage!.getItem(COLLAPSE_KEY)).toBe('1');
  document.body.innerHTML = '<aside class="shell__place"></aside><main></main>';
  panel = document.querySelector('aside')!;
  createPlaceCard(panel, document.querySelector('main')!, deps);
  expect(panel.classList.contains('is-collapsed')).toBe(true);
});

test('phone sheet mirrors the card and hides when nothing plays', async () => {
  const card = createPlaceCard(panel, stage, deps);
  const sheet = stage.querySelector('.pc-sheet') as HTMLElement;
  card.show(null);
  expect(sheet.hidden).toBe(true);
  card.show({ place: lisbon, station: st(['pt']), info });
  await flush();
  expect(sheet.hidden).toBe(false);
  expect(sheet.querySelector('.pcs__name')!.textContent).toBe('Лиссабон');
  expect(sheet.querySelector('.pcs__meta')!.textContent).toBe('Португалия · португальский');
  expect(sheet.querySelector('.pcs__clock')!.textContent).toBe('14:32');
  expect(sheet.querySelector('.pcs__text')!.textContent).toBe('Лиссабон — столица Португалии.');
  expect(sheet.querySelector('.pcs__link')!.textContent).toContain('Подробнее в Википедии');
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/place-card/place-card.ts`:
```ts
import { countryName, placeTitle } from '../data/place-name';
import type { Place } from '../data/places';
import type { PlaceInfo, StationLite } from '../data/shards';
import type { I18n } from '../i18n/i18n';
import { escapeHtml } from '../ui/html';
import { icons } from '../ui/icons';
import { languageNames } from './language';
import './place-card.css';
import { diffLabel, formatClock, isValidTimeZone, msUntilNextMinute, offsetMinutes } from './time';
import type { WikiResult } from './wiki';

export interface PlaceCardData { place: Place; station: StationLite; info: PlaceInfo | null }
export interface PlaceCardDeps {
  i18n: I18n; storage: Storage | null;
  flagUrl(cc: string): string | null;
  findArticle(info: PlaceInfo): Promise<WikiResult>;
  now(): Date; userOffset(): number;
}
export interface PlaceCard { show(d: PlaceCardData | null): void; destroy(): void }
export const COLLAPSE_KEY = 'placeCardCollapsed';

export function createPlaceCard(panel: HTMLElement, sheetHost: HTMLElement, deps: PlaceCardDeps): PlaceCard {
  const { i18n } = deps;
  const t = (k: string) => escapeHtml(i18n.t(k));
  panel.innerHTML = `
    <div class="place__head">
      <span class="section-label">${t('place.title')}</span>
      <button class="btn--ghost pc__collapse">${icons.chevronRight}</button>
    </div>
    <p class="panel-empty pc__empty">${t('place.empty')}</p>
    <div class="pc__content" hidden>
      <div class="pc__title">
        <img class="pc__flag" width="54" height="36" alt="">
        <div><div class="pc__name"></div><div class="pc__country"></div></div>
      </div>
      <div class="pc__tiles">
        <div class="pc__tile pc__time"><div class="pc__label">${t('place.time')}</div><div class="pc__clock"></div><div class="pc__diff"></div></div>
        <div class="pc__tile"><div class="pc__label">${t('place.lang')}</div><div class="pc__langs"></div>
          <button class="pc__learn" disabled title="${t('common.soon')}">${t('place.learn')}</button></div>
      </div>
      <div class="pc__wiki" hidden>
        <img class="pc__photo" alt="" referrerpolicy="no-referrer">
        <p class="pc__note" hidden>${t('place.wiki.english')}</p>
        <p class="pc__text"></p>
        <a class="pc__link" target="_blank" rel="noopener noreferrer"></a>
      </div>
    </div>`;
  const sheet = document.createElement('div');
  sheet.className = 'pc-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="pcs__handle"></div>
    <div class="pcs__top">
      <img class="pcs__flag" width="36" height="24" alt="">
      <div class="pcs__head"><div class="pcs__name"></div><div class="pcs__meta"></div></div>
      <div class="pcs__clock"></div>
    </div>
    <p class="pcs__text"></p>
    <a class="pcs__link" target="_blank" rel="noopener noreferrer"></a>`;
  sheetHost.append(sheet);

  const q = <T extends HTMLElement>(root: HTMLElement, s: string) => root.querySelector<T>(s)!;
  const el = {
    collapse: q<HTMLButtonElement>(panel, '.pc__collapse'), empty: q(panel, '.pc__empty'), content: q(panel, '.pc__content'),
    flag: q<HTMLImageElement>(panel, '.pc__flag'), name: q(panel, '.pc__name'), country: q(panel, '.pc__country'),
    time: q(panel, '.pc__time'), clock: q(panel, '.pc__clock'), diff: q(panel, '.pc__diff'), langs: q(panel, '.pc__langs'),
    wiki: q(panel, '.pc__wiki'), photo: q<HTMLImageElement>(panel, '.pc__photo'), note: q(panel, '.pc__note'),
    text: q(panel, '.pc__text'), link: q<HTMLAnchorElement>(panel, '.pc__link'),
    sFlag: q<HTMLImageElement>(sheet, '.pcs__flag'), sName: q(sheet, '.pcs__name'), sMeta: q(sheet, '.pcs__meta'),
    sClock: q(sheet, '.pcs__clock'), sText: q(sheet, '.pcs__text'), sLink: q<HTMLAnchorElement>(sheet, '.pcs__link'),
  };

  let collapsed = false;
  try { collapsed = deps.storage?.getItem(COLLAPSE_KEY) === '1'; } catch { collapsed = false; }
  const applyCollapse = () => {
    panel.classList.toggle('is-collapsed', collapsed);
    el.collapse.setAttribute('aria-label', i18n.t(collapsed ? 'place.expand' : 'place.collapse'));
  };
  el.collapse.addEventListener('click', () => {
    collapsed = !collapsed;
    try { deps.storage?.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* unavailable */ }
    applyCollapse();
  });
  applyCollapse();
  el.photo.addEventListener('error', () => { el.photo.hidden = true; });
  el.flag.addEventListener('error', () => { el.flag.hidden = true; el.sFlag.hidden = true; });

  let token = 0;
  let currentPlaceId: string | null = null;
  let tz = '';
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = () => {
    if (!tz) return;
    const now = deps.now();
    el.clock.textContent = formatClock(tz, now, i18n.locale);
    el.sClock.textContent = el.clock.textContent;
    el.diff.textContent = diffLabel(i18n, offsetMinutes(tz, now), deps.userOffset());
  };
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (!tz) return;
    timer = setTimeout(() => { tick(); schedule(); }, msUntilNextMinute(deps.now().getTime()));
  };

  function renderWiki(r: WikiResult) {
    const s = r.summary;
    el.wiki.hidden = !s && !r.link;
    el.photo.hidden = !s?.image;
    if (s?.image) el.photo.src = s.image;
    el.note.hidden = s?.lang !== 'en';
    el.text.hidden = !s;
    el.text.textContent = s?.text ?? '';
    el.sText.textContent = s?.text ?? '';
    el.sText.hidden = !s;
    const label = i18n.t(s ? 'place.wiki.read' : 'place.wiki.more');
    for (const a of [el.link, el.sLink]) {
      a.hidden = !r.link;
      if (r.link) a.href = r.link;
    }
    el.link.textContent = `${label} ↗`;
    el.sLink.textContent = `${i18n.t('place.wiki.more')} ↗`;
  }

  return {
    show(d) {
      if (!d) {
        token++;
        currentPlaceId = null;
        tz = '';
        schedule();
        el.empty.hidden = false;
        el.content.hidden = true;
        sheet.hidden = true;
        return;
      }
      // Language depends on the station: refresh it even when the place is the same (pause/resume, next in the same city).
      const langs = languageNames(d.station.langs, i18n.locale) || i18n.t('place.lang.none');
      el.langs.textContent = langs;
      const country = countryName(d.place.cc, i18n.locale);
      el.sMeta.textContent = `${d.place.kind === 'country' ? i18n.t('place.approx') : country} · ${langs}`;
      if (d.place.id === currentPlaceId) return;
      currentPlaceId = d.place.id;
      const my = ++token;

      el.empty.hidden = true;
      el.content.hidden = false;
      sheet.hidden = false;
      const title = placeTitle(d.place, i18n.locale);
      el.name.textContent = title;
      el.sName.textContent = title;
      el.country.textContent = d.place.kind === 'country' ? i18n.t('place.approx') : country;
      const flag = deps.flagUrl(d.place.cc);
      for (const img of [el.flag, el.sFlag]) { img.hidden = !flag; if (flag) img.src = flag; }

      tz = d.info && isValidTimeZone(d.info.tz) ? d.info.tz : '';
      el.time.hidden = !tz;
      el.sClock.hidden = !tz;
      tick();
      schedule();

      el.wiki.hidden = true;
      el.sText.hidden = true;
      el.sLink.hidden = true;
      if (!d.info || (!d.info.wikiRu && !d.info.wikiEn)) return;
      void deps.findArticle(d.info).then((r) => { if (my === token) renderWiki(r); });
    },
    destroy() {
      token++;
      if (timer !== undefined) clearTimeout(timer);
      sheet.remove();
    },
  };
}
```
Примечание: `show` для того же места увеличивает `token`, но запрос Википедии не повторяет — поэтому сохранять результат нужно не по `token`, а по месту. Чтобы ответ не терялся при паузе/продолжении, в начале `show` вычислять `my` только при смене места: перенести `const my = ++token;` после проверки `d.place.id === currentPlaceId` (а в ветке `!d` — отдельный `token++`).

Итоговый порядок в `show`:
```ts
    show(d) {
      if (!d) { token++; currentPlaceId = null; /* … как выше … */ return; }
      // язык и строка шторки — всегда
      if (d.place.id === currentPlaceId) return;
      const my = ++token;
      // … остальное как выше
    },
```

`src/place-card/place-card.css` (по `03_design.md` §6.1, §6.3):
```css
.shell__place { transition: inline-size .2s ease-out; }
.shell__place.is-collapsed { inline-size: 56px; padding-inline: 10px; }
.shell__place.is-collapsed .section-label, .shell__place.is-collapsed .pc__content, .shell__place.is-collapsed .pc__empty { display: none; }
.shell__place.is-collapsed .pc__collapse svg { transform: scaleX(-1); }
.pc__content { display: flex; flex-direction: column; gap: 16px; min-block-size: 0; overflow-y: auto; }
.pc__title { display: flex; align-items: center; gap: 14px; }
.pc__flag { inline-size: 54px; block-size: 36px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
.pc__name { font-family: var(--font-display); font-size: 24px; font-weight: 500; }
.pc__country { font-size: 14px; color: var(--text-muted); margin-block-start: 2px; }
.pc__tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pc__tile { padding: 14px; border-radius: var(--r-card); background: var(--surface-card); border: 1px solid var(--border-card); display: flex; flex-direction: column; gap: 6px; min-inline-size: 0; }
.pc__label { font-size: 13px; color: var(--text-muted); }
.pc__clock { font-family: var(--font-display); font-size: 28px; font-weight: 500; }
.pc__diff { font-size: 13px; color: var(--text-muted); }
.pc__langs { font-size: 15px; font-weight: 600; }
.pc__learn { align-self: flex-start; padding: 0; border: 0; background: none; color: var(--teal-link); font-size: 13px; }
.pc__wiki { display: flex; flex-direction: column; gap: 10px; }
.pc__photo { inline-size: 100%; block-size: 150px; object-fit: cover; border-radius: var(--r-card); background: var(--surface-card); }
.pc__note { margin: 0; font-size: 12px; color: var(--text-faint); }
.pc__text { margin: 0; font-size: 15px; line-height: 1.5; }
.pc__link, .pcs__link { color: var(--link); font-size: 14px; }
.pc__link:hover, .pcs__link:hover { color: var(--link-hover); }
.pc-sheet { display: none; }

@media (max-width: 760px) {
  .pc-sheet:not([hidden]) { display: block; position: fixed; z-index: 9; inset-inline: 0; inset-block-end: 68px; padding: 8px 16px 14px; border-radius: 22px 22px 0 0; background: var(--surface-raised); border: 1px solid var(--border-card); }
  .shell__left.is-open ~ .shell__stage .pc-sheet { display: none; }
  .pcs__handle { inline-size: 36px; block-size: 4px; border-radius: 2px; background: var(--border-popover); margin: 0 auto 10px; }
  .pcs__top { display: flex; align-items: center; gap: 10px; }
  .pcs__flag { inline-size: 36px; block-size: 24px; border-radius: 3px; object-fit: cover; }
  .pcs__head { flex: 1; min-inline-size: 0; }
  .pcs__name { font-family: var(--font-display); font-size: 18px; font-weight: 500; }
  .pcs__meta { font-size: 13px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pcs__clock { font-family: var(--font-display); font-size: 20px; font-weight: 500; }
  .pcs__text { margin: 8px 0 4px; font-size: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
}
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS (в т. ч. `no-hardcoded-strings` — стрелка `↗` задана как `↗`). Старое содержимое `.shell__place` из оболочки (заголовок и кнопка) заменяется карточкой; тест оболочки `renders all regions…` проверяет «Карточка места» до создания карточки — остаётся зелёным.

- [ ] **Step 5: Commit** `feat(place-card): place card UI (desktop panel, phone sheet, collapse)`

---

### Task 6: Подключение к приложению и приёмка

**Files:**
- Modify: `src/app/app.ts`, `src/app/main.ts`, `tests/app.test.ts`, `README.md`

**Interfaces:**
- Consumes: `PlaceCard`, `PlaceCardData` (Task 5), `ShardStore.info` (Task 2).
- Produces: `AppDeps.card: { show(d: PlaceCardData | null): void }`.

- [ ] **Step 1: Тесты** — в `tests/app.test.ts`:
  - в `beforeEach`: `shards = { get: vi.fn(async () => pt), info: vi.fn(async () => new Map([['c:1', { tz: 'Europe/Lisbon', wikiRu: 'Лиссабон', wikiEn: 'Lisbon' }]])) };` (тип `ShardStore & { get: …; info: … }`), `deps.card = { show: vi.fn() }`.
  - дописать:
```ts
test('the place card follows the playing station, not the browsed list', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.card.show).toHaveBeenLastCalledWith({ place: lisbon, station: expect.objectContaining({ id: 'a' }), info: { tz: 'Europe/Lisbon', wikiRu: 'Лиссабон', wikiEn: 'Lisbon' } });
  const calls = (deps.card.show as ReturnType<typeof vi.fn>).mock.calls.length;
  await app.selectPlace(porto);
  await flush();
  expect((deps.card.show as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
});

test('card shows nothing while idle and gets null info when the country file has none (review focus 5)', async () => {
  shards.info.mockResolvedValue(new Map());
  const app = await startApp(deps);
  expect(deps.card.show).toHaveBeenLastCalledWith(null);
  await app.selectPlace(porto);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.card.show).toHaveBeenLastCalledWith(expect.objectContaining({ place: porto, info: null }));
});

test('a slow place-info answer for a previous station never overwrites the current card (review focus 1)', async () => {
  let releaseFirst!: (m: Map<string, PlaceInfo>) => void;
  shards.info.mockImplementationOnce(() => new Promise((r) => { releaseFirst = r; }));
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  await app.selectPlace(porto);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  releaseFirst(new Map());
  await flush();
  expect(deps.card.show).toHaveBeenLastCalledWith(expect.objectContaining({ place: porto }));
});
```
(импорт `PlaceInfo` из `../src/data/shards`.)

- [ ] **Step 2: Run** `npx vitest run tests/app.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`src/app/app.ts`:
- `AppDeps` + `card: { show(d: PlaceCardData | null): void };` (импорт `type PlaceCardData` из `../place-card/place-card`, `type PlaceInfo` из `../data/shards`).
- перед `player.subscribe`:
```ts
  let cardKey = '';
  let cardToken = 0;
  async function updateCard(station: StationLite | null) {
    const place = playingPlace;
    const key = station && place ? `${station.id}|${place.id}` : '';
    if (key === cardKey) return;
    cardKey = key;
    const my = ++cardToken;
    if (!station || !place) { d.card.show(null); return; }
    let info: PlaceInfo | null = null;
    try { info = (await d.shards.info(place.cc)).get(place.id) ?? null; } catch { info = null; }
    if (my === cardToken) d.card.show({ place, station, info });
  }
```
- в `player.subscribe` в конец обработчика: `void updateCard(station);`
- перед `renderBar();` в конце инициализации: `d.card.show(null);`

`src/app/main.ts`:
```ts
import { createPlaceCard } from '../place-card/place-card';
import { flagUrl } from '../place-card/flag';
import { findArticle } from '../place-card/wiki';
import { createWikiCache } from '../place-card/wiki-cache';
```
после `renderStarfield(refs.stars);`:
```ts
const wikiCache = createWikiCache(storage);
const card = createPlaceCard(refs.placeCard, refs.stage, {
  i18n,
  storage,
  flagUrl,
  findArticle: (info) => findArticle(info, fetch, wikiCache),
  now: () => new Date(),
  userOffset: () => -new Date().getTimezoneOffset(),
});
```
и `card,` в объект `startApp({...})`.

`README.md` — раздел «Карточка места»: данные (пояс и статьи из GeoNames в файлах стран), Википедия (ru → межъязыковая ссылка → en; кеш 30 дней в браузере), флаги flag-icons (MIT).

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit && npm run build` → PASS; размер `index-*.js` (gzip) вырос не больше чем на ~10 КБ.

- [ ] **Step 5: Commit** `feat(app): show the place card for the playing station`

- [ ] **Step 6: Приёмка в браузере** (`npm run snapshot`, `npm run dev`; записать в журнал):
1. 10 разных станций (≥ 3 города, ≥ 2 региона, ≥ 2 «страны», в т. ч. Индия/Непал для дробного пояса и США для страны без единого пояса): местное время совпадает с реальным (сверить с `Intl` в консоли или timeanddate), подпись разницы верна, есть ссылка «Читать в Википедии» (у стран с одним поясом — время; у США-страны — без времени).
2. ПК 1440×900 бок о бок с `design/mockups/Main.dc.html`: флаг, заголовок, плитки, фото, текст, ссылка; свернуть/развернуть.
3. Телефон 390×844: шторка карточки над мини-плеером, скрывается при открытом списке.
4. Быстро переключить 3 станции подряд — карточка соответствует последней.
