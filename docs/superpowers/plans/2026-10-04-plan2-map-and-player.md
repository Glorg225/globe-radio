# План 2: глобус, плоская карта и плеер — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Глобус 3D и плоская карта с точками мест, список станций места и живой плеер по утверждённому макету (этап 3 ТЗ).

**Architecture:** Снимок станций делится на лёгкий `places.json` (места) и файлы станций по странам; места строятся в скрипте снимка через справочник GeoNames (`data/gazetteer.json`, собирается отдельным скриптом). Клиент: интерфейс `MapView` с двумя реализациями (globe.gl и холст d3), общая группировка (supercluster), плеер — машина состояний над `<audio>`/hls.js, контроллер `app.ts` связывает всё через подставляемые зависимости (тестируется с подделками).

**Tech Stack:** Vite + TypeScript (vanilla), Vitest + jsdom, globe.gl, supercluster, d3-geo / d3-zoom / d3-selection, topojson-client + world-atlas, hls.js. Данные: Radio Browser, GeoNames (CC BY 4.0), текстура NASA Black Marble (общественное достояние) из примеров three-globe.

**Spec:** `docs/superpowers/specs/2026-10-04-plan2-map-and-player-design.md` (+ `docs/02_tz.md` §4.1, §4.2, §5; `docs/03_design.md`; `design/mockups/Main.dc.html`).

## Global Constraints

- $0 на инфраструктуру; без своего сервера; без внешних тайлов карты.
- Ни одной строки интерфейса в `src/` — только `locales/ru.json` (тест `no-hardcoded-strings` уже стоит).
- Данные станций в разметку — только через `escapeHtml` (`src/ui/html.ts`) или `textContent`.
- Цвета — только токены `src/ui/tokens.css`; новые токены добавляются туда.
- Логические CSS-свойства (`inset-inline-*`, `margin-inline-*`), `prefers-reduced-motion` отключает анимации.
- Точка станции: 3–7 px, янтарная, прозрачность 45–100 % по популярности, свечение `0 0 8px`; играющая — 14 px + кольцо 2 px, `scale 1 → 3.2`, `opacity 0.9 → 0`, 1,8 с, `ease-out`.
- Плоская карта: фон `#0F1630`, рамка `#26305A`, радиус 16, сетка `#25305C`, экватор и нулевой меридиан `#33407A`.
- Таймаут старта/обрыва потока — **8 с**; чёрный список — **12 ч**.
- Только HTTPS-потоки; свежий URL — `GET /json/url/{stationuuid}` перед воспроизведением.
- Нет WebGL или средний FPS < 30 за первые 3 с → плоская карта + уведомление.
- До появления глобуса ≲ 1 МБ (gzip) своих данных и кода, без ленивой 3D-библиотеки и текстуры; цель `places.json` ≤ 300 КБ gzip.
- Атрибуция внизу: Radio Browser, Википедия, GeoNames (CC BY 4.0), дисклеймер.

## Review Focus

1. **Быстрый клик по станции A, потом сразу по B** → играет только B, ошибка/таймаут A не трогает B (тест в Task 6).
2. **Файл станций страны не загрузился один раз** → «Повторить» загружает заново, а не отдаёт закешированную ошибку (тест в Task 4).
3. **Radio Browser недоступен или вернул не-HTTPS URL** → берётся HTTPS-адрес из снимка; если и его нет — ошибка «Станция не отвечает» (тест в Task 6).
4. **Хранилище браузера недоступно** → чёрный список, громкость и режим карты работают без сохранения и без исключений (тесты в Task 5 и Task 11).
5. **Регион с диакритикой, регистром и служебными словами** («Région Île-de-France», «BAYERN», «Московская область») → находится нужный регион (тест в Task 2).

---

## File Structure

```
scripts/build-gazetteer.ts        — ручная сборка справочника из GeoNames (Task 1)
scripts/build-snapshot.ts         — чистая функция: сырые станции → места + станции по странам + отчёт (Task 3)
scripts/snapshot.ts               — запуск снимка (переделка, Task 3)
scripts/fetch-deployed-snapshot.ts — запасной вариант CI: скачать опубликованный снимок (Task 12)
data/gazetteer.json               — справочник (генерируется Task 1, коммитится)
src/data/mirrors.ts               — список зеркал Radio Browser (общий)
src/data/gazetteer.ts             — типы, кодирование, normalizeName
src/data/geo.ts                   — haversineKm
src/data/place-match.ts           — станция → место
src/data/places.ts                — Place, кодирование, loadPlaces
src/data/shards.ts                — StationLite, кодирование, createShardStore
src/data/place-name.ts            — заголовки мест и стран на языке интерфейса
src/player/blacklist.ts, next-nearby.ts, stream-url.ts, player.ts, hls-loader.ts, media-session.ts
src/map/zoom.ts, dot-style.ts, cluster.ts, choose-mode.ts, map-view.ts, pulse.ts, starfield.ts, hit-test.ts, globe3d.ts, map2d.ts, map.css
src/ui/station-list.ts, player-bar.ts, toast.ts, shell.ts (переделка), shell.css (дополнение), tokens.css (дополнение)
src/app/app.ts                    — контроллер; src/app/main.ts — сборка реальных зависимостей
public/textures/earth-night.jpg
```
Удаляются: `src/data/load.ts`, `tests/load.test.ts`, функции `encode`/`decode` v1 в `src/data/stations.ts` и их тест.

---

### Task 1: Справочник GeoNames

**Files:**
- Create: `src/data/gazetteer.ts`, `src/data/mirrors.ts`, `scripts/build-gazetteer.ts`, `tests/gazetteer.test.ts`, `data/gazetteer.json` (генерируется)
- Modify: `scripts/radio-browser.ts` (FALLBACK → `MIRRORS`), `package.json` (скрипт `gazetteer`), `.gitignore` (`.cache/`)

**Interfaces:**
- Produces (`src/data/gazetteer.ts`):
  ```ts
  export interface GzCity { id: number; nameRu: string; name: string; lat: number; lon: number; cc: string; admin1: string; pop: number; aliases: string[] }
  export interface GzAdmin1 { cc: string; code: string; nameRu: string; name: string; aliases: string[] }
  export interface Gazetteer { cities: GzCity[]; admin1: GzAdmin1[] }
  export function normalizeName(s: string): string
  export function encodeGazetteer(g: Gazetteer): GazetteerFile
  export function decodeGazetteer(f: GazetteerFile): Gazetteer
  ```
- Produces (`scripts/build-gazetteer.ts`, экспортируемые чистые функции): `parseCities(text: string): GzCity[]`, `parseAdmin1(text: string): GzAdmin1[]`, `applyAltName(row: string[], cityIds: Map<number, GzCity>, admin1ById: Map<number, GzAdmin1>): void`.
- Produces (`src/data/mirrors.ts`): `MIRRORS: readonly string[]`.

- [ ] **Step 1: Тесты**

`tests/gazetteer.test.ts`:
```ts
import { expect, test } from 'vitest';
import { decodeGazetteer, encodeGazetteer, normalizeName } from '../src/data/gazetteer';
import { applyAltName, parseAdmin1, parseCities } from '../scripts/build-gazetteer';

test('normalizeName strips case, diacritics, punctuation and generic words', () => {
  expect(normalizeName('Région Île-de-France')).toBe('ile de france');
  expect(normalizeName('  BAYERN ')).toBe('bayern');
  expect(normalizeName('Московская область')).toBe('московская');
  expect(normalizeName('State of São Paulo')).toBe('sao paulo');
  expect(normalizeName('')).toBe('');
});

const cityLine = (id: number, name: string, alt: string, lat: number, lon: number, cc: string, a1: string, pop: number) =>
  [id, name, name, alt, lat, lon, 'P', 'PPLA', cc, '', a1, '', '', '', pop, '', '', 'Europe/Berlin', '2024-01-01'].join('\t');

test('parseCities reads TSV and keeps aliases only for big cities', () => {
  const text = [cityLine(2867714, 'Munich', 'Muenchen,München,Мюнхен', 48.137, 11.575, 'DE', '02', 1260391),
    cityLine(1, 'Smallville', 'Small Ville', 50, 10, 'DE', '02', 20000)].join('\n');
  const [big, small] = parseCities(text);
  expect(big).toMatchObject({ id: 2867714, name: 'Munich', lat: 48.137, lon: 11.575, cc: 'DE', admin1: '02', pop: 1260391, nameRu: '' });
  expect(big.aliases).toEqual(expect.arrayContaining(['munich', 'muenchen', 'munchen', 'мюнхен']));
  expect(small.aliases).toEqual(['smallville']);
});

test('parseAdmin1 reads code, name and geoname id', () => {
  const [a] = parseAdmin1('DE.02\tBavaria\tBavaria\t2951839');
  expect(a).toMatchObject({ cc: 'DE', code: '02', name: 'Bavaria', nameRu: '' });
  expect(a.aliases).toEqual(['bavaria']);
});

test('applyAltName adds russian names and admin1 aliases in all languages', () => {
  const [city] = parseCities(cityLine(2867714, 'Munich', '', 48.1, 11.5, 'DE', '02', 1260391));
  const [a] = parseAdmin1('DE.02\tBavaria\tBavaria\t2951839');
  const cities = new Map([[city.id, city]]);
  const admins = new Map([[2951839, a]]);
  applyAltName(['1', '2867714', 'ru', 'Мюнхен', '1', '', '', ''], cities, admins);
  applyAltName(['2', '2951839', 'ru', 'Бавария', '1', '', '', ''], cities, admins);
  applyAltName(['3', '2951839', 'de', 'Bayern', '', '', '', ''], cities, admins);
  applyAltName(['4', '2951839', 'link', 'https://en.wikipedia.org/wiki/Bavaria', '', '', '', ''], cities, admins);
  expect(city.nameRu).toBe('Мюнхен');
  expect(a.nameRu).toBe('Бавария');
  expect(a.aliases).toEqual(expect.arrayContaining(['bavaria', 'бавария', 'bayern']));
  expect(a.aliases.some((x) => x.includes('wikipedia'))).toBe(false);
});

test('preferred russian name wins over a non-preferred one', () => {
  const [city] = parseCities(cityLine(5, 'X', '', 1, 1, 'RU', '48', 200000));
  const cities = new Map([[5, city]]);
  applyAltName(['1', '5', 'ru', 'Неправильно', '', '', '', ''], cities, new Map());
  applyAltName(['2', '5', 'ru', 'Правильно', '1', '', '', ''], cities, new Map());
  applyAltName(['3', '5', 'ru', 'Ещё одно', '', '', '', ''], cities, new Map());
  expect(city.nameRu).toBe('Правильно');
});

test('encode/decode roundtrip', () => {
  const g = {
    cities: [{ id: 1, nameRu: 'Мюнхен', name: 'Munich', lat: 48.1, lon: 11.5, cc: 'DE', admin1: '02', pop: 5, aliases: ['munich'] }],
    admin1: [{ cc: 'DE', code: '02', nameRu: 'Бавария', name: 'Bavaria', aliases: ['bavaria', 'bayern'] }],
  };
  expect(decodeGazetteer(encodeGazetteer(g))).toEqual(g);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/gazetteer.test.ts` → FAIL (модули не найдены).

- [ ] **Step 3: Реализация**

`src/data/mirrors.ts`:
```ts
// Radio Browser mirrors; discovery sometimes lists a single flaky host, so these are always tried too.
export const MIRRORS: readonly string[] = [
  'de1.api.radio-browser.info',
  'de2.api.radio-browser.info',
  'nl1.api.radio-browser.info',
  'at1.api.radio-browser.info',
];
```

В `scripts/radio-browser.ts` заменить строку с `const FALLBACK = [...]` на:
```ts
import { MIRRORS as FALLBACK } from '../src/data/mirrors';
```
(импорт — в начало файла, комментарий над старой константой удалить).

`src/data/gazetteer.ts`:
```ts
export interface GzCity { id: number; nameRu: string; name: string; lat: number; lon: number; cc: string; admin1: string; pop: number; aliases: string[] }
export interface GzAdmin1 { cc: string; code: string; nameRu: string; name: string; aliases: string[] }
export interface Gazetteer { cities: GzCity[]; admin1: GzAdmin1[] }

type CityRow = [id: number, nameRu: string, name: string, lat: number, lon: number, cc: string, admin1: string, pop: number, aliases: string];
type Admin1Row = [cc: string, code: string, nameRu: string, name: string, aliases: string];
export interface GazetteerFile { v: 1; cities: CityRow[]; admin1: Admin1Row[] }

// Generic words that region fields add around the real name, in the languages seen in Radio Browser data.
const GENERIC = new Set([
  'region', 'regiao', 'regione', 'state', 'estado', 'province', 'provincia', 'oblast', 'republic', 'county',
  'prefecture', 'governorate', 'district', 'department', 'departement', 'municipality', 'city', 'of', 'the',
  'область', 'край', 'республика', 'регион', 'город', 'провинция', 'штат', 'округ',
]);

export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((w) => w && !GENERIC.has(w))
    .join(' ');
}

export function encodeGazetteer(g: Gazetteer): GazetteerFile {
  return {
    v: 1,
    cities: g.cities.map((c) => [c.id, c.nameRu, c.name, c.lat, c.lon, c.cc, c.admin1, c.pop, c.aliases.join('|')]),
    admin1: g.admin1.map((a) => [a.cc, a.code, a.nameRu, a.name, a.aliases.join('|')]),
  };
}

const split = (s: string) => (s ? s.split('|') : []);

export function decodeGazetteer(f: GazetteerFile): Gazetteer {
  return {
    cities: f.cities.map(([id, nameRu, name, lat, lon, cc, admin1, pop, aliases]) => ({ id, nameRu, name, lat, lon, cc, admin1, pop, aliases: split(aliases) })),
    admin1: f.admin1.map(([cc, code, nameRu, name, aliases]) => ({ cc, code, nameRu, name, aliases: split(aliases) })),
  };
}
```

`scripts/build-gazetteer.ts`:
```ts
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { encodeGazetteer, normalizeName, type GzAdmin1, type GzCity } from '../src/data/gazetteer';

const ALIAS_MIN_POP = 100_000;
const SKIP_LANGS = new Set(['link', 'post', 'iata', 'icao', 'faac', 'wkdt', 'unlc', 'tcid', 'fr_1793', 'phon', 'piny']);
const preferredRu = new Set<number>();

function addAlias(list: string[], raw: string) {
  const n = normalizeName(raw);
  if (n && !list.includes(n)) list.push(n);
}

export function parseCities(text: string): GzCity[] {
  const out: GzCity[] = [];
  for (const line of text.split('\n')) {
    const f = line.split('\t');
    if (f.length < 15) continue;
    const pop = Number(f[14]) || 0;
    const city: GzCity = {
      id: Number(f[0]), nameRu: '', name: f[1], lat: Number(f[4]), lon: Number(f[5]),
      cc: f[8], admin1: f[10], pop, aliases: [],
    };
    addAlias(city.aliases, f[1]);
    addAlias(city.aliases, f[2]);
    if (pop >= ALIAS_MIN_POP) for (const a of f[3].split(',')) addAlias(city.aliases, a);
    out.push(city);
  }
  return out;
}

// Returned objects carry their GeoNames id in a side map built by the caller (see main).
export function parseAdmin1(text: string): (GzAdmin1 & { geonameId: number })[] {
  const out: (GzAdmin1 & { geonameId: number })[] = [];
  for (const line of text.split('\n')) {
    const f = line.split('\t');
    if (f.length < 4) continue;
    const [cc, code] = f[0].split('.');
    const a = { cc, code, nameRu: '', name: f[1], aliases: [] as string[], geonameId: Number(f[3]) };
    addAlias(a.aliases, f[1]);
    addAlias(a.aliases, f[2]);
    out.push(a);
  }
  return out;
}

// Row of alternateNamesV2.txt: id, geonameid, isolanguage, name, isPreferred, isShort, isColloquial, isHistoric, ...
export function applyAltName(row: string[], cities: Map<number, GzCity>, admins: Map<number, GzAdmin1>): void {
  const id = Number(row[1]);
  const lang = row[2];
  const name = row[3];
  const preferred = row[4] === '1';
  const target = cities.get(id) ?? admins.get(id);
  if (!target || !name || SKIP_LANGS.has(lang)) return;
  if (lang === 'ru' && (!target.nameRu || (preferred && !preferredRu.has(id)))) {
    target.nameRu = name;
    if (preferred) preferredRu.add(id);
  }
  if (admins.has(id) || lang === 'ru') addAlias(target.aliases, name);
}

const BASE = 'https://download.geonames.org/export/dump/';
const CACHE = '.cache/geonames';

async function download(file: string) {
  const path = `${CACHE}/${file}`;
  if (existsSync(path)) return path;
  console.log(`downloading ${file}…`);
  const r = await fetch(BASE + file);
  if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
  return path;
}

function unzip(path: string) {
  // bsdtar (Windows 10+, macOS) extracts zip archives; on Linux install bsdtar or unzip manually.
  execFileSync('tar', ['-xf', path, '-C', CACHE]);
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  unzip(await download('cities15000.zip'));
  await download('admin1CodesASCII.txt');
  unzip(await download('alternateNamesV2.zip'));

  const cities = parseCities(readFileSync(`${CACHE}/cities15000.txt`, 'utf8'));
  const adminRows = parseAdmin1(readFileSync(`${CACHE}/admin1CodesASCII.txt`, 'utf8'));
  const cityMap = new Map(cities.map((c) => [c.id, c]));
  const adminMap = new Map<number, GzAdmin1>(adminRows.map(({ geonameId, ...a }) => [geonameId, a]));

  const lines = createInterface({ input: createReadStream(`${CACHE}/alternateNamesV2.txt`, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) applyAltName(line.split('\t'), cityMap, adminMap);

  const file = encodeGazetteer({ cities, admin1: [...adminMap.values()] });
  mkdirSync('data', { recursive: true });
  writeFileSync('data/gazetteer.json', JSON.stringify(file));
  console.log(`cities: ${cities.length}, admin1: ${adminMap.size}, size: ${(JSON.stringify(file).length / 1e6).toFixed(1)} MB`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
```

`package.json` → scripts: `"gazetteer": "tsx scripts/build-gazetteer.ts"`. `.gitignore` → добавить строку `.cache/`.

- [ ] **Step 4: Run** `npx vitest run` → все PASS (в т. ч. старые тесты зеркал).

- [ ] **Step 5: Собрать справочник на реальных данных**

Run: `npm run gazetteer` (скачает ~200 МБ один раз в `.cache/`).
Expected: `cities: ~33000, admin1: ~3900, size: < 10 MB`; файл `data/gazetteer.json` создан. Проверить выборочно: `node -e "const g=require('./data/gazetteer.json');console.log(g.admin1.find(a=>a[0]==='DE'&&a[1]==='02'))"` → содержит `Бавария` и `bayern`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(data): GeoNames gazetteer builder and committed gazetteer"
```

---

### Task 2: Станция → место

**Files:**
- Create: `src/data/geo.ts`, `src/data/place-match.ts`, `tests/place-match.test.ts`

**Interfaces:**
- Consumes: `Gazetteer`, `normalizeName` (Task 1); `Station`, `Centroids` (План 1, `src/data/types.ts`).
- Produces:
  - `haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number` (`src/data/geo.ts`)
  - `type PlaceKind = 'exact' | 'region' | 'country'` и `interface PlaceRef { id: string; lat: number; lon: number; kind: PlaceKind; cc: string; nameRu: string; name: string }` — добавить в `src/data/types.ts`.
  - `createPlaceMatcher(gz: Gazetteer, centroids: Centroids, countryName: (cc: string, locale: 'ru' | 'en') => string): { match(s: Station): PlaceRef | null }`
  - Id мест: `c:<geonameid>` (город), `a:<CC>.<admin1>` (регион), `k:<CC>` (страна), `p:<lat2>,<lon2>` (точные координаты вдали от городов).

- [ ] **Step 1: Тесты**

`tests/place-match.test.ts`:
```ts
import { expect, test } from 'vitest';
import { haversineKm } from '../src/data/geo';
import { createPlaceMatcher } from '../src/data/place-match';
import type { Gazetteer } from '../src/data/gazetteer';
import type { Station } from '../src/data/types';

const gz: Gazetteer = {
  cities: [
    { id: 1, nameRu: 'Мюнхен', name: 'Munich', lat: 48.137, lon: 11.575, cc: 'DE', admin1: '02', pop: 1_260_000, aliases: ['munich', 'munchen', 'мюнхен'] },
    { id: 2, nameRu: 'Нюрнберг', name: 'Nuremberg', lat: 49.45, lon: 11.08, cc: 'DE', admin1: '02', pop: 500_000, aliases: ['nuremberg'] },
    { id: 3, nameRu: 'Москва', name: 'Moscow', lat: 55.75, lon: 37.62, cc: 'RU', admin1: '48', pop: 10_000_000, aliases: ['moscow', 'москва'] },
    { id: 4, nameRu: 'Париж', name: 'Paris', lat: 48.85, lon: 2.35, cc: 'FR', admin1: '11', pop: 2_100_000, aliases: ['paris'] },
    { id: 5, nameRu: '', name: 'Krasnogorsk', lat: 55.82, lon: 37.33, cc: 'RU', admin1: '47', pop: 170_000, aliases: ['krasnogorsk'] },
  ],
  admin1: [
    { cc: 'DE', code: '02', nameRu: 'Бавария', name: 'Bavaria', aliases: ['bavaria', 'bayern', 'бавария'] },
    { cc: 'FR', code: '11', nameRu: 'Иль-де-Франс', name: 'Île-de-France', aliases: ['ile de france'] },
    { cc: 'RU', code: '47', nameRu: 'Московская область', name: 'Moscow Oblast', aliases: ['moscow', 'московская'] },
    { cc: 'DE', code: '99', nameRu: '', name: 'Empty Land', aliases: ['empty land'] },
  ],
};
const centroids = { DE: [51, 9] as [number, number], RU: [60, 100] as [number, number], FR: [46, 2] as [number, number] };
const names: Record<string, Record<string, string>> = { ru: { DE: 'Германия', RU: 'Россия', FR: 'Франция' }, en: { DE: 'Germany', RU: 'Russia', FR: 'France' } };
const m = createPlaceMatcher(gz, centroids, (cc, l) => names[l][cc]);

const st = (o: Partial<Station>): Station => ({
  id: 'x', name: 'S', url: 'https://s', lat: 0, lon: 0, approx: true, cc: 'DE', state: '', langs: [], tags: [],
  votes: 0, clicks: 0, favicon: '', hls: false, ...o,
});

test('haversine Munich–Nuremberg ≈ 150 km', () => {
  expect(Math.round(haversineKm(48.137, 11.575, 49.45, 11.08))).toBeGreaterThan(140);
  expect(Math.round(haversineKm(48.137, 11.575, 49.45, 11.08))).toBeLessThan(160);
});

test('exact coords within 30 km snap to the city', () =>
  expect(m.match(st({ approx: false, lat: 48.2, lon: 11.6 }))).toEqual({
    id: 'c:1', lat: 48.137, lon: 11.575, kind: 'exact', cc: 'DE', nameRu: 'Мюнхен', name: 'Munich',
  }));

test('exact coords far from cities keep their own point, named after the nearest city', () => {
  const p = m.match(st({ approx: false, lat: 48.9, lon: 11.3 }))!;
  expect(p).toMatchObject({ id: 'p:48.90,11.30', lat: 48.9, lon: 11.3, kind: 'exact', nameRu: 'Нюрнберг' });
});

test('region field matches admin1 and uses its most populous city', () =>
  expect(m.match(st({ state: 'Bayern' }))).toEqual({
    id: 'a:DE.02', lat: 48.137, lon: 11.575, kind: 'region', cc: 'DE', nameRu: 'Бавария', name: 'Bavaria',
  }));

test('region matching ignores case, diacritics and generic words (review focus 5)', () => {
  expect(m.match(st({ cc: 'FR', state: 'Région Île-de-France' }))!.id).toBe('a:FR.11');
  expect(m.match(st({ state: 'BAYERN' }))!.id).toBe('a:DE.02');
  expect(m.match(st({ cc: 'RU', state: 'Московская область' }))!.id).toBe('a:RU.47');
});

test('admin1 wins over a city with the same alias', () =>
  expect(m.match(st({ cc: 'RU', state: 'Moscow' }))!.id).toBe('a:RU.47'));

test('region field naming a city falls back to that city', () =>
  expect(m.match(st({ cc: 'RU', state: 'Москва' }))).toMatchObject({ id: 'c:3', kind: 'region', nameRu: 'Москва' }));

test('admin1 without cities falls through to country', () =>
  expect(m.match(st({ state: 'Empty Land' }))!.id).toBe('k:DE'));

test('unknown region → country centroid', () =>
  expect(m.match(st({ state: 'Atlantis' }))).toEqual({
    id: 'k:DE', lat: 51, lon: 9, kind: 'country', cc: 'DE', nameRu: 'Германия', name: 'Germany',
  }));

test('region is matched only within the station country', () =>
  expect(m.match(st({ cc: 'FR', state: 'Bayern' }))!.id).toBe('k:FR'));

test('no centroid and no coords → null', () =>
  expect(m.match(st({ cc: 'ZZ' }))).toBeNull());
```

- [ ] **Step 2: Run** `npx vitest run tests/place-match.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

Добавить в `src/data/types.ts`:
```ts
export type PlaceKind = 'exact' | 'region' | 'country';
export interface PlaceRef { id: string; lat: number; lon: number; kind: PlaceKind; cc: string; nameRu: string; name: string }
```

`src/data/geo.ts`:
```ts
const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
```

`src/data/place-match.ts`:
```ts
import { normalizeName, type Gazetteer, type GzCity } from './gazetteer';
import { haversineKm } from './geo';
import type { Centroids, PlaceKind, PlaceRef, Station } from './types';

const SNAP_KM = 30;
const NAME_KM = 300;

export function createPlaceMatcher(gz: Gazetteer, centroids: Centroids, countryName: (cc: string, locale: 'ru' | 'en') => string) {
  const grid = new Map<string, GzCity[]>();
  const cityByAlias = new Map<string, GzCity>();
  const admin1ByAlias = new Map<string, Gazetteer['admin1'][number]>();
  const admin1Center = new Map<string, GzCity>();
  const cell = (lat: number, lon: number) => `${Math.floor(lat)}:${Math.floor(lon)}`;

  for (const c of gz.cities) {
    const k = cell(c.lat, c.lon);
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(c);
    for (const a of c.aliases) {
      const key = `${c.cc}|${a}`;
      const prev = cityByAlias.get(key);
      if (!prev || prev.pop < c.pop) cityByAlias.set(key, c);
    }
    const ak = `${c.cc}.${c.admin1}`;
    const center = admin1Center.get(ak);
    if (!center || center.pop < c.pop) admin1Center.set(ak, c);
  }
  for (const a of gz.admin1) for (const alias of a.aliases) admin1ByAlias.set(`${a.cc}|${alias}`, a);

  function nearestCity(lat: number, lon: number, maxKm: number): GzCity | null {
    const reach = Math.ceil(maxKm / 100) + 1;
    let best: GzCity | null = null;
    let bestKm = maxKm;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const lonCell = ((((Math.floor(lon) + dx) + 180) % 360) + 360) % 360 - 180;
        for (const c of grid.get(`${Math.floor(lat) + dy}:${lonCell}`) ?? []) {
          const km = haversineKm(lat, lon, c.lat, c.lon);
          if (km <= bestKm) { best = c; bestKm = km; }
        }
      }
    }
    return best;
  }

  const cityRef = (c: GzCity, kind: PlaceKind): PlaceRef =>
    ({ id: `c:${c.id}`, lat: c.lat, lon: c.lon, kind, cc: c.cc, nameRu: c.nameRu, name: c.name });

  function match(s: Station): PlaceRef | null {
    if (!s.approx) {
      const near = nearestCity(s.lat, s.lon, SNAP_KM);
      if (near) return cityRef(near, 'exact');
      const named = nearestCity(s.lat, s.lon, NAME_KM);
      return {
        id: `p:${s.lat.toFixed(2)},${s.lon.toFixed(2)}`, lat: s.lat, lon: s.lon, kind: 'exact', cc: s.cc,
        nameRu: named?.nameRu ?? countryName(s.cc, 'ru'), name: named?.name ?? countryName(s.cc, 'en'),
      };
    }
    const key = normalizeName(s.state);
    if (key) {
      const a = admin1ByAlias.get(`${s.cc}|${key}`);
      const center = a && admin1Center.get(`${s.cc}.${a.code}`);
      if (a && center) {
        return { id: `a:${s.cc}.${a.code}`, lat: center.lat, lon: center.lon, kind: 'region', cc: s.cc, nameRu: a.nameRu, name: a.name };
      }
      const city = cityByAlias.get(`${s.cc}|${key}`);
      if (city) return cityRef(city, 'region');
    }
    const c = centroids[s.cc];
    if (!c) return null;
    return { id: `k:${s.cc}`, lat: c[0], lon: c[1], kind: 'country', cc: s.cc, nameRu: countryName(s.cc, 'ru'), name: countryName(s.cc, 'en') };
  }

  return { match };
}
```

- [ ] **Step 4: Run** `npx vitest run` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(data): place matcher (city snap, region via GeoNames, country fallback)"
```

---

### Task 3: Снимок v2 — места и станции по странам

**Files:**
- Create: `src/data/places.ts`, `src/data/shards.ts` (только кодирование в этом шаге), `scripts/build-snapshot.ts`, `tests/build-snapshot.test.ts`
- Modify: `scripts/snapshot.ts` (переписать), `src/data/stations.ts` (удалить `encode`/`decode`), `src/data/types.ts` (удалить `CompactStation`), `tests/stations.test.ts` (удалить тест roundtrip и импорт `encode`/`decode`)
- Delete: `src/data/load.ts`, `tests/load.test.ts`; в `src/app/main.ts` временно убрать загрузку станций (вернётся в Task 11)

**Interfaces:**
- Consumes: `toStation`, `dedupe` (План 1), `createPlaceMatcher`, `PlaceRef` (Task 2), `decodeGazetteer` (Task 1), `fetchWithMirrors` (План 1).
- Produces (`src/data/places.ts`):
  ```ts
  export interface Place extends PlaceRef { count: number; pop: number }
  export type CompactPlace = [id: string, lat: number, lon: number, kind: 0 | 1 | 2, cc: string, nameRu: string, name: string, count: number, pop: number];
  export interface PlacesFile { v: 2; generated: string; places: CompactPlace[] }
  export function encodePlace(p: Place): CompactPlace
  export function decodePlace(c: CompactPlace): Place
  ```
- Produces (`src/data/shards.ts`):
  ```ts
  export interface StationLite { id: string; name: string; url: string; placeId: string; cc: string; langs: string[]; tags: string[]; votes: number; clicks: number; favicon: string; hls: boolean }
  export type CompactStationV2 = [id: string, name: string, url: string, placeId: string, langs: string, tags: string, votes: number, clicks: number, favicon: string, hls: 0 | 1];
  export interface ShardFile { v: 2; cc: string; stations: CompactStationV2[] }
  export function encodeStation(s: StationLite): CompactStationV2
  export function decodeStation(c: CompactStationV2, cc: string): StationLite
  ```
- Produces (`scripts/build-snapshot.ts`): `buildSnapshot(raw: RawStation[], centroids: Centroids, matcher: { match(s: Station): PlaceRef | null }): { places: Place[]; shards: Map<string, StationLite[]>; report: SnapshotReport }`, где
  ```ts
  interface SnapshotReport { stations: number; places: number; countries: number; languages: number; byKind: Record<PlaceKind, number>; httpInOutput: number; unknownRegions: [string, number][]; unknownLanguages: [string, number][] }
  ```
- Файлы на выходе: `public/data/places.json` (`PlacesFile`), `public/data/stations/<CC>.json` (`ShardFile`), `public/data/meta.json` (`{ generated, ...SnapshotReport }`).

- [ ] **Step 1: Тесты**

`tests/build-snapshot.test.ts`:
```ts
import { expect, test } from 'vitest';
import { buildSnapshot } from '../scripts/build-snapshot';
import { decodePlace, encodePlace, type Place } from '../src/data/places';
import { decodeStation, encodeStation } from '../src/data/shards';
import type { PlaceRef, RawStation, Station } from '../src/data/types';

const raw = (o: Partial<RawStation>): RawStation => ({
  stationuuid: 'u', name: 'S', url: 'https://a', url_resolved: 'https://b', favicon: '', tags: 'pop',
  countrycode: 'DE', language: '', languagecodes: 'de', votes: 1, clickcount: 10, lastcheckok: 1, hls: 0,
  geo_lat: null, geo_long: null, state: '', ...o,
});
const centroids = { DE: [51, 9] as [number, number], FR: [46, 2] as [number, number] };
const matcher = {
  match: (s: Station): PlaceRef | null =>
    s.state === 'Bayern'
      ? { id: 'a:DE.02', lat: 48.1, lon: 11.5, kind: 'region', cc: 'DE', nameRu: 'Бавария', name: 'Bavaria' }
      : !s.approx
        ? { id: 'c:1', lat: 48.1, lon: 11.5, kind: 'exact', cc: s.cc, nameRu: 'Мюнхен', name: 'Munich' }
        : { id: `k:${s.cc}`, lat: 51, lon: 9, kind: 'country', cc: s.cc, nameRu: 'Германия', name: 'Germany' },
};

test('groups stations into places with counts and popularity', () => {
  const { places, shards, report } = buildSnapshot([
    raw({ stationuuid: 'a', state: 'Bayern', clickcount: 5 }),
    raw({ stationuuid: 'b', state: 'Bayern', clickcount: 7 }),
    raw({ stationuuid: 'c', state: 'Atlantis' }),
    raw({ stationuuid: 'd', countrycode: 'FR' }),
  ], centroids, matcher);
  const bav = places.find((p) => p.id === 'a:DE.02')!;
  expect(bav).toMatchObject({ count: 2, pop: 12, kind: 'region', nameRu: 'Бавария' });
  expect(shards.get('DE')!.map((s) => s.id)).toEqual(['c', 'b', 'a']);
  expect(shards.get('FR')!.map((s) => s.placeId)).toEqual(['k:FR']);
  expect(report.byKind).toEqual({ exact: 0, region: 2, country: 2 });
  expect(report.unknownRegions).toEqual([['de|atlantis', 1]]);
});

test('a place shared by exact and region stations is reported as exact', () => {
  const m = { match: (s: Station): PlaceRef => ({ id: 'c:1', lat: 1, lon: 1, kind: s.approx ? 'region' : 'exact', cc: 'DE', nameRu: '', name: 'X' }) };
  const { places } = buildSnapshot([
    raw({ stationuuid: 'a', state: 'X' }),
    raw({ stationuuid: 'b', geo_lat: 48, geo_long: 11 }),
  ], centroids, m);
  expect(places[0].kind).toBe('exact');
});

test('stations without a valid 2-letter country are skipped', () => {
  const { shards } = buildSnapshot([raw({ stationuuid: 'a', countrycode: '', geo_lat: 48, geo_long: 11 })], centroids, matcher);
  expect(shards.size).toBe(0);
});

test('place and station encodings roundtrip', () => {
  const p: Place = { id: 'c:1', lat: 1.5, lon: 2.5, kind: 'region', cc: 'DE', nameRu: 'Я', name: 'I', count: 3, pop: 9 };
  expect(decodePlace(encodePlace(p))).toEqual(p);
  const s = { id: 'u', name: 'N', url: 'https://x', placeId: 'c:1', cc: 'DE', langs: ['de'], tags: ['pop'], votes: 1, clicks: 2, favicon: '', hls: true };
  expect(decodeStation(encodeStation(s), 'DE')).toEqual(s);
});
```

Удалить из `tests/stations.test.ts` тест `encode/decode roundtrip` и `decode, encode` из импорта.

- [ ] **Step 2: Run** `npx vitest run tests/build-snapshot.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`src/data/places.ts`:
```ts
import type { PlaceKind, PlaceRef } from './types';

export interface Place extends PlaceRef { count: number; pop: number }
export type CompactPlace = [id: string, lat: number, lon: number, kind: 0 | 1 | 2, cc: string, nameRu: string, name: string, count: number, pop: number];
export interface PlacesFile { v: 2; generated: string; places: CompactPlace[] }

const KINDS: PlaceKind[] = ['exact', 'region', 'country'];

export function encodePlace(p: Place): CompactPlace {
  return [p.id, p.lat, p.lon, KINDS.indexOf(p.kind) as 0 | 1 | 2, p.cc, p.nameRu, p.name, p.count, p.pop];
}

export function decodePlace(c: CompactPlace): Place {
  const [id, lat, lon, kind, cc, nameRu, name, count, pop] = c;
  return { id, lat, lon, kind: KINDS[kind], cc, nameRu, name, count, pop };
}
```

`src/data/shards.ts` (в этом шаге — только типы и кодирование):
```ts
export interface StationLite {
  id: string; name: string; url: string; placeId: string; cc: string;
  langs: string[]; tags: string[]; votes: number; clicks: number; favicon: string; hls: boolean;
}
export type CompactStationV2 = [id: string, name: string, url: string, placeId: string, langs: string, tags: string, votes: number, clicks: number, favicon: string, hls: 0 | 1];
export interface ShardFile { v: 2; cc: string; stations: CompactStationV2[] }

export function encodeStation(s: StationLite): CompactStationV2 {
  return [s.id, s.name, s.url, s.placeId, s.langs.join(','), s.tags.join(','), s.votes, s.clicks, s.favicon, s.hls ? 1 : 0];
}

export function decodeStation(c: CompactStationV2, cc: string): StationLite {
  const [id, name, url, placeId, langs, tags, votes, clicks, favicon, hls] = c;
  return { id, name, url, placeId, cc, langs: langs ? langs.split(',') : [], tags: tags ? tags.split(',') : [], votes, clicks, favicon, hls: hls === 1 };
}
```

`scripts/build-snapshot.ts`:
```ts
import type { Place } from '../src/data/places';
import type { StationLite } from '../src/data/shards';
import { dedupe, toStation } from '../src/data/stations';
import type { Centroids, PlaceKind, PlaceRef, RawStation, Station } from '../src/data/types';

export interface SnapshotReport {
  stations: number; places: number; countries: number; languages: number;
  byKind: Record<PlaceKind, number>; httpInOutput: number;
  unknownRegions: [string, number][]; unknownLanguages: [string, number][];
}

const RANK: Record<PlaceKind, number> = { exact: 0, region: 1, country: 2 };
const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 30);
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

export function buildSnapshot(raw: RawStation[], centroids: Centroids, matcher: { match(s: Station): PlaceRef | null }) {
  const places = new Map<string, Place>();
  const shards = new Map<string, StationLite[]>();
  const byKind: Record<PlaceKind, number> = { exact: 0, region: 0, country: 0 };
  const unknownRegions = new Map<string, number>();
  const unknownLanguages = new Map<string, number>();
  const rawById = new Map(raw.map((r) => [r.stationuuid, r]));
  let count = 0;

  const stations = dedupe(raw.map((r) => toStation(r, centroids)).filter((s): s is Station => s !== null));
  for (const s of stations) {
    if (!/^[A-Z]{2}$/.test(s.cc)) continue;
    const ref = matcher.match(s);
    if (!ref) continue;
    count++;
    byKind[ref.kind]++;
    if (ref.kind === 'country' && s.state) bump(unknownRegions, `${s.cc.toLowerCase()}|${s.state.toLowerCase()}`);
    const lang = rawById.get(s.id)?.language ?? '';
    if (lang && s.langs.length === 0) for (const n of lang.split(',')) { const k = n.trim().toLowerCase(); if (k) bump(unknownLanguages, k); }

    const place = places.get(ref.id) ?? places.set(ref.id, { ...ref, count: 0, pop: 0 }).get(ref.id)!;
    place.count++;
    place.pop += s.clicks;
    if (RANK[ref.kind] < RANK[place.kind]) place.kind = ref.kind;

    const lite: StationLite = {
      id: s.id, name: s.name, url: s.url, placeId: ref.id, cc: s.cc, langs: s.langs, tags: s.tags,
      votes: s.votes, clicks: s.clicks, favicon: s.favicon, hls: s.hls,
    };
    (shards.get(s.cc) ?? shards.set(s.cc, []).get(s.cc)!).push(lite);
  }
  for (const list of shards.values()) list.sort((a, b) => b.clicks - a.clicks);

  const all = [...shards.values()].flat();
  const report: SnapshotReport = {
    stations: count,
    places: places.size,
    countries: shards.size,
    languages: new Set(all.flatMap((s) => s.langs)).size,
    byKind,
    httpInOutput: all.filter((s) => !s.url.startsWith('https://')).length,
    unknownRegions: top(unknownRegions),
    unknownLanguages: top(unknownLanguages),
  };
  return { places: [...places.values()], shards, report };
}
```

`scripts/snapshot.ts` (целиком):
```ts
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { decodeGazetteer, type GazetteerFile } from '../src/data/gazetteer';
import { createPlaceMatcher } from '../src/data/place-match';
import { encodePlace, type PlacesFile } from '../src/data/places';
import { encodeStation, type ShardFile } from '../src/data/shards';
import type { Centroids, RawStation } from '../src/data/types';
import { buildSnapshot } from './build-snapshot';
import { fetchWithMirrors } from './radio-browser';

const require = createRequire(import.meta.url);
const countries = require('world-countries/countries.json') as { cca2: string; latlng: [number, number] }[];
const centroids: Centroids = Object.fromEntries(countries.map((c) => [c.cca2, c.latlng]));
const gz = decodeGazetteer(JSON.parse(readFileSync('data/gazetteer.json', 'utf8')) as GazetteerFile);
const dn = { ru: new Intl.DisplayNames(['ru'], { type: 'region' }), en: new Intl.DisplayNames(['en'], { type: 'region' }) };
const matcher = createPlaceMatcher(gz, centroids, (cc, l) => dn[l].of(cc) ?? cc);

const raw = await fetchWithMirrors<RawStation[]>('/json/stations/search?hidebroken=true&is_https=true&limit=200000&order=clickcount&reverse=true');
const { places, shards, report } = buildSnapshot(raw, centroids, matcher);
if (report.stations < 1000) throw new Error(`suspiciously few stations: ${report.stations}`);

const generated = new Date().toISOString();
rmSync('public/data', { recursive: true, force: true });
mkdirSync('public/data/stations', { recursive: true });
const placesFile: PlacesFile = { v: 2, generated, places: places.map(encodePlace) };
writeFileSync('public/data/places.json', JSON.stringify(placesFile));
for (const [cc, list] of shards) {
  const file: ShardFile = { v: 2, cc, stations: list.map(encodeStation) };
  writeFileSync(`public/data/stations/${cc}.json`, JSON.stringify(file));
}
writeFileSync('public/data/meta.json', JSON.stringify({ generated, ...report }, null, 2));
console.log(JSON.stringify({ generated, ...report, unknownLanguages: report.unknownLanguages.slice(0, 10) }, null, 2));
```

Удалить `encode`, `decode` из `src/data/stations.ts` и `CompactStation` из `src/data/types.ts` (а также их импорт). Удалить `src/data/load.ts` и `tests/load.test.ts`. `src/app/main.ts` временно — без загрузки станций:
```ts
import ru from '../../locales/ru.json';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config';
import { applyDirection, createI18n, resolveLocale, type Messages } from '../i18n/i18n';
import { safeStorage } from '../i18n/storage';
import { renderShell } from '../ui/shell';

const catalogs: Record<string, Messages> = { ru };
const locale = resolveLocale(location.search, safeStorage(), navigator.languages, SUPPORTED_LOCALES, DEFAULT_LOCALE);
const i18n = createI18n(locale, catalogs[locale]);
applyDirection(document, locale);
renderShell(document.getElementById('app')!, i18n);
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS, без ошибок типов.

- [ ] **Step 5: Живой снимок и размер**

Run: `npm run snapshot`
Expected: `stations` ≈ 37 000, `httpInOutput: 0`, `byKind.region` > 5000. Затем:
```bash
node -e "const z=require('zlib'),f=require('fs');const b=f.readFileSync('public/data/places.json');console.log('places.json', b.length, 'gzip', z.gzipSync(b).length)"
```
Expected: gzip ≤ 300 000 байт. Если больше — записать Ruling и сократить: округлить `lat/lon` до 2 знаков в `encodePlace` (тест roundtrip использует 1 знак — останется зелёным).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(data): snapshot v2 — places.json + per-country station shards"
```

---

### Task 4: Клиент: загрузка мест, станций страны, названия

**Files:**
- Modify: `src/data/places.ts` (добавить `loadPlaces`), `src/data/shards.ts` (добавить `createShardStore`)
- Create: `src/data/place-name.ts`, `tests/places-client.test.ts`

**Interfaces:**
- Produces:
  - `loadPlaces(baseUrl: string, fetchFn?: typeof fetch): Promise<Place[]>` — бросает при HTTP-ошибке или `v !== 2`.
  - `interface ShardStore { get(cc: string): Promise<StationLite[]> }`, `createShardStore(baseUrl: string, fetchFn?: typeof fetch): ShardStore` — кеширует успешные ответы и одновременные запросы; при ошибке кеш очищается (повтор возможен).
  - `placeTitle(p: Place, locale: string): string`, `countryName(cc: string, locale: string): string` (`src/data/place-name.ts`).

- [ ] **Step 1: Тесты**

`tests/places-client.test.ts`:
```ts
import { expect, test, vi } from 'vitest';
import { countryName, placeTitle } from '../src/data/place-name';
import { loadPlaces, type Place } from '../src/data/places';
import { createShardStore } from '../src/data/shards';

const ok = (body: unknown) => new Response(JSON.stringify(body));

test('loadPlaces decodes v2 file from base url', async () => {
  const f = vi.fn(async () => ok({ v: 2, generated: 'x', places: [['c:1', 1, 2, 0, 'DE', 'Мюнхен', 'Munich', 3, 9]] }));
  const list = await loadPlaces('/base/', f as unknown as typeof fetch);
  expect(f).toHaveBeenCalledWith('/base/data/places.json');
  expect(list[0]).toMatchObject({ id: 'c:1', kind: 'exact', count: 3 });
});

test('loadPlaces rejects other versions and HTTP errors', async () => {
  await expect(loadPlaces('/', (async () => ok({ v: 1, places: [] })) as unknown as typeof fetch)).rejects.toThrow(/format/);
  await expect(loadPlaces('/', (async () => new Response('', { status: 500 })) as unknown as typeof fetch)).rejects.toThrow(/500/);
});

test('shard store caches per country and shares in-flight requests', async () => {
  const f = vi.fn(async () => ok({ v: 2, cc: 'DE', stations: [['u', 'N', 'https://x', 'c:1', 'de', '', 1, 2, '', 0]] }));
  const store = createShardStore('/', f as unknown as typeof fetch);
  const [a, b] = await Promise.all([store.get('DE'), store.get('DE')]);
  await store.get('DE');
  expect(f).toHaveBeenCalledTimes(1);
  expect(f).toHaveBeenCalledWith('/data/stations/DE.json');
  expect(a).toBe(b);
  expect(a[0]).toMatchObject({ id: 'u', cc: 'DE', placeId: 'c:1' });
});

test('a failed shard load can be retried (review focus 2)', async () => {
  let n = 0;
  const f = (async () => (n++ === 0 ? new Response('', { status: 503 }) : ok({ v: 2, cc: 'FR', stations: [] }))) as unknown as typeof fetch;
  const store = createShardStore('/', f);
  await expect(store.get('FR')).rejects.toThrow();
  await expect(store.get('FR')).resolves.toEqual([]);
});

const place = (o: Partial<Place>): Place => ({ id: 'c:1', lat: 0, lon: 0, kind: 'exact', cc: 'DE', nameRu: 'Мюнхен', name: 'Munich', count: 1, pop: 1, ...o });

test('placeTitle prefers russian name for ru, falls back to local name', () => {
  expect(placeTitle(place({}), 'ru')).toBe('Мюнхен');
  expect(placeTitle(place({ nameRu: '' }), 'ru')).toBe('Munich');
  expect(placeTitle(place({}), 'en')).toBe('Munich');
});

test('country places and country names come from Intl in the UI language', () => {
  expect(placeTitle(place({ kind: 'country', nameRu: 'x', name: 'y' }), 'ru')).toBe('Германия');
  expect(countryName('FR', 'ru')).toBe('Франция');
  expect(countryName('ZZ', 'ru')).toBe('ZZ');
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

Дописать в `src/data/places.ts`:
```ts
export async function loadPlaces(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<Place[]> {
  const r = await fetchFn(`${baseUrl}data/places.json`);
  if (!r.ok) throw new Error(`places HTTP ${r.status}`);
  const body = (await r.json()) as Partial<PlacesFile>;
  if (body.v !== 2 || !Array.isArray(body.places)) throw new Error('unsupported places format');
  return body.places.map(decodePlace);
}
```

Дописать в `src/data/shards.ts`:
```ts
export interface ShardStore { get(cc: string): Promise<StationLite[]> }

export function createShardStore(baseUrl: string, fetchFn: typeof fetch = fetch): ShardStore {
  const cache = new Map<string, Promise<StationLite[]>>();
  async function load(cc: string): Promise<StationLite[]> {
    const r = await fetchFn(`${baseUrl}data/stations/${cc}.json`);
    if (!r.ok) throw new Error(`stations ${cc} HTTP ${r.status}`);
    const body = (await r.json()) as Partial<ShardFile>;
    if (body.v !== 2 || !Array.isArray(body.stations)) throw new Error('unsupported stations format');
    return body.stations.map((c) => decodeStation(c, cc));
  }
  return {
    get(cc) {
      let p = cache.get(cc);
      if (!p) {
        p = load(cc);
        cache.set(cc, p);
        p.catch(() => cache.delete(cc));
      }
      return p;
    },
  };
}
```

`src/data/place-name.ts`:
```ts
import type { Place } from './places';

const cache = new Map<string, Intl.DisplayNames>();
function regions(locale: string): Intl.DisplayNames {
  let d = cache.get(locale);
  if (!d) { d = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }); cache.set(locale, d); }
  return d;
}

export function countryName(cc: string, locale: string): string {
  try { return regions(locale).of(cc) ?? cc; } catch { return cc; }
}

export function placeTitle(p: Place, locale: string): string {
  if (p.kind === 'country') return countryName(p.cc, locale);
  return (locale === 'ru' && p.nameRu) || p.name;
}
```

- [ ] **Step 4: Run** `npx vitest run` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(data): client loaders for places and per-country stations; localized place titles"
```

---

### Task 5: Чёрный список и «Следующая рядом»

**Files:**
- Create: `src/player/blacklist.ts`, `src/player/next-nearby.ts`, `tests/blacklist.test.ts`, `tests/next-nearby.test.ts`

**Interfaces:**
- Consumes: `haversineKm` (Task 2), `Place` (Task 3), `StationLite` (Task 3).
- Produces:
  - `BLACKLIST_TTL_MS = 12 * 60 * 60 * 1000`; `interface Blacklist { add(id: string): void; has(id: string): boolean }`; `createBlacklist(storage: Storage | null, now?: () => number, ttlMs?: number): Blacklist`
  - `interface NextQuery { currentId: string; currentPlace: Place; places: Place[]; stationsOf(cc: string): Promise<StationLite[]>; isBlocked(id: string): boolean; filter?: (s: StationLite) => boolean; maxPlaces?: number }`
  - `findNextNearby(q: NextQuery): Promise<{ station: StationLite; place: Place } | null>`

- [ ] **Step 1: Тесты**

`tests/blacklist.test.ts`:
```ts
import { expect, test } from 'vitest';
import { BLACKLIST_TTL_MS, createBlacklist } from '../src/player/blacklist';

class Mem {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const mem = () => new Mem() as unknown as Storage;

test('ttl is 12 hours (customer decision 04.10.2026)', () => expect(BLACKLIST_TTL_MS).toBe(12 * 3600 * 1000));

test('station stays blocked until the ttl passes', () => {
  let t = 1000;
  const b = createBlacklist(mem(), () => t);
  b.add('x');
  t += BLACKLIST_TTL_MS - 1;
  expect(b.has('x')).toBe(true);
  t += 1;
  expect(b.has('x')).toBe(false);
  expect(b.has('never')).toBe(false);
});

test('persists across instances', () => {
  const s = mem();
  createBlacklist(s, () => 0).add('x');
  expect(createBlacklist(s, () => 1).has('x')).toBe(true);
});

test('works without storage and with storage that throws (review focus 4)', () => {
  const none = createBlacklist(null, () => 0);
  none.add('x');
  expect(none.has('x')).toBe(true);
  const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
  const b = createBlacklist(bad, () => 0);
  expect(() => b.add('y')).not.toThrow();
  expect(b.has('y')).toBe(true);
});

test('corrupt stored value is ignored', () => {
  const s = mem();
  s.setItem('blacklist', '{not json');
  expect(createBlacklist(s, () => 0).has('x')).toBe(false);
});
```

`tests/next-nearby.test.ts`:
```ts
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
```

- [ ] **Step 2: Run** `npx vitest run tests/blacklist.test.ts tests/next-nearby.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`src/player/blacklist.ts`:
```ts
export const BLACKLIST_TTL_MS = 12 * 60 * 60 * 1000;
const KEY = 'blacklist';

export interface Blacklist { add(id: string): void; has(id: string): boolean }

export function createBlacklist(storage: Storage | null, now: () => number = Date.now, ttlMs = BLACKLIST_TTL_MS): Blacklist {
  let map: Record<string, number> = {};
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? '{}');
    if (parsed && typeof parsed === 'object') map = parsed as Record<string, number>;
  } catch { map = {}; }

  const save = () => { try { storage?.setItem(KEY, JSON.stringify(map)); } catch { /* storage unavailable */ } };

  return {
    add(id) {
      map[id] = now() + ttlMs;
      save();
    },
    has(id) {
      const until = map[id];
      if (until === undefined) return false;
      if (until <= now()) { delete map[id]; save(); return false; }
      return true;
    },
  };
}
```

`src/player/next-nearby.ts`:
```ts
import { haversineKm } from '../data/geo';
import type { Place } from '../data/places';
import type { StationLite } from '../data/shards';

export interface NextQuery {
  currentId: string;
  currentPlace: Place;
  places: Place[];
  stationsOf(cc: string): Promise<StationLite[]>;
  isBlocked(id: string): boolean;
  filter?: (s: StationLite) => boolean;
  maxPlaces?: number;
}

export async function findNextNearby(q: NextQuery): Promise<{ station: StationLite; place: Place } | null> {
  const { lat, lon } = q.currentPlace;
  const ordered = q.places
    .filter((p) => p.id !== q.currentPlace.id)
    .map((p) => ({ p, d: haversineKm(lat, lon, p.lat, p.lon) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, (q.maxPlaces ?? 60) - 1)
    .map((x) => x.p);
  for (const place of [q.currentPlace, ...ordered]) {
    let list: StationLite[];
    try { list = await q.stationsOf(place.cc); } catch { continue; }
    const best = list
      .filter((s) => s.placeId === place.id && s.id !== q.currentId && !q.isBlocked(s.id) && (q.filter?.(s) ?? true))
      .sort((a, b) => b.clicks - a.clicks)[0];
    if (best) return { station: best, place };
  }
  return null;
}
```

- [ ] **Step 4: Run** `npx vitest run` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(player): 12h blacklist and next-nearby station search"
```

---

### Task 6: Плеер — свежий URL, состояния, HLS, Media Session

**Files:**
- Create: `src/player/stream-url.ts`, `src/player/player.ts`, `src/player/hls-loader.ts`, `src/player/media-session.ts`, `tests/stream-url.test.ts`, `tests/player.test.ts`, `tests/media-session.test.ts`
- Modify: `package.json` (зависимость `hls.js`)

**Interfaces:**
- Consumes: `MIRRORS` (Task 1), `StationLite` (Task 3).
- Produces:
  - `resolveStreamUrl(s: Pick<StationLite, 'id' | 'url'>, fetchFn?: typeof fetch, mirrors?: readonly string[], timeoutMs?: number): Promise<string>`
  - ```ts
    export type PlayerState =
      | { kind: 'idle' }
      | { kind: 'loading' | 'playing' | 'paused' | 'error'; station: StationLite };
    export interface AudioLike extends EventTarget { src: string; volume: number; muted: boolean; play(): Promise<void>; pause(): void; removeAttribute(name: string): void; load(): void; canPlayType(type: string): string }
    export interface HlsLike { loadSource(url: string): void; attachMedia(media: AudioLike): void; on(event: string, cb: (event: string, data: { fatal?: boolean }) => void): void; destroy(): void }
    export interface HlsCtor { new (): HlsLike; isSupported(): boolean; Events: { ERROR: string } }
    export interface PlayerDeps { audio: AudioLike; resolveUrl(s: StationLite): Promise<string>; loadHls(): Promise<HlsCtor>; onFailure(s: StationLite): void; timeoutMs?: number }
    export interface Player { play(s: StationLite): Promise<void>; pause(): void; toggle(): void; setVolume(v: number): void; setMuted(m: boolean): void; getState(): PlayerState; subscribe(l: (s: PlayerState) => void): () => void }
    export const STREAM_TIMEOUT_MS = 8000;
    export function createPlayer(deps: PlayerDeps): Player
    ```
  - `loadHls(): Promise<HlsCtor>` (`src/player/hls-loader.ts`)
  - `interface SessionInfo { title: string; artist: string; artwork: string }`; `updateMediaSession(ms: MediaSession | undefined, info: SessionInfo | null, state: 'playing' | 'paused' | 'none', h: { play(): void; pause(): void; next(): void }): void`

- [ ] **Step 1: Зависимость**

```bash
npm i hls.js
```

- [ ] **Step 2: Тесты**

`tests/stream-url.test.ts`:
```ts
import { expect, test, vi } from 'vitest';
import { resolveStreamUrl } from '../src/player/stream-url';

const json = (b: unknown) => new Response(JSON.stringify(b));
const station = { id: 'a b', url: 'https://snapshot/stream' };

test('uses the fresh https url from the click endpoint', async () => {
  const f = vi.fn(async () => json({ ok: true, url: 'https://fresh/stream' }));
  await expect(resolveStreamUrl(station, f as unknown as typeof fetch, ['m1'])).resolves.toBe('https://fresh/stream');
  expect((f.mock.calls[0] as unknown[])[0]).toBe('https://m1/json/url/a%20b');
});

test('tries the next mirror when one fails', async () => {
  const f = (async (u: string) => (u.includes('m1') ? new Response('', { status: 502 }) : json({ ok: true, url: 'https://fresh' }))) as unknown as typeof fetch;
  await expect(resolveStreamUrl(station, f, ['m1', 'm2'])).resolves.toBe('https://fresh');
});

test('non-https fresh url or API outage falls back to the snapshot url (review focus 3)', async () => {
  const http = (async () => json({ ok: true, url: 'http://insecure' })) as unknown as typeof fetch;
  await expect(resolveStreamUrl(station, http, ['m1'])).resolves.toBe('https://snapshot/stream');
  const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  await expect(resolveStreamUrl(station, down, ['m1', 'm2'])).resolves.toBe('https://snapshot/stream');
});

test('no https url at all → rejects', async () => {
  const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  await expect(resolveStreamUrl({ id: 'x', url: 'http://old' }, down, ['m1'])).rejects.toThrow(/https/);
});
```

`tests/player.test.ts`:
```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { StationLite } from '../src/data/shards';
import { createPlayer, STREAM_TIMEOUT_MS, type AudioLike, type HlsCtor } from '../src/player/player';

class FakeAudio extends EventTarget implements AudioLike {
  src = ''; volume = 1; muted = false; paused = true; native = false;
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute(n: string) { if (n === 'src') this.src = ''; }
  load() {}
  canPlayType(t: string) { return this.native && t === 'application/vnd.apple.mpegurl' ? 'maybe' : ''; }
  fire(t: string) { this.dispatchEvent(new Event(t)); }
}

interface FakeHls { url?: string; handlers: ((e: string, d: { fatal?: boolean }) => void)[] }
const st = (id: string, hls = false): StationLite =>
  ({ id, name: id, url: `https://${id}`, placeId: 'p', cc: 'DE', langs: [], tags: [], votes: 0, clicks: 0, favicon: '', hls });

let audio: FakeAudio;
let failures: string[];
let hlsInstances: FakeHls[];
const Hls = class {
  static Events = { ERROR: 'hlsError' };
  static isSupported() { return true; }
  url?: string;
  handlers: ((e: string, d: { fatal?: boolean }) => void)[] = [];
  constructor() { hlsInstances.push(this); }
  loadSource(u: string) { this.url = u; }
  attachMedia() {}
  on(_e: string, cb: (e: string, d: { fatal?: boolean }) => void) { this.handlers.push(cb); }
  destroy() {}
} as unknown as HlsCtor;

const make = (resolveUrl = async (s: StationLite) => s.url) =>
  createPlayer({ audio, resolveUrl, loadHls: async () => Hls, onFailure: (s) => failures.push(s.id) });

beforeEach(() => { vi.useFakeTimers(); audio = new FakeAudio(); failures = []; hlsInstances = []; });
afterEach(() => vi.useRealTimers());

test('loading → playing on the playing event', async () => {
  const p = make();
  await p.play(st('a'));
  expect(p.getState()).toMatchObject({ kind: 'loading' });
  expect(audio.src).toBe('https://a');
  audio.fire('playing');
  expect(p.getState()).toMatchObject({ kind: 'playing', station: { id: 'a' } });
});

test('no sound within 8 s → error and failure reported once', async () => {
  const p = make();
  await p.play(st('a'));
  await vi.advanceTimersByTimeAsync(STREAM_TIMEOUT_MS);
  expect(STREAM_TIMEOUT_MS).toBe(8000);
  expect(p.getState()).toMatchObject({ kind: 'error', station: { id: 'a' } });
  expect(failures).toEqual(['a']);
});

test('a stall longer than 8 s while playing → error; a short stall recovers', async () => {
  const p = make();
  await p.play(st('a'));
  audio.fire('playing');
  audio.fire('waiting');
  await vi.advanceTimersByTimeAsync(5000);
  audio.fire('playing');
  await vi.advanceTimersByTimeAsync(5000);
  expect(p.getState().kind).toBe('playing');
  audio.fire('waiting');
  await vi.advanceTimersByTimeAsync(STREAM_TIMEOUT_MS);
  expect(p.getState().kind).toBe('error');
});

test('media error while loading → error', async () => {
  const p = make();
  await p.play(st('a'));
  audio.fire('error');
  expect(p.getState().kind).toBe('error');
  expect(failures).toEqual(['a']);
});

test('quick switch A → B: only B is current, A never fails (review focus 1)', async () => {
  let releaseA!: (u: string) => void;
  const p = make((s) => (s.id === 'a' ? new Promise<string>((r) => { releaseA = r; }) : Promise.resolve(s.url)));
  void p.play(st('a'));
  await p.play(st('b'));
  releaseA('https://a');
  await vi.advanceTimersByTimeAsync(0);
  expect(audio.src).toBe('https://b');
  audio.fire('playing');
  await vi.advanceTimersByTimeAsync(STREAM_TIMEOUT_MS * 2);
  expect(p.getState()).toMatchObject({ kind: 'playing', station: { id: 'b' } });
  expect(failures).toEqual([]);
});

test('HLS station uses hls.js when not natively supported; fatal error → error', async () => {
  const p = make();
  await p.play(st('h', true));
  expect(hlsInstances).toHaveLength(1);
  expect(hlsInstances[0].url).toBe('https://h');
  hlsInstances[0].handlers[0]('hlsError', { fatal: true });
  expect(p.getState().kind).toBe('error');
});

test('native HLS (Safari) plays through the audio element', async () => {
  audio.native = true;
  const p = make();
  await p.play(st('h', true));
  expect(hlsInstances).toHaveLength(0);
  expect(audio.src).toBe('https://h');
});

test('url resolution failure → error', async () => {
  const p = make(async () => { throw new Error('no https'); });
  await p.play(st('a'));
  expect(p.getState().kind).toBe('error');
});

test('pause and toggle back reconnects the live stream', async () => {
  const p = make();
  await p.play(st('a'));
  audio.fire('playing');
  p.toggle();
  expect(p.getState().kind).toBe('paused');
  expect(audio.paused).toBe(true);
  p.toggle();
  await vi.advanceTimersByTimeAsync(0);
  expect(p.getState().kind).toBe('loading');
});

test('volume is clamped and unsubscribed listeners are not called', async () => {
  const p = make();
  const seen: string[] = [];
  const off = p.subscribe((s) => seen.push(s.kind));
  p.setVolume(2);
  expect(audio.volume).toBe(1);
  p.setVolume(-1);
  expect(audio.volume).toBe(0);
  await p.play(st('a'));
  off();
  audio.fire('playing');
  expect(seen).toEqual(['loading']);
});
```

`tests/media-session.test.ts`:
```ts
import { afterEach, expect, test, vi } from 'vitest';
import { updateMediaSession } from '../src/player/media-session';

afterEach(() => vi.unstubAllGlobals());

test('sets metadata, state and action handlers', () => {
  vi.stubGlobal('MediaMetadata', class { constructor(public init: unknown) {} });
  const ms = { metadata: null as unknown, playbackState: 'none', setActionHandler: vi.fn() };
  const h = { play: vi.fn(), pause: vi.fn(), next: vi.fn() };
  updateMediaSession(ms as unknown as MediaSession, { title: 'Fado', artist: 'Лиссабон, Португалия', artwork: 'https://i' }, 'playing', h);
  expect(ms.playbackState).toBe('playing');
  expect((ms.metadata as { init: { title: string } }).init.title).toBe('Fado');
  expect(ms.setActionHandler).toHaveBeenCalledWith('nexttrack', expect.any(Function));
});

test('missing API or unsupported action does not throw', () => {
  expect(() => updateMediaSession(undefined, null, 'none', { play() {}, pause() {}, next() {} })).not.toThrow();
  const ms = { metadata: null, playbackState: 'none', setActionHandler: () => { throw new Error('unsupported'); } };
  expect(() => updateMediaSession(ms as unknown as MediaSession, null, 'none', { play() {}, pause() {}, next() {} })).not.toThrow();
});
```

- [ ] **Step 3: Run** `npx vitest run tests/stream-url.test.ts tests/player.test.ts tests/media-session.test.ts` → FAIL.

- [ ] **Step 4: Реализация**

`src/player/stream-url.ts`:
```ts
import { MIRRORS } from '../data/mirrors';
import type { StationLite } from '../data/shards';

// The click endpoint returns the current stream URL and counts the play (Radio Browser API rule).
export async function resolveStreamUrl(
  s: Pick<StationLite, 'id' | 'url'>,
  fetchFn: typeof fetch = fetch,
  mirrors: readonly string[] = MIRRORS,
  timeoutMs = 5000,
): Promise<string> {
  for (const host of mirrors) {
    try {
      const r = await fetchFn(`https://${host}/json/url/${encodeURIComponent(s.id)}`, { signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) continue;
      const body = (await r.json()) as { url?: unknown };
      if (typeof body.url === 'string' && body.url.startsWith('https://')) return body.url;
      break;
    } catch { /* next mirror */ }
  }
  if (s.url.startsWith('https://')) return s.url;
  throw new Error('no https stream url');
}
```

`src/player/hls-loader.ts`:
```ts
import type { HlsCtor } from './player';

export async function loadHls(): Promise<HlsCtor> {
  return (await import('hls.js')).default as unknown as HlsCtor;
}
```

`src/player/player.ts`:
```ts
import type { StationLite } from '../data/shards';

export type PlayerState =
  | { kind: 'idle' }
  | { kind: 'loading' | 'playing' | 'paused' | 'error'; station: StationLite };

export interface AudioLike extends EventTarget {
  src: string; volume: number; muted: boolean;
  play(): Promise<void>; pause(): void; removeAttribute(name: string): void; load(): void; canPlayType(type: string): string;
}
export interface HlsLike {
  loadSource(url: string): void; attachMedia(media: AudioLike): void;
  on(event: string, cb: (event: string, data: { fatal?: boolean }) => void): void; destroy(): void;
}
export interface HlsCtor { new (): HlsLike; isSupported(): boolean; Events: { ERROR: string } }
export interface PlayerDeps {
  audio: AudioLike;
  resolveUrl(s: StationLite): Promise<string>;
  loadHls(): Promise<HlsCtor>;
  onFailure(s: StationLite): void;
  timeoutMs?: number;
}
export interface Player {
  play(s: StationLite): Promise<void>; pause(): void; toggle(): void;
  setVolume(v: number): void; setMuted(m: boolean): void;
  getState(): PlayerState; subscribe(l: (s: PlayerState) => void): () => void;
}

export const STREAM_TIMEOUT_MS = 8000;
const isHlsUrl = (u: string) => /\.m3u8(\?|$)/i.test(u);

export function createPlayer(deps: PlayerDeps): Player {
  const { audio } = deps;
  const timeoutMs = deps.timeoutMs ?? STREAM_TIMEOUT_MS;
  const listeners = new Set<(s: PlayerState) => void>();
  let state: PlayerState = { kind: 'idle' };
  let token = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hls: HlsLike | null = null;

  const set = (s: PlayerState) => { state = s; for (const l of listeners) l(s); };
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const arm = (t: number) => { clearTimer(); timer = setTimeout(() => { if (t === token) fail(); }, timeoutMs); };

  function teardown() {
    clearTimer();
    hls?.destroy();
    hls = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }

  function fail() {
    if (state.kind === 'idle') return;
    const station = state.station;
    token++;
    teardown();
    set({ kind: 'error', station });
    deps.onFailure(station);
  }

  audio.addEventListener('playing', () => {
    if (state.kind === 'loading' || state.kind === 'playing') { clearTimer(); set({ kind: 'playing', station: state.station }); }
  });
  audio.addEventListener('waiting', () => { if (state.kind === 'playing') arm(token); });
  audio.addEventListener('error', () => { if (state.kind === 'loading' || state.kind === 'playing') fail(); });

  async function play(station: StationLite) {
    const t = ++token;
    teardown();
    set({ kind: 'loading', station });
    arm(t);
    try {
      const url = await deps.resolveUrl(station);
      if (t !== token) return;
      if ((station.hls || isHlsUrl(url)) && !audio.canPlayType('application/vnd.apple.mpegurl')) {
        const Hls = await deps.loadHls();
        if (t !== token) return;
        if (!Hls.isSupported()) { fail(); return; }
        const h = new Hls();
        hls = h;
        h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal && t === token) fail(); });
        h.loadSource(url);
        h.attachMedia(audio);
      } else {
        audio.src = url;
      }
      await audio.play();
    } catch {
      if (t === token) fail();
    }
  }

  function pause() {
    if (state.kind === 'loading' || state.kind === 'playing') {
      const station = state.station;
      token++;
      teardown();
      set({ kind: 'paused', station });
    }
  }

  return {
    play,
    pause,
    toggle() {
      if (state.kind === 'loading' || state.kind === 'playing') pause();
      else if (state.kind === 'paused' || state.kind === 'error') void play(state.station);
    },
    setVolume(v) { audio.volume = Math.min(1, Math.max(0, v)); },
    setMuted(m) { audio.muted = m; },
    getState: () => state,
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
```

`src/player/media-session.ts`:
```ts
export interface SessionInfo { title: string; artist: string; artwork: string }

export function updateMediaSession(
  ms: MediaSession | undefined,
  info: SessionInfo | null,
  state: 'playing' | 'paused' | 'none',
  h: { play(): void; pause(): void; next(): void },
): void {
  if (!ms) return;
  try {
    ms.playbackState = state;
    if (!info) ms.metadata = null;
    else if (typeof MediaMetadata !== 'undefined') {
      ms.metadata = new MediaMetadata({ title: info.title, artist: info.artist, artwork: info.artwork ? [{ src: info.artwork, sizes: '96x96' }] : [] });
    }
  } catch { /* partial support */ }
  const actions: [MediaSessionAction, () => void][] = [['play', h.play], ['pause', h.pause], ['nexttrack', h.next]];
  for (const [action, fn] of actions) {
    try { ms.setActionHandler(action, fn); } catch { /* action not supported */ }
  }
}
```

- [ ] **Step 5: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(player): stream url resolver, player state machine with 8s timeout, HLS, Media Session"
```

---

### Task 7: Группировка и вспомогательные функции карты

**Files:**
- Create: `src/map/zoom.ts`, `src/map/dot-style.ts`, `src/map/cluster.ts`, `src/map/choose-mode.ts`, `src/map/hit-test.ts`, `src/map/map-view.ts`, `tests/map-helpers.test.ts`, `tests/cluster.test.ts`
- Modify: `package.json` (`supercluster`, `@types/supercluster`)

**Interfaces:**
- Consumes: `Place` (Task 3).
- Produces:
  - `altitudeToZoom(alt: number): number`, `zoomToAltitude(z: number): number`, `scaleToZoom(k: number): number`, `MAX_ZOOM = 12` (`zoom.ts`)
  - `dotStyle(pop: number, maxPop: number): { size: number; opacity: number }`, `hexToRgba(hex: string, alpha: number): string` (`dot-style.ts`)
  - `type MapItem = { type: 'place'; key: string; place: Place; lat: number; lon: number; count: number; pop: number } | { type: 'cluster'; key: string; lat: number; lon: number; count: number; pop: number; zoomTo: number }`; `interface Clusterer { items(zoom: number): MapItem[] }`; `createClusterer(places: Place[]): Clusterer` (`cluster.ts`)
  - `type ViewMode = 'globe' | 'map'`; `MODE_STORAGE_KEY = 'mapMode'`; `initialMode(o: { saved: string | null; hasWebGL: boolean; narrowTouch: boolean }): ViewMode`; `detectWebGL(doc?: Document): boolean`; `measureFps(durationMs: number, raf?: (cb: FrameRequestCallback) => number, now?: () => number): Promise<number>` (`choose-mode.ts`)
  - `hitTest<T>(points: { x: number; y: number; r: number; item: T }[], x: number, y: number, slop?: number): T | null` (`hit-test.ts`)
  - `map-view.ts`:
    ```ts
    export interface MapCallbacks { onSelect(place: Place): void; label(item: MapItem): string }
    export interface MapView { setPlaying(place: Place | null): void; flyTo(lat: number, lon: number): void; zoomBy(factor: number): void; destroy(): void }
    export type MapFactory = (el: HTMLElement, clusterer: Clusterer, cb: MapCallbacks) => Promise<MapView>;
    ```

- [ ] **Step 1: Зависимость** `npm i supercluster && npm i -D @types/supercluster`

- [ ] **Step 2: Тесты**

`tests/map-helpers.test.ts`:
```ts
import { expect, test } from 'vitest';
import { detectWebGL, initialMode, measureFps } from '../src/map/choose-mode';
import { dotStyle, hexToRgba } from '../src/map/dot-style';
import { hitTest } from '../src/map/hit-test';
import { altitudeToZoom, MAX_ZOOM, scaleToZoom, zoomToAltitude } from '../src/map/zoom';

test('zoom conversions', () => {
  expect(altitudeToZoom(2.5)).toBe(1);
  expect(altitudeToZoom(0.3125)).toBe(4);
  expect(altitudeToZoom(100)).toBe(0);
  expect(altitudeToZoom(0.000001)).toBe(MAX_ZOOM);
  expect(zoomToAltitude(altitudeToZoom(0.5))).toBeCloseTo(0.5);
  expect(scaleToZoom(1)).toBe(1);
  expect(scaleToZoom(8)).toBe(4);
});

test('dot style: 3–7 px, 45–100 % opacity, monotonic, safe for zero', () => {
  expect(dotStyle(0, 100)).toEqual({ size: 3, opacity: 0.45 });
  expect(dotStyle(100, 100)).toEqual({ size: 7, opacity: 1 });
  expect(dotStyle(10, 100).size).toBeGreaterThan(dotStyle(1, 100).size);
  expect(dotStyle(5, 0)).toEqual({ size: 3, opacity: 0.45 });
});

test('hexToRgba', () => expect(hexToRgba('#FFB547', 0.5)).toBe('rgba(255, 181, 71, 0.5)'));

test('hitTest picks the nearest point within its radius + slop', () => {
  const pts = [{ x: 10, y: 10, r: 3, item: 'a' }, { x: 16, y: 10, r: 3, item: 'b' }];
  expect(hitTest(pts, 15, 10)).toBe('b');
  expect(hitTest(pts, 11, 11)).toBe('a');
  expect(hitTest(pts, 100, 100)).toBeNull();
});

test('initial mode', () => {
  expect(initialMode({ saved: 'globe', hasWebGL: false, narrowTouch: false })).toBe('map');
  expect(initialMode({ saved: 'map', hasWebGL: true, narrowTouch: false })).toBe('map');
  expect(initialMode({ saved: 'globe', hasWebGL: true, narrowTouch: true })).toBe('globe');
  expect(initialMode({ saved: null, hasWebGL: true, narrowTouch: true })).toBe('map');
  expect(initialMode({ saved: 'junk', hasWebGL: true, narrowTouch: false })).toBe('globe');
});

test('detectWebGL handles missing context and exceptions', () => {
  const doc = (ctx: unknown) => ({ createElement: () => ({ getContext: () => ctx }) }) as unknown as Document;
  expect(detectWebGL(doc({}))).toBe(true);
  expect(detectWebGL(doc(null))).toBe(false);
  expect(detectWebGL({ createElement: () => { throw new Error('x'); } } as unknown as Document)).toBe(false);
});

test('measureFps averages frames over the window', async () => {
  let t = 0;
  const raf = (cb: FrameRequestCallback) => { t += 40; queueMicrotask(() => cb(t)); return 0; };
  await expect(measureFps(1000, raf, () => t)).resolves.toBe(25);
});
```

`tests/cluster.test.ts`:
```ts
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
```

- [ ] **Step 3: Run** `npx vitest run tests/map-helpers.test.ts tests/cluster.test.ts` → FAIL.

- [ ] **Step 4: Реализация**

`src/map/zoom.ts`:
```ts
export const MAX_ZOOM = 12;
const BASE_ALTITUDE = 2.5;
const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(0, z));

export const altitudeToZoom = (alt: number) => clamp(Math.log2(BASE_ALTITUDE / alt) + 1);
export const zoomToAltitude = (z: number) => BASE_ALTITUDE / 2 ** (z - 1);
export const scaleToZoom = (k: number) => clamp(Math.log2(k) + 1);
```

`src/map/dot-style.ts`:
```ts
export function dotStyle(pop: number, maxPop: number): { size: number; opacity: number } {
  const t = maxPop > 0 ? Math.min(1, Math.log1p(Math.max(0, pop)) / Math.log1p(maxPop)) : 0;
  return { size: Math.round((3 + 4 * t) * 10) / 10, opacity: Math.round((0.45 + 0.55 * t) * 100) / 100 };
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.trim().replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
```

`src/map/hit-test.ts`:
```ts
export function hitTest<T>(points: { x: number; y: number; r: number; item: T }[], x: number, y: number, slop = 6): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const p of points) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= p.r + slop && d < bestD) { best = p.item; bestD = d; }
  }
  return best;
}
```

`src/map/choose-mode.ts`:
```ts
export type ViewMode = 'globe' | 'map';
export const MODE_STORAGE_KEY = 'mapMode';

export function initialMode(o: { saved: string | null; hasWebGL: boolean; narrowTouch: boolean }): ViewMode {
  if (!o.hasWebGL) return 'map';
  if (o.saved === 'globe' || o.saved === 'map') return o.saved;
  return o.narrowTouch ? 'map' : 'globe';
}

export function detectWebGL(doc: Document = document): boolean {
  try {
    const c = doc.createElement('canvas') as HTMLCanvasElement;
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function measureFps(
  durationMs: number,
  raf: (cb: FrameRequestCallback) => number = requestAnimationFrame,
  now: () => number = () => performance.now(),
): Promise<number> {
  return new Promise((resolve) => {
    const start = now();
    let frames = 0;
    const tick = () => {
      frames++;
      const elapsed = now() - start;
      if (elapsed >= durationMs) resolve((frames * 1000) / elapsed);
      else raf(tick);
    };
    raf(tick);
  });
}
```

`src/map/cluster.ts`:
```ts
import Supercluster from 'supercluster';
import type { Place } from '../data/places';
import { MAX_ZOOM } from './zoom';

export type MapItem =
  | { type: 'place'; key: string; place: Place; lat: number; lon: number; count: number; pop: number }
  | { type: 'cluster'; key: string; lat: number; lon: number; count: number; pop: number; zoomTo: number };
export interface Clusterer { items(zoom: number): MapItem[] }

interface Props { i: number; count: number; pop: number }
interface Reduced { count: number; pop: number }

export function createClusterer(places: Place[]): Clusterer {
  const index = new Supercluster<Props, Reduced>({
    radius: 40,
    maxZoom: MAX_ZOOM - 1,
    map: (p) => ({ count: p.count, pop: p.pop }),
    reduce: (acc, p) => { acc.count += p.count; acc.pop += p.pop; },
  });
  index.load(places.map((p, i) => ({
    type: 'Feature' as const,
    properties: { i, count: p.count, pop: p.pop },
    geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
  })));

  return {
    items(zoom) {
      return index.getClusters([-180, -85, 180, 85], Math.floor(zoom)).map((f): MapItem => {
        const [lon, lat] = f.geometry.coordinates;
        const props = f.properties as Partial<Props> & Reduced & { cluster?: boolean; cluster_id?: number };
        if (props.cluster) {
          const id = props.cluster_id!;
          return { type: 'cluster', key: `cl:${id}`, lat, lon, count: props.count, pop: props.pop, zoomTo: index.getClusterExpansionZoom(id) };
        }
        const place = places[props.i!];
        return { type: 'place', key: place.id, place, lat: place.lat, lon: place.lon, count: place.count, pop: place.pop };
      });
    },
  };
}
```

`src/map/map-view.ts`:
```ts
import type { Place } from '../data/places';
import type { Clusterer, MapItem } from './cluster';

export interface MapCallbacks { onSelect(place: Place): void; label(item: MapItem): string }
export interface MapView {
  setPlaying(place: Place | null): void;
  flyTo(lat: number, lon: number): void;
  zoomBy(factor: number): void;
  destroy(): void;
}
export type MapFactory = (el: HTMLElement, clusterer: Clusterer, cb: MapCallbacks) => Promise<MapView>;
```

- [ ] **Step 5: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(map): clustering, zoom/dot-style helpers, mode selection, MapView interface"
```

---

### Task 8: Интерфейс — оболочка, список станций, панель плеера, уведомления

**Files:**
- Modify: `locales/ru.json`, `src/ui/tokens.css`, `src/ui/icons.ts`, `src/ui/shell.ts` (переписать), `src/ui/shell.css` (дописать), `tests/shell.test.ts`
- Create: `src/ui/station-list.ts`, `src/ui/player-bar.ts`, `src/ui/toast.ts`, `tests/station-list.test.ts`, `tests/player-bar.test.ts`, `tests/toast.test.ts`

**Interfaces:**
- Consumes: `I18n` (План 1), `escapeHtml` (План 1), `StationLite` (Task 3), `PlayerState` (Task 6).
- Produces:
  - ```ts
    export interface ShellRefs {
      header: HTMLElement; left: HTMLElement; panelBody: HTMLElement; closePanel: HTMLButtonElement;
      stage: HTMLElement; stars: HTMLElement; map: HTMLElement; status: HTMLElement;
      zoomIn: HTMLButtonElement; zoomOut: HTMLButtonElement; viewButtons: HTMLButtonElement[];
      placeCard: HTMLElement; player: HTMLElement;
    }
    export function renderShell(root: HTMLElement, i18n: I18n): ShellRefs
    ```
  - `interface StationListProps { title: string; subtitle: string; stations: StationLite[]; playingId: string | null; onPick(s: StationLite): void }`; `renderStationList(el: HTMLElement, i18n: I18n, p: StationListProps): void`; `renderListMessage(el: HTMLElement, text: string, action?: { label: string; onClick(): void }): void`
  - `interface PlayerBarHandlers { onToggle(): void; onNext(): void; onVolume(v: number): void; onMute(): void }`; `interface PlayerBarView { state: PlayerState; place: string; volume: number; muted: boolean }`; `createPlayerBar(el: HTMLElement, i18n: I18n, h: PlayerBarHandlers): { render(v: PlayerBarView): void }`
  - `showToast(host: HTMLElement, text: string, ms?: number): HTMLElement`
  - Новые ключи `locales/ru.json` (ниже), токены `--globe-glow`, `--map-land`.

- [ ] **Step 1: Тексты и токены**

В `locales/ru.json` заменить `footer.attribution` и добавить ключи:
```json
  "footer.attribution": "Данные о станциях — Radio Browser · Тексты — Википедия (CC BY-SA) · Географические данные — GeoNames (CC BY 4.0) · Мы не храним и не ретранслируем эфир, станции вещают со своих серверов",
  "panel.close": "Закрыть список",
  "list.subtitle": "{country} · {stations} · по популярности",
  "list.subtitleApprox": "Примерное расположение · {stations} · по популярности",
  "list.loadError": "Не удалось загрузить станции этого места",
  "common.retry": "Повторить",
  "common.soon": "Появится скоро",
  "station.favorite": "В избранное",
  "map.tooltip": "{place} · {stations}",
  "map.fallback": "Включена плоская карта: 3D не поддерживается на этом устройстве",
  "player.connecting": "Подключаемся…",
  "player.live": "В эфире · {place}",
  "player.paused": "Пауза · {place}",
  "player.error": "Станция не отвечает",
  "player.play": "Слушать",
  "player.pause": "Пауза",
  "player.next": "Следующая рядом",
  "player.tryNext": "Попробовать следующую рядом",
  "player.noNext": "Рядом больше нет рабочих станций",
  "player.sleep": "Сон",
  "player.share": "Поделиться",
  "player.volume": "Громкость",
  "player.mute": "Выключить звук",
  "player.unmute": "Включить звук",
  "player.placeCountry": "{place}, {country}"
```

В `src/ui/tokens.css` (в блок `:root`, рядом с токенами глобуса):
```css
  --globe-glow: #5A82FF;
  --map-land: #131B3A;
```

В `src/ui/icons.ts` дописать в объект `icons`:
```ts
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  play: svg('<path d="M8 5v14l11-7z" fill="currentColor"/>', 22),
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>', 22),
  skipForward: svg('<path d="M5 4l10 8-10 8z"/><path d="M19 5v14"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  volume: svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
  volumeOff: svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>'),
  star: svg('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>'),
```

- [ ] **Step 2: Тесты**

В `tests/shell.test.ts` дописать:
```ts
test('exposes map, stars, panel body, zoom and view buttons', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.map.classList.contains('stage__map')).toBe(true);
  expect(refs.stars.classList.contains('stage__stars')).toBe(true);
  expect(refs.panelBody.textContent).toContain('Выберите точку на глобусе');
  expect(refs.zoomIn.getAttribute('aria-label')).toBe('Приблизить');
  expect(refs.zoomOut.getAttribute('aria-label')).toBe('Отдалить');
  expect(refs.viewButtons.map((b) => b.dataset.view)).toEqual(['globe', 'map']);
  expect(refs.closePanel.getAttribute('aria-label')).toBe('Закрыть список');
  expect(refs.stage.textContent).toContain('GeoNames');
});
```

`tests/station-list.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import type { StationLite } from '../src/data/shards';
import { createI18n } from '../src/i18n/i18n';
import { renderListMessage, renderStationList } from '../src/ui/station-list';

const i18n = createI18n('ru', ru);
const st = (id: string, name: string, tags: string[] = []): StationLite =>
  ({ id, name, url: 'https://x', placeId: 'p', cc: 'PT', langs: [], tags, votes: 0, clicks: 0, favicon: '', hls: false });
let el: HTMLElement;
beforeEach(() => { document.body.innerHTML = '<div></div>'; el = document.body.firstElementChild as HTMLElement; });

test('renders title, subtitle, names, tags and letter tiles', () => {
  renderStationList(el, i18n, { title: 'Лиссабон', subtitle: 'Португалия · 2 станции · по популярности', stations: [st('a', 'fado Lisboa', ['fado', 'jazz', 'pop', 'rock']), st('b', 'Antena 1')], playingId: null, onPick() {} });
  expect(el.querySelector('.list-title')!.textContent).toBe('Лиссабон');
  expect(el.querySelector('.list-sub')!.textContent).toContain('2 станции');
  const rows = el.querySelectorAll('.station');
  expect(rows).toHaveLength(2);
  expect(rows[0].querySelector('.station__tags')!.textContent).toBe('fado · jazz · pop');
  expect(rows[0].querySelector('.station__tile')!.textContent).toBe('F');
});

test('station data is never parsed as HTML', () => {
  renderStationList(el, i18n, { title: '<i>t</i>', subtitle: '', stations: [st('a', '<img src=x onerror=alert(1)>')], playingId: null, onPick() {} });
  expect(el.querySelector('img')).toBeNull();
  expect(el.querySelector('i')).toBeNull();
  expect(el.querySelector('.station__name')!.textContent).toBe('<img src=x onerror=alert(1)>');
});

test('marks the playing station and reports picks', () => {
  const onPick = vi.fn();
  renderStationList(el, i18n, { title: 'X', subtitle: '', stations: [st('a', 'A'), st('b', 'B')], playingId: 'b', onPick });
  const rows = el.querySelectorAll('.station');
  expect(rows[1].classList.contains('is-playing')).toBe(true);
  expect(rows[1].querySelector('.station__pick')!.getAttribute('aria-current')).toBe('true');
  (rows[0].querySelector('.station__pick') as HTMLButtonElement).click();
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
});

test('favorite star is visible but disabled until Plan 5', () => {
  renderStationList(el, i18n, { title: 'X', subtitle: '', stations: [st('a', 'A')], playingId: null, onPick() {} });
  const star = el.querySelector('.station__star') as HTMLButtonElement;
  expect(star.disabled).toBe(true);
  expect(star.getAttribute('aria-label')).toBe('В избранное');
});

test('message with an action button', () => {
  const onClick = vi.fn();
  renderListMessage(el, 'Не удалось', { label: 'Повторить', onClick });
  expect(el.textContent).toContain('Не удалось');
  (el.querySelector('button') as HTMLButtonElement).click();
  expect(onClick).toHaveBeenCalled();
});
```

`tests/player-bar.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import type { StationLite } from '../src/data/shards';
import { createI18n } from '../src/i18n/i18n';
import { createPlayerBar } from '../src/ui/player-bar';

const i18n = createI18n('ru', ru);
const station: StationLite = { id: 'a', name: 'Fado <b>Lisboa</b>', url: 'https://x', placeId: 'p', cc: 'PT', langs: [], tags: [], votes: 0, clicks: 0, favicon: '', hls: false };
const h = { onToggle: vi.fn(), onNext: vi.fn(), onVolume: vi.fn(), onMute: vi.fn() };
let el: HTMLElement;
beforeEach(() => { document.body.innerHTML = '<footer></footer>'; el = document.querySelector('footer')!; vi.clearAllMocks(); });
const q = (s: string) => el.querySelector(s) as HTMLElement;

test('idle: placeholder text, controls disabled', () => {
  createPlayerBar(el, i18n, h).render({ state: { kind: 'idle' }, place: '', volume: 0.8, muted: false });
  expect(q('.pb__name').textContent).toBe('Ничего не играет');
  expect((q('.pb__play') as HTMLButtonElement).disabled).toBe(true);
  expect((q('.pb__next') as HTMLButtonElement).disabled).toBe(true);
  expect((q('.pb__range') as HTMLInputElement).value).toBe('80');
});

test('playing: live line with place, pause label, name as text', () => {
  createPlayerBar(el, i18n, h).render({ state: { kind: 'playing', station }, place: 'Лиссабон, Португалия', volume: 1, muted: false });
  expect(q('.pb__name').textContent).toBe('Fado <b>Lisboa</b>');
  expect(el.querySelector('b')).toBeNull();
  expect(q('.pb__status').textContent).toBe('В эфире · Лиссабон, Португалия');
  expect(q('.pb__live').hidden).toBe(false);
  expect(q('.pb__play').getAttribute('aria-label')).toBe('Пауза');
  expect(q('.pb__next').textContent).toBe('Следующая рядом');
});

test('error: message and "try next nearby" button', () => {
  createPlayerBar(el, i18n, h).render({ state: { kind: 'error', station }, place: 'X', volume: 1, muted: false });
  expect(q('.pb__status').textContent).toBe('Станция не отвечает');
  expect(q('.pb__live').hidden).toBe(true);
  expect(q('.pb__next').textContent).toBe('Попробовать следующую рядом');
  expect(q('.pb__play').getAttribute('aria-label')).toBe('Слушать');
});

test('controls call handlers', () => {
  createPlayerBar(el, i18n, h).render({ state: { kind: 'paused', station }, place: 'X', volume: 1, muted: true });
  (q('.pb__play') as HTMLButtonElement).click();
  (q('.pb__next') as HTMLButtonElement).click();
  (q('.pb__mute') as HTMLButtonElement).click();
  const range = q('.pb__range') as HTMLInputElement;
  range.value = '40';
  range.dispatchEvent(new Event('input'));
  expect(h.onToggle).toHaveBeenCalled();
  expect(h.onNext).toHaveBeenCalled();
  expect(h.onMute).toHaveBeenCalled();
  expect(h.onVolume).toHaveBeenCalledWith(0.4);
  expect(q('.pb__mute').getAttribute('aria-label')).toBe('Включить звук');
});

test('sleep and share are visible but disabled until Plan 5', () => {
  createPlayerBar(el, i18n, h).render({ state: { kind: 'idle' }, place: '', volume: 1, muted: false });
  expect((q('.pb__sleep') as HTMLButtonElement).disabled).toBe(true);
  expect((q('.pb__share') as HTMLButtonElement).disabled).toBe(true);
});
```

`tests/toast.test.ts`:
```ts
import { expect, test, vi } from 'vitest';
import { showToast } from '../src/ui/toast';

test('toast shows text as status and disappears', () => {
  vi.useFakeTimers();
  const host = document.createElement('div');
  const t = showToast(host, '<b>x</b>', 1000);
  expect(t.getAttribute('role')).toBe('status');
  expect(t.textContent).toBe('<b>x</b>');
  expect(host.contains(t)).toBe(true);
  vi.advanceTimersByTime(1000);
  expect(host.contains(t)).toBe(false);
  vi.useRealTimers();
});
```

- [ ] **Step 3: Run** `npx vitest run` → новые тесты FAIL (нет модулей / новых ссылок оболочки).

- [ ] **Step 4: Реализация**

`src/ui/shell.ts` (целиком):
```ts
import type { I18n } from '../i18n/i18n';
import { escapeHtml } from './html';
import { icons } from './icons';
import './tokens.css';
import './shell.css';

export interface ShellRefs {
  header: HTMLElement; left: HTMLElement; panelBody: HTMLElement; closePanel: HTMLButtonElement;
  stage: HTMLElement; stars: HTMLElement; map: HTMLElement; status: HTMLElement;
  zoomIn: HTMLButtonElement; zoomOut: HTMLButtonElement; viewButtons: HTMLButtonElement[];
  placeCard: HTMLElement; player: HTMLElement;
}

export function renderShell(root: HTMLElement, i18n: I18n): ShellRefs {
  const t = (key: string) => escapeHtml(i18n.t(key));
  document.title = i18n.t('app.name');
  root.className = 'shell';
  root.innerHTML = `
    <header class="shell__header">
      <div class="logo">${icons.logo}<span class="logo__text">${t('app.name')}</span></div>
      <label class="search">${icons.search}
        <input type="search" placeholder="${t('header.search.placeholder')}" aria-label="${t('header.search.placeholder')}">
      </label>
      <button class="btn btn--accent" data-action="surprise" aria-label="${t('header.surprise')}">${icons.shuffle}<span>${t('header.surprise')}</span></button>
      <div class="spacer"></div>
      <button class="btn btn--outline" data-action="learn" aria-label="${t('header.learn')}">${icons.message}<span>${t('header.learn')}</span></button>
      <div class="segment" role="group" aria-label="${t('header.view.label')}">
        <button aria-pressed="true" data-view="globe">${t('header.view.globe')}</button>
        <button aria-pressed="false" data-view="map">${t('header.view.map')}</button>
      </div>
      <button class="btn btn--outline btn--icon" data-action="install" aria-label="${t('header.install')}">${icons.download}</button>
    </header>
    <div class="shell__body">
      <aside class="shell__left">
        <div class="panel-top">
          <nav class="tabs">
            <button class="tabs__tab is-active">${t('panel.tabs.here')}</button>
            <button class="tabs__tab">${t('panel.tabs.favorites')}</button>
            <button class="tabs__tab">${t('panel.tabs.history')}</button>
          </nav>
          <button class="btn--ghost panel-close" aria-label="${t('panel.close')}">${icons.x}</button>
        </div>
        <div class="panel-body"><p class="panel-empty">${t('panel.empty')}</p></div>
      </aside>
      <main class="shell__stage">
        <div class="stage__stars" aria-hidden="true"></div>
        <div class="stage__map"></div>
        <p class="stage__status" role="status"></p>
        <div class="stage__zoom">
          <button data-zoom="in" aria-label="${t('map.zoomIn')}">+</button>
          <button data-zoom="out" aria-label="${t('map.zoomOut')}">−</button>
        </div>
        <p class="stage__attribution">${t('footer.attribution')}</p>
      </main>
      <aside class="shell__place">
        <div class="place__head">
          <span class="section-label">${t('place.title')}</span>
          <button class="btn--ghost" aria-label="${t('place.collapse')}">${icons.chevronRight}</button>
        </div>
      </aside>
    </div>
    <footer class="shell__player"></footer>
  `;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  return {
    header: q('.shell__header'),
    left: q('.shell__left'),
    panelBody: q('.panel-body'),
    closePanel: q<HTMLButtonElement>('.panel-close'),
    stage: q('.shell__stage'),
    stars: q('.stage__stars'),
    map: q('.stage__map'),
    status: q('.stage__status'),
    zoomIn: q<HTMLButtonElement>('[data-zoom="in"]'),
    zoomOut: q<HTMLButtonElement>('[data-zoom="out"]'),
    viewButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-view]')],
    placeCard: q('.shell__place'),
    player: q('.shell__player'),
  };
}
```

`src/ui/station-list.ts`:
```ts
import type { StationLite } from '../data/shards';
import type { I18n } from '../i18n/i18n';
import { icons } from './icons';

export interface StationListProps {
  title: string; subtitle: string; stations: StationLite[]; playingId: string | null; onPick(s: StationLite): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function tile(s: StationLite): HTMLElement {
  const box = el('div', 'station__tile', (s.name.trim()[0] ?? '?').toUpperCase());
  if (s.favicon) {
    const img = new Image();
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => box.classList.add('has-img');
    img.onerror = () => img.remove();
    img.src = s.favicon;
    box.append(img);
  }
  return box;
}

export function renderStationList(host: HTMLElement, i18n: I18n, p: StationListProps): void {
  const head = el('div', 'list-head');
  head.append(el('h2', 'list-title', p.title), el('p', 'list-sub', p.subtitle));
  const list = el('ul', 'stations');
  for (const s of p.stations) {
    const playing = s.id === p.playingId;
    const row = el('li', playing ? 'station is-playing' : 'station');
    const pick = el('button', 'station__pick');
    pick.type = 'button';
    if (playing) pick.setAttribute('aria-current', 'true');
    const text = el('span', 'station__text');
    text.append(el('span', 'station__name', s.name), el('span', 'station__tags', s.tags.slice(0, 3).join(' · ')));
    pick.append(tile(s), text);
    pick.addEventListener('click', () => p.onPick(s));
    const star = el('button', 'station__star');
    star.type = 'button';
    star.disabled = true;
    star.setAttribute('aria-label', i18n.t('station.favorite'));
    star.title = i18n.t('common.soon');
    star.innerHTML = icons.star;
    row.append(pick, star);
    list.append(row);
  }
  host.replaceChildren(head, list);
}

export function renderListMessage(host: HTMLElement, text: string, action?: { label: string; onClick(): void }): void {
  const msg = el('p', 'panel-empty', text);
  if (!action) { host.replaceChildren(msg); return; }
  const btn = el('button', 'btn btn--outline panel-action', action.label);
  btn.type = 'button';
  btn.addEventListener('click', action.onClick);
  host.replaceChildren(msg, btn);
}
```

`src/ui/player-bar.ts`:
```ts
import type { I18n } from '../i18n/i18n';
import type { PlayerState } from '../player/player';
import { escapeHtml } from './html';
import { icons } from './icons';

export interface PlayerBarHandlers { onToggle(): void; onNext(): void; onVolume(v: number): void; onMute(): void }
export interface PlayerBarView { state: PlayerState; place: string; volume: number; muted: boolean }

export function createPlayerBar(host: HTMLElement, i18n: I18n, h: PlayerBarHandlers): { render(v: PlayerBarView): void } {
  const t = (k: string) => escapeHtml(i18n.t(k));
  host.innerHTML = `
    <div class="pb__now">
      <div class="pb__tile"></div>
      <div class="pb__text">
        <div class="pb__name"></div>
        <div class="pb__meta"><span class="pb__live"></span><span class="pb__status"></span></div>
      </div>
      <button class="pb__star" disabled aria-label="${t('station.favorite')}" title="${t('common.soon')}">${icons.star}</button>
    </div>
    <div class="pb__center">
      <button class="pb__play"></button>
      <button class="btn btn--outline pb__next">${icons.skipForward}<span></span></button>
    </div>
    <div class="pb__right">
      <button class="btn btn--outline pb__sleep" disabled title="${t('common.soon')}">${icons.moon}<span>${t('player.sleep')}</span></button>
      <button class="btn btn--outline btn--icon pb__share" disabled aria-label="${t('player.share')}" title="${t('common.soon')}">${icons.share}</button>
      <div class="pb__volume">
        <button class="pb__mute"></button>
        <input class="pb__range" type="range" min="0" max="100" step="1" aria-label="${t('player.volume')}">
      </div>
    </div>`;
  const q = <T extends HTMLElement>(s: string) => host.querySelector<T>(s)!;
  const tileEl = q<HTMLDivElement>('.pb__tile');
  const name = q<HTMLDivElement>('.pb__name');
  const live = q<HTMLSpanElement>('.pb__live');
  const status = q<HTMLSpanElement>('.pb__status');
  const play = q<HTMLButtonElement>('.pb__play');
  const next = q<HTMLButtonElement>('.pb__next');
  const nextLabel = next.querySelector('span')!;
  const mute = q<HTMLButtonElement>('.pb__mute');
  const range = q<HTMLInputElement>('.pb__range');

  play.addEventListener('click', h.onToggle);
  next.addEventListener('click', h.onNext);
  mute.addEventListener('click', h.onMute);
  range.addEventListener('input', () => h.onVolume(Number(range.value) / 100));

  return {
    render({ state, place, volume, muted }) {
      const station = state.kind === 'idle' ? null : state.station;
      name.textContent = station ? station.name : i18n.t('player.idle');
      tileEl.textContent = station ? (station.name.trim()[0] ?? '?').toUpperCase() : '';
      const statusText: Record<PlayerState['kind'], string> = {
        idle: '',
        loading: i18n.t('player.connecting'),
        playing: i18n.t('player.live', { place }),
        paused: i18n.t('player.paused', { place }),
        error: i18n.t('player.error'),
      };
      status.textContent = statusText[state.kind];
      live.hidden = state.kind !== 'playing';
      host.classList.toggle('is-error', state.kind === 'error');
      const active = state.kind === 'loading' || state.kind === 'playing';
      play.disabled = !station;
      play.setAttribute('aria-label', i18n.t(active ? 'player.pause' : 'player.play'));
      play.innerHTML = active ? icons.pause : icons.play;
      next.disabled = !station;
      nextLabel.textContent = i18n.t(state.kind === 'error' ? 'player.tryNext' : 'player.next');
      mute.setAttribute('aria-label', i18n.t(muted ? 'player.unmute' : 'player.mute'));
      mute.innerHTML = muted ? icons.volumeOff : icons.volume;
      range.value = String(Math.round((muted ? 0 : volume) * 100));
    },
  };
}
```

> Примечание к тесту `controls call handlers`: значение ползунка после `render(muted: true)` — `0`; тест сам ставит `40` и проверяет `onVolume(0.4)`.

`src/ui/toast.ts`:
```ts
export function showToast(host: HTMLElement, text: string, ms = 5000): HTMLElement {
  const box = document.createElement('div');
  box.className = 'toast';
  box.setAttribute('role', 'status');
  box.textContent = text;
  host.append(box);
  setTimeout(() => box.remove(), ms);
  return box;
}
```

Дописать в `src/ui/shell.css` (размеры — по `docs/03_design.md` §3, §6.1 и `Main.dc.html`), удалив старое правило `.player__idle`:
```css
.panel-top { display: flex; align-items: center; gap: 4px; padding: 16px 16px 8px; }
.panel-top .tabs { flex: 1; padding: 0; }
.panel-close { display: none; }
.panel-body { flex: 1; min-block-size: 0; overflow-y: auto; }
.panel-action { margin-inline: var(--pad-panel); }
.list-head { padding: 10px var(--pad-panel) 12px; }
.list-title { margin: 0; font-family: var(--font-display); font-size: 20px; font-weight: 500; }
.list-sub { margin: 4px 0 0; font-size: 14px; color: var(--text-muted); }
.stations { list-style: none; margin: 0; padding: 0 10px 10px; display: flex; flex-direction: column; gap: 2px; }
.station { display: flex; align-items: center; border-radius: var(--r-item); }
.station.is-playing { background: var(--item-selected); }
.station__pick { flex: 1; min-inline-size: 0; display: flex; align-items: center; gap: 12px; padding: 10px; border: 0; background: transparent; color: var(--text); text-align: start; border-radius: var(--r-item); }
.station__pick:hover { background: var(--item-selected); }
.station__tile { position: relative; inline-size: 40px; block-size: 40px; flex-shrink: 0; border-radius: var(--r-letter); background: var(--tile); display: flex; align-items: center; justify-content: center; overflow: hidden; font-family: var(--font-display); font-weight: 700; font-size: 16px; color: var(--star); }
.station.is-playing .station__tile { color: var(--accent); }
.station__tile img { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; object-fit: cover; opacity: 0; }
.station__tile.has-img img { opacity: 1; }
.station__text { min-inline-size: 0; display: flex; flex-direction: column; }
.station__name { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.station__tags { font-size: 13px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.station__star, .pb__star { inline-size: 36px; block-size: 36px; flex-shrink: 0; border: 0; background: transparent; color: var(--star-off); display: flex; align-items: center; justify-content: center; }
button:disabled { cursor: default; opacity: .55; }

.stage__stars, .stage__map { position: absolute; inset: 0; }
.stage__status { z-index: 2; }
.stage__zoom, .stage__attribution { z-index: 2; }

.shell__player { gap: 24px; justify-content: space-between; }
.pb__now { display: flex; align-items: center; gap: 14px; min-inline-size: 0; flex: 1; }
.pb__tile { inline-size: 56px; block-size: 56px; flex-shrink: 0; border-radius: var(--r-card); background: var(--tile); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 700; font-size: 22px; color: var(--accent); }
.pb__text { min-inline-size: 0; }
.pb__name { font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pb__meta { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-muted); margin-block-start: 4px; }
.pb__live { inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--live); }
.shell__player.is-error .pb__status { color: var(--live); }
.pb__center { display: flex; align-items: center; gap: 14px; }
.pb__play { inline-size: 56px; block-size: 56px; border-radius: 50%; border: 0; background: var(--accent); color: var(--on-accent); display: flex; align-items: center; justify-content: center; }
.pb__next, .pb__sleep { block-size: 44px; }
.pb__right { display: flex; align-items: center; gap: 10px; flex: 1; justify-content: flex-end; }
.pb__share { inline-size: 44px; block-size: 44px; }
.pb__volume { display: flex; align-items: center; gap: 8px; }
.pb__mute { inline-size: 36px; block-size: 36px; border: 0; background: transparent; color: var(--text); display: flex; align-items: center; justify-content: center; }
.pb__range { inline-size: 120px; accent-color: var(--accent); }

.toast { position: absolute; z-index: 5; inset-block-start: 16px; inset-inline: 0; margin-inline: auto; inline-size: fit-content; max-inline-size: calc(100% - 32px); padding: 10px 14px; border-radius: var(--r-card); background: var(--surface-raised); border: 1px solid var(--border-popover); font-size: 14px; }

@media (max-width: 1100px) {
  .pb__right .pb__sleep, .pb__right .pb__share { display: none; }
}
@media (max-width: 760px) {
  .shell__left { display: flex; position: fixed; z-index: 10; inset-inline: 0; inset-block-end: 0; max-block-size: 60vh; border-radius: 22px 22px 0 0; border: 1px solid var(--border-card); background: var(--surface-raised); transform: translateY(100%); transition: transform .25s ease-out; inline-size: auto; }
  .shell__left.is-open { transform: none; }
  .panel-close { display: inline-flex; }
  .shell__player { block-size: 68px; padding-inline: 12px; gap: 10px; }
  .pb__tile { inline-size: 40px; block-size: 40px; font-size: 16px; }
  .pb__next span, .pb__right, .pb__star { display: none; }
  .pb__play { inline-size: 48px; block-size: 48px; }
  .pb__next { inline-size: 44px; padding: 0; justify-content: center; }
}
```
(Правило `.shell__left { display: none }` внутри старого `@media (max-width: 760px)` из Плана 1 удалить — теперь левая панель на телефоне становится выдвижной шторкой.)

- [ ] **Step 5: Run** `npx vitest run && npx tsc --noEmit` → PASS (в т. ч. `no-hardcoded-strings`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): station list, player bar, toast, shell regions for map and panel"
```

---

### Task 9: Глобус 3D (globe.gl)

**Files:**
- Create: `src/map/pulse.ts`, `src/map/starfield.ts`, `src/map/map.css`, `src/map/globe3d.ts`, `public/textures/earth-night.jpg`, `tests/map-dom.test.ts`
- Modify: `package.json` (`globe.gl`)

**Interfaces:**
- Consumes: `Clusterer`, `MapItem` (Task 7), `MapFactory`, `MapCallbacks` (Task 7), `dotStyle`, `hexToRgba`, `altitudeToZoom`, `zoomToAltitude` (Task 7), `escapeHtml` (План 1), `Place` (Task 3).
- Produces: `createPulse(): HTMLElement`, `renderStarfield(host: HTMLElement, count?: number, seed?: number): void`, `createGlobe3D: MapFactory`.

- [ ] **Step 1: Зависимость и текстура**

```bash
npm i globe.gl
mkdir -p public/textures
curl -fsSL https://unpkg.com/three-globe/example/img/earth-night.jpg -o public/textures/earth-night.jpg
```
Expected: файл 300 КБ – 2 МБ. Это NASA Black Marble (общественное достояние) из примеров three-globe — указать в README (Task 12).

- [ ] **Step 2: Тест DOM-помощников**

`tests/map-dom.test.ts`:
```ts
import { expect, test } from 'vitest';
import { createPulse } from '../src/map/pulse';
import { renderStarfield } from '../src/map/starfield';

test('pulse has a ring and a dot', () => {
  const p = createPulse();
  expect(p.className).toBe('pulse');
  expect(p.querySelector('.pulse__ring')).not.toBeNull();
  expect(p.querySelector('.pulse__dot')).not.toBeNull();
});

test('starfield is deterministic, 1–2 px, 25–75 % opacity', () => {
  const a = document.createElement('div');
  const b = document.createElement('div');
  renderStarfield(a, 50, 11);
  renderStarfield(b, 50, 11);
  expect(a.children).toHaveLength(50);
  expect(a.innerHTML).toBe(b.innerHTML);
  for (const s of a.children) {
    const el = s as HTMLElement;
    expect(['1px', '2px']).toContain(el.style.width);
    expect(Number(el.style.opacity)).toBeGreaterThanOrEqual(0.25);
    expect(Number(el.style.opacity)).toBeLessThanOrEqual(0.75);
  }
});
```

- [ ] **Step 3: Run** → FAIL.

- [ ] **Step 4: Реализация**

`src/map/pulse.ts`:
```ts
export function createPulse(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'pulse';
  box.innerHTML = '<span class="pulse__ring"></span><span class="pulse__dot"></span>';
  return box;
}
```

`src/map/starfield.ts`:
```ts
export function renderStarfield(host: HTMLElement, count = 140, seed = 11): void {
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const stars: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = rand() < 0.7 ? 1 : 2;
    star.style.left = `${(rand() * 100).toFixed(2)}%`;
    star.style.top = `${(rand() * 100).toFixed(2)}%`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.opacity = (0.25 + rand() * 0.5).toFixed(2);
    stars.push(star);
  }
  host.replaceChildren(...stars);
}
```

`src/map/map.css`:
```css
.star { position: absolute; border-radius: 50%; background: var(--star); }
.stage__map { z-index: 1; }
.stage__map > div, .stage__map canvas { outline: none; }
.map-tooltip { padding: 8px 12px; border-radius: 10px; background: rgba(13, 19, 38, .92); border: 1px solid var(--border-popover); color: var(--text); font: 13px var(--font-body); white-space: nowrap; pointer-events: none; }
.scene-tooltip { background: none !important; padding: 0 !important; }
.map-tooltip--floating { position: absolute; z-index: 3; transform: translate(-50%, calc(-100% - 12px)); }
.pulse { position: absolute; inline-size: 14px; block-size: 14px; margin: -7px 0 0 -7px; pointer-events: none; z-index: 2; }
.pulse__ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--accent); animation: rp-pulse 1.8s ease-out infinite; }
.pulse__dot { position: absolute; inset: 2px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 16px var(--accent); }
@keyframes rp-pulse { 0% { transform: scale(1); opacity: .9; } 100% { transform: scale(3.2); opacity: 0; } }
.map2d { display: block; border-radius: 16px; border: 1px solid var(--border-card); cursor: grab; touch-action: none; }
.stage__map--map { inset: 20px; }
```

`src/map/globe3d.ts`:
```ts
import Globe from 'globe.gl';
import type { Place } from '../data/places';
import { escapeHtml } from '../ui/html';
import type { MapItem } from './cluster';
import { dotStyle, hexToRgba } from './dot-style';
import './map.css';
import type { MapFactory } from './map-view';
import { createPulse } from './pulse';
import { altitudeToZoom, zoomToAltitude } from './zoom';

const INITIAL_ALTITUDE = 2.2;
// Angular size of one screen pixel per unit of camera altitude (tuned so dots stay 3–7 px).
const DEG_PER_PX_PER_ALT = 0.12;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const createGlobe3D: MapFactory = async (el, clusterer, cb) => {
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim();
  const glow = css.getPropertyValue('--globe-glow').trim();
  const pulse = createPulse();
  const globe = new Globe(el, { animateIn: false });
  let maxPop = 1;
  let lastZoom = -1;
  let lastAlt = INITIAL_ALTITUDE;

  const altitude = () => globe.pointOfView().altitude;
  const radiusOf = (o: object) => (dotStyle((o as MapItem).pop, maxPop).size / 2) * DEG_PER_PX_PER_ALT * altitude();

  function refresh(force = false) {
    const alt = altitude();
    const zoom = Math.floor(altitudeToZoom(alt));
    if (force || zoom !== lastZoom) {
      lastZoom = zoom;
      lastAlt = alt;
      const items = clusterer.items(zoom);
      maxPop = Math.max(1, ...items.map((i) => i.pop));
      globe.pointRadius(radiusOf).pointsData(items);
    } else if (Math.abs(alt - lastAlt) / lastAlt > 0.15) {
      lastAlt = alt;
      globe.pointRadius((o: object) => radiusOf(o));
    }
  }

  globe
    .width(el.clientWidth)
    .height(el.clientHeight)
    .backgroundColor('rgba(0,0,0,0)')
    .globeImageUrl(`${import.meta.env.BASE_URL}textures/earth-night.jpg`)
    .showAtmosphere(true)
    .atmosphereColor(glow)
    .atmosphereAltitude(0.16)
    .pointLat('lat')
    .pointLng('lon')
    .pointAltitude(0.003)
    .pointResolution(8)
    .pointColor((o: object) => hexToRgba(accent, dotStyle((o as MapItem).pop, maxPop).opacity))
    .pointLabel((o: object) => `<div class="map-tooltip">${escapeHtml(cb.label(o as MapItem))}</div>`)
    .onPointClick((o: object) => {
      const item = o as MapItem;
      if (item.type === 'cluster') {
        globe.pointOfView({ lat: item.lat, lng: item.lon, altitude: zoomToAltitude(item.zoomTo) }, reducedMotion() ? 0 : 1000);
      } else {
        cb.onSelect(item.place);
      }
    })
    .htmlElementsData([])
    .htmlLat('lat')
    .htmlLng('lon')
    .htmlAltitude(0.004)
    .htmlElement(() => pulse)
    .onZoom(() => refresh());
  globe.pointOfView({ lat: 30, lng: 10, altitude: INITIAL_ALTITUDE });
  refresh(true);

  const ro = new ResizeObserver(() => globe.width(el.clientWidth).height(el.clientHeight));
  ro.observe(el);

  return {
    setPlaying(place: Place | null) { globe.htmlElementsData(place ? [place] : []); },
    flyTo(lat, lon) {
      globe.pointOfView({ lat, lng: lon, altitude: Math.min(altitude(), 1.2) }, reducedMotion() ? 0 : 1200);
    },
    zoomBy(factor) {
      const pov = globe.pointOfView();
      globe.pointOfView({ ...pov, altitude: Math.min(4, Math.max(0.05, pov.altitude / factor)) }, reducedMotion() ? 0 : 300);
    },
    destroy() {
      ro.disconnect();
      globe._destructor();
      el.replaceChildren();
    },
  };
};
```
Если типы установленной версии `globe.gl` расходятся (например, конструктор `Globe()(el)` вместо `new Globe(el, opts)` или нет `onZoom`) — привести к API установленной версии и записать Ruling; поведение должно остаться тем же.

- [ ] **Step 5: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(map): 3D globe view with night texture, clustered dots, pulse and tooltip"
```
(Визуальная проверка глобуса — в Task 11, когда он подключён к приложению.)

---

### Task 10: Плоская карта (d3)

**Files:**
- Create: `src/map/map2d.ts`
- Modify: `package.json` (`d3-geo`, `d3-zoom`, `d3-selection`, `topojson-client`, `world-atlas`, типы)

**Interfaces:**
- Consumes: `Clusterer`, `MapItem`, `MapFactory`, `dotStyle`, `scaleToZoom`, `hitTest` (Task 7), `createPulse` (Task 9), `map.css` (Task 9).
- Produces: `createMap2D: MapFactory`.

- [ ] **Step 1: Зависимости**

```bash
npm i d3-geo d3-zoom d3-selection topojson-client world-atlas
npm i -D @types/d3-geo @types/d3-zoom @types/d3-selection @types/topojson-client
```

- [ ] **Step 2: Реализация**

Логика попадания и масштаба уже покрыта тестами Task 7 (`hitTest`, `scaleToZoom`, `dotStyle`); холст jsdom не рисует, поэтому этот модуль проверяется типами и вручную в Task 11.

`src/map/map2d.ts`:
```ts
import { geoEquirectangular, geoGraticule10, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import type { Place } from '../data/places';
import type { MapItem } from './cluster';
import { dotStyle } from './dot-style';
import { hitTest } from './hit-test';
import './map.css';
import type { MapFactory } from './map-view';
import { createPulse } from './pulse';
import { scaleToZoom } from './zoom';

const SPHERE: GeoPermissibleObjects = { type: 'Sphere' };
const AXES: GeoPermissibleObjects = {
  type: 'MultiLineString',
  coordinates: [[[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]], [[0, -90], [0, 0], [0, 90]]],
};

export const createMap2D: MapFactory = async (el, clusterer, cb) => {
  const css = getComputedStyle(document.documentElement);
  const token = (n: string) => css.getPropertyValue(n).trim();
  const color = { bg: token('--map-bg'), land: token('--map-land'), border: token('--border-card'), grid: token('--map-grid'), axis: token('--map-axis'), accent: token('--accent') };
  const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
  const land = feature(topo, topo.objects.countries) as GeoPermissibleObjects;
  const graticule = geoGraticule10();

  el.classList.add('stage__map--map');
  const canvas = document.createElement('canvas');
  canvas.className = 'map2d';
  const tooltip = document.createElement('div');
  tooltip.className = 'map-tooltip map-tooltip--floating';
  tooltip.hidden = true;
  const pulse = createPulse();
  pulse.hidden = true;
  el.append(canvas, pulse, tooltip);

  const ctx = canvas.getContext('2d')!;
  const projection = geoEquirectangular();
  const path = geoPath(projection, ctx);
  let w = 0;
  let h = 0;
  let transform: ZoomTransform = zoomIdentity;
  let screen: { x: number; y: number; r: number; item: MapItem }[] = [];
  let playing: Place | null = null;

  const zb = d3zoom<HTMLCanvasElement, unknown>().scaleExtent([1, 256]).on('zoom', (e: { transform: ZoomTransform }) => {
    transform = e.transform;
    draw();
  });
  const sel = select(canvas).call(zb);

  function stroke(obj: GeoPermissibleObjects, style: string, width: number) {
    ctx.beginPath(); path(obj); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.stroke();
  }

  function placePulse() {
    const p = playing && projection([playing.lon, playing.lat]);
    pulse.hidden = !p;
    if (p) { pulse.style.left = `${transform.applyX(p[0])}px`; pulse.style.top = `${transform.applyY(p[1])}px`; }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);
    const lw = 1 / transform.k;
    ctx.beginPath(); path(SPHERE); ctx.fillStyle = color.bg; ctx.fill();
    ctx.beginPath(); path(land); ctx.fillStyle = color.land; ctx.fill();
    stroke(land, color.border, lw);
    stroke(graticule, color.grid, lw);
    stroke(AXES, color.axis, lw);
    ctx.restore();

    const items = clusterer.items(scaleToZoom(transform.k));
    const maxPop = Math.max(1, ...items.map((i) => i.pop));
    screen = [];
    ctx.shadowColor = color.accent;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color.accent;
    for (const item of items) {
      const p = projection([item.lon, item.lat]);
      if (!p) continue;
      const x = transform.applyX(p[0]);
      const y = transform.applyY(p[1]);
      if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
      const { size, opacity } = dotStyle(item.pop, maxPop);
      ctx.globalAlpha = opacity;
      ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
      screen.push({ x, y, r: size / 2, item });
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    placePulse();
  }

  function resize() {
    w = canvas.parentElement!.clientWidth - 2;
    h = canvas.parentElement!.clientHeight - 2;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    projection.fitExtent([[0, 0], [w, h]], SPHERE);
    zb.extent([[0, 0], [w, h]]).translateExtent([[0, 0], [w, h]]);
    draw();
  }

  const at = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return hitTest(screen, e.clientX - r.left, e.clientY - r.top);
  };
  const centerOn = (lon: number, lat: number, k: number) => {
    const p = projection([lon, lat]);
    if (p) sel.call(zb.transform, zoomIdentity.translate(w / 2, h / 2).scale(k).translate(-p[0], -p[1]));
  };

  canvas.addEventListener('mousemove', (e) => {
    const item = at(e);
    canvas.style.cursor = item ? 'pointer' : 'grab';
    tooltip.hidden = !item;
    if (!item) return;
    const r = canvas.getBoundingClientRect();
    tooltip.textContent = cb.label(item);
    tooltip.style.left = `${e.clientX - r.left}px`;
    tooltip.style.top = `${e.clientY - r.top}px`;
  });
  canvas.addEventListener('mouseleave', () => { tooltip.hidden = true; });
  canvas.addEventListener('click', (e) => {
    const item = at(e);
    if (!item) return;
    if (item.type === 'cluster') centerOn(item.lon, item.lat, Math.min(256, 2 ** (item.zoomTo - 1)));
    else cb.onSelect(item.place);
  });

  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  return {
    setPlaying(place) { playing = place; placePulse(); },
    flyTo(lat, lon) { centerOn(lon, lat, Math.max(transform.k, 8)); },
    zoomBy(factor) { sel.call(zb.scaleBy, factor); },
    destroy() {
      ro.disconnect();
      sel.on('.zoom', null);
      el.classList.remove('stage__map--map');
      el.replaceChildren();
    },
  };
};
```
Перелёт на плоской карте — мгновенный (без d3-transition): плавный перелёт 1–1,5 с в спецификации относится к глобусу.

- [ ] **Step 3: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(map): flat canvas map with country outlines, zoom/pan, clustered dots"
```

---

### Task 11: Контроллер приложения и приёмка

**Files:**
- Create: `src/app/app.ts`, `tests/app.test.ts`
- Modify: `src/app/main.ts` (целиком)

**Interfaces:**
- Consumes: всё из Tasks 3–10.
- Produces:
  ```ts
  export interface AppDeps {
    refs: ShellRefs; i18n: I18n; storage: Storage | null;
    loadPlaces(): Promise<Place[]>; shards: ShardStore;
    factories: Record<ViewMode, MapFactory>;
    player: Player; blacklist: Blacklist;
    hasWebGL: boolean; narrowTouch: boolean;
    measureFps(): Promise<number>;
    mediaSession?: MediaSession;
  }
  export interface AppHandle { mode(): ViewMode; selectPlace(p: Place): Promise<void>; next(): Promise<void> }
  export const VOLUME_KEY = 'volume'; export const MUTE_KEY = 'muted';
  export function startApp(d: AppDeps): Promise<AppHandle>
  ```

- [ ] **Step 1: Тесты**

`tests/app.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import { startApp, type AppDeps } from '../src/app/app';
import type { Place } from '../src/data/places';
import type { ShardStore, StationLite } from '../src/data/shards';
import { createI18n } from '../src/i18n/i18n';
import type { MapCallbacks, MapFactory, MapView } from '../src/map/map-view';
import type { Player, PlayerState } from '../src/player/player';
import { renderShell } from '../src/ui/shell';

const i18n = createI18n('ru', ru);
const lisbon: Place = { id: 'c:1', lat: 38.7, lon: -9.1, kind: 'exact', cc: 'PT', nameRu: 'Лиссабон', name: 'Lisbon', count: 2, pop: 10 };
const porto: Place = { id: 'c:2', lat: 41.1, lon: -8.6, kind: 'exact', cc: 'PT', nameRu: 'Порту', name: 'Porto', count: 1, pop: 5 };
const st = (id: string, placeId: string, clicks = 1): StationLite =>
  ({ id, name: `Radio ${id}`, url: 'https://x', placeId, cc: 'PT', langs: [], tags: [], votes: 0, clicks, favicon: '', hls: false });
const pt = [st('a', 'c:1', 9), st('b', 'c:1', 3), st('p', 'c:2')];

class Mem {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

function fakeFactory() {
  const views: (MapView & { setPlaying: ReturnType<typeof vi.fn>; flyTo: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> })[] = [];
  let cb!: MapCallbacks;
  const factory: MapFactory = async (_el, _c, callbacks) => {
    cb = callbacks;
    const v = { setPlaying: vi.fn(), flyTo: vi.fn(), zoomBy: vi.fn(), destroy: vi.fn() };
    views.push(v);
    return v;
  };
  return { factory, views, cb: () => cb };
}

function fakePlayer() {
  let state: PlayerState = { kind: 'idle' };
  const ls = new Set<(s: PlayerState) => void>();
  const set = (s: PlayerState) => { state = s; ls.forEach((l) => l(s)); };
  const p: Player & { set: typeof set } = {
    set,
    play: vi.fn(async (s: StationLite) => set({ kind: 'loading', station: s })),
    pause: vi.fn(), toggle: vi.fn(), setVolume: vi.fn(), setMuted: vi.fn(),
    getState: () => state,
    subscribe: (l) => { ls.add(l); return () => { ls.delete(l); }; },
  };
  return p;
}

let deps: AppDeps;
let globe: ReturnType<typeof fakeFactory>;
let map: ReturnType<typeof fakeFactory>;
let player: ReturnType<typeof fakePlayer>;
let shards: ShardStore & { get: ReturnType<typeof vi.fn> };

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  globe = fakeFactory();
  map = fakeFactory();
  player = fakePlayer();
  shards = { get: vi.fn(async () => pt) };
  deps = {
    refs: renderShell(document.getElementById('app')!, i18n),
    i18n,
    storage: new Mem() as unknown as Storage,
    loadPlaces: async () => [lisbon, porto],
    shards,
    factories: { globe: globe.factory, map: map.factory },
    player,
    blacklist: { add: vi.fn(), has: () => false },
    hasWebGL: true,
    narrowTouch: false,
    measureFps: async () => 60,
  };
});

const flush = () => new Promise((r) => setTimeout(r, 0));

test('loads places and mounts the globe by default', async () => {
  const app = await startApp(deps);
  expect(app.mode()).toBe('globe');
  expect(globe.views).toHaveLength(1);
  expect(deps.refs.status.textContent).toBe('');
  expect(deps.refs.viewButtons[0].getAttribute('aria-pressed')).toBe('true');
});

test('no WebGL → flat map', async () => {
  const app = await startApp({ ...deps, hasWebGL: false });
  expect(app.mode()).toBe('map');
  expect(globe.views).toHaveLength(0);
});

test('view toggle switches, destroys the old view and remembers the choice', async () => {
  const app = await startApp(deps);
  deps.refs.viewButtons[1].click();
  await flush();
  expect(app.mode()).toBe('map');
  expect(globe.views[0].destroy).toHaveBeenCalled();
  expect(deps.storage!.getItem('mapMode')).toBe('map');
  expect(deps.refs.viewButtons[1].getAttribute('aria-pressed')).toBe('true');
});

test('selecting a place lists its stations; picking one plays it and marks the place', async () => {
  await startApp(deps);
  await globe.cb().onSelect(lisbon);
  await flush();
  const body = deps.refs.panelBody;
  expect(body.querySelector('.list-title')!.textContent).toBe('Лиссабон');
  expect(body.querySelector('.list-sub')!.textContent).toBe('Португалия · 2 станции · по популярности');
  const names = [...body.querySelectorAll('.station__name')].map((n) => n.textContent);
  expect(names).toEqual(['Radio a', 'Radio b']);
  (body.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(player.play).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  expect(globe.views[0].setPlaying).toHaveBeenLastCalledWith(lisbon);
  expect(deps.refs.player.querySelector('.pb__name')!.textContent).toBe('Radio a');
  expect(body.querySelector('.station.is-playing .station__name')!.textContent).toBe('Radio a');
});

test('country place uses the approximate subtitle', async () => {
  const country: Place = { ...lisbon, id: 'k:PT', kind: 'country' };
  shards.get.mockResolvedValueOnce([st('z', 'k:PT')]);
  const app = await startApp(deps);
  await app.selectPlace(country);
  expect(deps.refs.panelBody.querySelector('.list-title')!.textContent).toBe('Португалия');
  expect(deps.refs.panelBody.querySelector('.list-sub')!.textContent).toBe('Примерное расположение · 1 станция · по популярности');
});

test('shard failure shows retry that reloads', async () => {
  shards.get.mockRejectedValueOnce(new Error('net'));
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  const body = deps.refs.panelBody;
  expect(body.textContent).toContain('Не удалось загрузить станции этого места');
  (body.querySelector('button') as HTMLButtonElement).click();
  await flush();
  expect(body.querySelectorAll('.station')).toHaveLength(2);
});

test('low FPS on the globe switches to the flat map with a notice', async () => {
  const app = await startApp({ ...deps, measureFps: async () => 12 });
  await flush();
  expect(app.mode()).toBe('map');
  expect(deps.refs.stage.textContent).toContain('Включена плоская карта');
  expect(deps.storage!.getItem('mapMode')).toBeNull();
});

test('globe that fails to start falls back to the flat map', async () => {
  const app = await startApp({ ...deps, factories: { globe: async () => { throw new Error('webgl'); }, map: map.factory } });
  expect(app.mode()).toBe('map');
  expect(deps.refs.stage.textContent).toContain('Включена плоская карта');
});

test('places load failure shows an error status', async () => {
  await startApp({ ...deps, loadPlaces: async () => { throw new Error('net'); } });
  expect(deps.refs.status.textContent).toContain('Не удалось загрузить станции');
});

test('storage that throws does not break startup (review focus 4)', async () => {
  const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
  const app = await startApp({ ...deps, storage: bad });
  deps.refs.viewButtons[1].click();
  await flush();
  expect(app.mode()).toBe('map');
});

test('next nearby plays the next station; with none left a notice appears', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  await app.next();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }));
  deps.blacklist.has = () => true;
  await app.next();
  expect(deps.refs.stage.textContent).toContain('Рядом больше нет рабочих станций');
});

test('next nearby in another place flies there', async () => {
  const app = await startApp({ ...deps, blacklist: { add: vi.fn(), has: (id) => id === 'b' } });
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  await app.next();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'p' }));
  expect(globe.views[0].flyTo).toHaveBeenCalledWith(porto.lat, porto.lon);
});

test('Space toggles playback unless typing in a field', async () => {
  await startApp(deps);
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  expect(player.toggle).toHaveBeenCalledTimes(1);
  const input = deps.refs.header.querySelector('input')!;
  input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  expect(player.toggle).toHaveBeenCalledTimes(1);
});

test('volume is restored from storage and saved on change', async () => {
  deps.storage!.setItem('volume', '0.3');
  await startApp(deps);
  expect(player.setVolume).toHaveBeenCalledWith(0.3);
  const range = deps.refs.player.querySelector('.pb__range') as HTMLInputElement;
  range.value = '55';
  range.dispatchEvent(new Event('input'));
  expect(deps.storage!.getItem('volume')).toBe('0.55');
});

test('tooltip label for places and clusters', async () => {
  await startApp(deps);
  const label = globe.cb().label;
  expect(label({ type: 'place', key: 'c:1', place: lisbon, lat: 0, lon: 0, count: 12, pop: 1 })).toBe('Лиссабон · 12 станций');
  expect(label({ type: 'cluster', key: 'cl:1', lat: 0, lon: 0, count: 2427, pop: 1, zoomTo: 3 })).toBe('2 427 станций');
});
```

- [ ] **Step 2: Run** `npx vitest run tests/app.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`src/app/app.ts`:
```ts
import { countryName, placeTitle } from '../data/place-name';
import type { Place } from '../data/places';
import type { ShardStore, StationLite } from '../data/shards';
import type { I18n } from '../i18n/i18n';
import { initialMode, MODE_STORAGE_KEY, type ViewMode } from '../map/choose-mode';
import { createClusterer, type Clusterer, type MapItem } from '../map/cluster';
import type { MapFactory, MapView } from '../map/map-view';
import type { Blacklist } from '../player/blacklist';
import { updateMediaSession } from '../player/media-session';
import { findNextNearby } from '../player/next-nearby';
import type { Player } from '../player/player';
import { createPlayerBar } from '../ui/player-bar';
import type { ShellRefs } from '../ui/shell';
import { renderListMessage, renderStationList } from '../ui/station-list';
import { showToast } from '../ui/toast';

export interface AppDeps {
  refs: ShellRefs; i18n: I18n; storage: Storage | null;
  loadPlaces(): Promise<Place[]>; shards: ShardStore;
  factories: Record<ViewMode, MapFactory>;
  player: Player; blacklist: Blacklist;
  hasWebGL: boolean; narrowTouch: boolean;
  measureFps(): Promise<number>;
  mediaSession?: MediaSession;
}
export interface AppHandle { mode(): ViewMode; selectPlace(p: Place): Promise<void>; next(): Promise<void> }

export const VOLUME_KEY = 'volume';
export const MUTE_KEY = 'muted';
const MIN_FPS = 30;

export async function startApp(d: AppDeps): Promise<AppHandle> {
  const { refs, i18n, player } = d;
  const t = i18n.t;
  const read = (k: string) => { try { return d.storage?.getItem(k) ?? null; } catch { return null; } };
  const write = (k: string, v: string) => { try { d.storage?.setItem(k, v); } catch { /* storage unavailable */ } };

  let places: Place[] = [];
  let clusterer: Clusterer | null = null;
  let view: MapView | null = null;
  let mode: ViewMode = 'globe';
  let selected: Place | null = null;
  let playingPlace: Place | null = null;

  const storedVolume = Number(read(VOLUME_KEY) ?? '0.8');
  let volume = Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 1 ? storedVolume : 0.8;
  let muted = read(MUTE_KEY) === '1';
  player.setVolume(volume);
  player.setMuted(muted);

  const stationsLabel = (n: number) => t('stations.count', { count: n });
  const label = (item: MapItem) =>
    item.type === 'place'
      ? t('map.tooltip', { place: placeTitle(item.place, i18n.locale), stations: stationsLabel(item.count) })
      : stationsLabel(item.count);
  const placeLabel = (p: Place | null) => {
    if (!p) return '';
    const title = placeTitle(p, i18n.locale);
    return p.kind === 'country' ? title : t('player.placeCountry', { place: title, country: countryName(p.cc, i18n.locale) });
  };

  const bar = createPlayerBar(refs.player, i18n, {
    onToggle: () => player.toggle(),
    onNext: () => { void next(); },
    onVolume: (v) => {
      volume = v;
      player.setVolume(v);
      write(VOLUME_KEY, String(v));
      if (muted && v > 0) { muted = false; player.setMuted(false); write(MUTE_KEY, '0'); }
      renderBar();
    },
    onMute: () => { muted = !muted; player.setMuted(muted); write(MUTE_KEY, muted ? '1' : '0'); renderBar(); },
  });
  const renderBar = () => bar.render({ state: player.getState(), place: placeLabel(playingPlace), volume, muted });

  async function renderList(place: Place, showLoading = true) {
    if (showLoading) renderListMessage(refs.panelBody, t('data.loading'));
    try {
      const all = await d.shards.get(place.cc);
      if (selected !== place) return;
      const stations = all.filter((s) => s.placeId === place.id);
      const state = player.getState();
      const subtitle = place.kind === 'country'
        ? t('list.subtitleApprox', { stations: stationsLabel(stations.length) })
        : t('list.subtitle', { country: countryName(place.cc, i18n.locale), stations: stationsLabel(stations.length) });
      renderStationList(refs.panelBody, i18n, {
        title: placeTitle(place, i18n.locale),
        subtitle,
        stations,
        playingId: state.kind === 'idle' ? null : state.station.id,
        onPick: (s) => { void playStation(s, place); },
      });
    } catch {
      if (selected !== place) return;
      renderListMessage(refs.panelBody, t('list.loadError'), { label: t('common.retry'), onClick: () => { void renderList(place); } });
    }
  }

  async function selectPlace(p: Place) {
    selected = p;
    refs.left.classList.add('is-open');
    await renderList(p);
  }

  async function playStation(s: StationLite, p: Place) {
    playingPlace = p;
    view?.setPlaying(p);
    await player.play(s);
  }

  async function next() {
    const state = player.getState();
    if (state.kind === 'idle' || !playingPlace) return;
    const found = await findNextNearby({
      currentId: state.station.id,
      currentPlace: playingPlace,
      places,
      stationsOf: (cc) => d.shards.get(cc),
      isBlocked: (id) => d.blacklist.has(id),
    });
    if (!found) { showToast(refs.stage, t('player.noNext')); return; }
    if (found.place.id !== playingPlace.id) view?.flyTo(found.place.lat, found.place.lon);
    selected = found.place;
    void renderList(found.place, false);
    await playStation(found.station, found.place);
  }

  player.subscribe((s) => {
    renderBar();
    const station = s.kind === 'idle' ? null : s.station;
    updateMediaSession(
      d.mediaSession,
      station ? { title: station.name, artist: placeLabel(playingPlace), artwork: station.favicon } : null,
      s.kind === 'playing' || s.kind === 'loading' ? 'playing' : s.kind === 'idle' ? 'none' : 'paused',
      { play: () => player.toggle(), pause: () => player.pause(), next: () => { void next(); } },
    );
    if (selected) void renderList(selected, false);
  });

  async function mount(m: ViewMode) {
    view?.destroy();
    view = null;
    refs.map.replaceChildren();
    mode = m;
    for (const b of refs.viewButtons) b.setAttribute('aria-pressed', String(b.dataset.view === m));
    const v = await d.factories[m](refs.map, clusterer!, { onSelect: (p) => { void selectPlace(p); }, label });
    if (mode !== m) { v.destroy(); return; }
    view = v;
    v.setPlaying(playingPlace);
  }

  async function mountSafe(m: ViewMode) {
    try {
      await mount(m);
    } catch {
      if (m === 'globe') {
        await mount('map');
        showToast(refs.stage, t('map.fallback'));
      } else {
        refs.status.textContent = t('data.error');
      }
    }
  }

  for (const b of refs.viewButtons) {
    b.addEventListener('click', () => {
      const m = b.dataset.view as ViewMode;
      if (m === mode || !clusterer) return;
      if (m === 'globe' && !d.hasWebGL) { showToast(refs.stage, t('map.fallback')); return; }
      write(MODE_STORAGE_KEY, m);
      void mountSafe(m);
    });
  }
  refs.zoomIn.addEventListener('click', () => view?.zoomBy(2));
  refs.zoomOut.addEventListener('click', () => view?.zoomBy(0.5));
  refs.closePanel.addEventListener('click', () => refs.left.classList.remove('is-open'));
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('input, textarea, select, button, [contenteditable]')) return;
    e.preventDefault();
    player.toggle();
  });

  const handle: AppHandle = { mode: () => mode, selectPlace, next };
  renderBar();

  refs.status.textContent = t('data.loading');
  try {
    places = await d.loadPlaces();
  } catch {
    refs.status.textContent = t('data.error');
    return handle;
  }
  refs.status.textContent = '';
  clusterer = createClusterer(places);
  await mountSafe(initialMode({ saved: read(MODE_STORAGE_KEY), hasWebGL: d.hasWebGL, narrowTouch: d.narrowTouch }));
  if (mode === 'globe') {
    void d.measureFps().then((fps) => {
      if (fps < MIN_FPS && mode === 'globe') {
        void mount('map');
        showToast(refs.stage, t('map.fallback'));
      }
    });
  }
  return handle;
}
```

`src/app/main.ts` (целиком):
```ts
import ru from '../../locales/ru.json';
import { loadPlaces } from '../data/places';
import { createShardStore } from '../data/shards';
import { applyDirection, createI18n, resolveLocale, type Messages } from '../i18n/i18n';
import { safeStorage } from '../i18n/storage';
import { detectWebGL, measureFps } from '../map/choose-mode';
import { renderStarfield } from '../map/starfield';
import { createBlacklist } from '../player/blacklist';
import { loadHls } from '../player/hls-loader';
import { createPlayer } from '../player/player';
import { resolveStreamUrl } from '../player/stream-url';
import { renderShell } from '../ui/shell';
import { startApp } from './app';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config';

const catalogs: Record<string, Messages> = { ru };
const storage = safeStorage();
const locale = resolveLocale(location.search, storage, navigator.languages, SUPPORTED_LOCALES, DEFAULT_LOCALE);
const i18n = createI18n(locale, catalogs[locale]);
applyDirection(document, locale);
const refs = renderShell(document.getElementById('app')!, i18n);
renderStarfield(refs.stars);

const base = import.meta.env.BASE_URL;
const blacklist = createBlacklist(storage);
const audio = new Audio();
audio.preload = 'none';
const player = createPlayer({ audio, resolveUrl: (s) => resolveStreamUrl(s), loadHls, onFailure: (s) => blacklist.add(s.id) });

void startApp({
  refs,
  i18n,
  storage,
  loadPlaces: () => loadPlaces(base),
  shards: createShardStore(base),
  factories: {
    globe: (el, c, cb) => import('../map/globe3d').then((m) => m.createGlobe3D(el, c, cb)),
    map: (el, c, cb) => import('../map/map2d').then((m) => m.createMap2D(el, c, cb)),
  },
  player,
  blacklist,
  hasWebGL: detectWebGL(),
  narrowTouch: matchMedia('(max-width: 760px) and (pointer: coarse)').matches,
  measureFps: () => measureFps(3000),
  mediaSession: 'mediaSession' in navigator ? navigator.mediaSession : undefined,
});
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit && npm run build` → PASS; сборка без ошибок.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(app): wire places, map views, station list and player together"
```

- [ ] **Step 6: Приёмка в браузере** (`npm run dev`, при необходимости `npm run snapshot`)

Записать результаты в журнал исполнения:
1. **ПК 1440×900, глобус:** звёзды, ночная Земля, янтарные точки 3–7 px, группы издалека; наведение — подсказка «Место · N станций»; клик по группе приближает; клик по месту — список слева по макету; клик по станции — играет, точка пульсирует, плеер по макету. Сравнить бок о бок с `design/mockups/Main.dc.html`; подобрать `INITIAL_ALTITUDE` так, чтобы диаметр глобуса был ≈ 580 px, и `DEG_PER_PX_PER_ALT` — чтобы точки были 3–7 px (Ruling, если менялось).
2. **Плоская карта:** переключатель «Карта», контуры стран, сетка, экватор; перетаскивание, колесо, +/−; те же клики.
3. **10 случайных станций из разных стран** (≥ 8 играют). Записать: страна, станция, результат.
4. **Мёртвая станция:** найти неработающую (или временно подменить `url` на `https://example.invalid/stream` через консоль) — через 8 с «Станция не отвечает» и «Попробовать следующую рядом»; повторный «Следующая рядом» её не предлагает.
5. **Телефон 390×844:** по умолчанию карта; нажатие на точку открывает шторку списка; мини-плеер; нет горизонтальной прокрутки.
6. **Вес первой загрузки:** `npm run build` — сумма gzip `index-*.js` + `index-*.css` + gzip `public/data/places.json` ≤ 1 МБ; `globe3d` и `map2d` — отдельные ленивые чанки.

---

### Task 12: CI — запасной снимок v2, README

**Files:**
- Create: `scripts/fetch-deployed-snapshot.ts`, `tests/fetch-deployed-snapshot.test.ts`
- Modify: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: `PlacesFile` (Task 3).
- Produces: `fetchDeployedSnapshot(baseUrl: string, fetchFn?: typeof fetch): Promise<Map<string, string>>` — пути внутри `public/data/` → содержимое.

- [ ] **Step 1: Тест**

`tests/fetch-deployed-snapshot.test.ts`:
```ts
import { expect, test } from 'vitest';
import { fetchDeployedSnapshot } from '../scripts/fetch-deployed-snapshot';

test('downloads places, meta and one stations file per country', async () => {
  const served: Record<string, string> = {
    'https://x.io/r/data/places.json': JSON.stringify({ v: 2, generated: 'g', places: [['c:1', 0, 0, 0, 'DE', '', 'A', 1, 1], ['c:2', 0, 0, 0, 'DE', '', 'B', 1, 1], ['k:FR', 0, 0, 2, 'FR', '', 'F', 1, 1]] }),
    'https://x.io/r/data/meta.json': '{}',
    'https://x.io/r/data/stations/DE.json': 'de',
    'https://x.io/r/data/stations/FR.json': 'fr',
  };
  const f = (async (u: string) => (u in served ? new Response(served[u]) : new Response('', { status: 404 }))) as unknown as typeof fetch;
  const files = await fetchDeployedSnapshot('https://x.io/r', f);
  expect([...files.keys()].sort()).toEqual(['meta.json', 'places.json', 'stations/DE.json', 'stations/FR.json']);
  expect(files.get('stations/FR.json')).toBe('fr');
});

test('fails loudly when the deployed snapshot is missing', async () => {
  const f = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
  await expect(fetchDeployedSnapshot('https://x.io/r', f)).rejects.toThrow(/404/);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`scripts/fetch-deployed-snapshot.ts`:
```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PlacesFile } from '../src/data/places';

export async function fetchDeployedSnapshot(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<Map<string, string>> {
  const root = baseUrl.replace(/\/$/, '');
  const get = async (path: string) => {
    const r = await fetchFn(`${root}/data/${path}`);
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.text();
  };
  const files = new Map<string, string>();
  const places = await get('places.json');
  files.set('places.json', places);
  files.set('meta.json', await get('meta.json'));
  const countries = new Set((JSON.parse(places) as PlacesFile).places.map((p) => p[4]));
  for (const cc of countries) files.set(`stations/${cc}.json`, await get(`stations/${cc}.json`));
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await fetchDeployedSnapshot(process.argv[2]);
  for (const [path, body] of files) {
    mkdirSync(dirname(`public/data/${path}`), { recursive: true });
    writeFileSync(`public/data/${path}`, body);
  }
  console.log(`restored ${files.size} files from the deployed site`);
}
```

В `.github/workflows/deploy.yml` в шаге «Snapshot stations (fallback to last deployed)» заменить блок после `echo "::warning::…"` (строки `mkdir` и два `curl`) на:
```yaml
            npx tsx scripts/fetch-deployed-snapshot.ts "${{ steps.pages.outputs.base_url }}"
```

- [ ] **Step 4: README** — дописать/обновить разделы:
  - **Данные:** `public/data/places.json` (места, грузится сразу), `public/data/stations/<CC>.json` (станции страны, по клику), `meta.json` (отчёт: способы размещения, нераспознанные регионы и языки).
  - **Справочник городов и регионов:** `data/gazetteer.json` из GeoNames (CC BY 4.0). Обновлять раз в полгода: `npm run gazetteer` (скачивает ~200 МБ в `.cache/`, нужен `tar` с поддержкой zip — есть в Windows 10+ и macOS), затем закоммитить `data/gazetteer.json`. Частые нераспознанные регионы из `meta.json` — признак, что справочник стоит обновить.
  - **Текстура Земли:** `public/textures/earth-night.jpg` — NASA Black Marble (общественное достояние), взята из примеров three-globe.
  - **Чёрный список:** нерабочая станция скрывается на 12 часов (решение заказчика).

- [ ] **Step 5: Run** `npx vitest run && npm run build` → PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "ci: fallback restores v2 snapshot from the deployed site; README for Plan 2"
```
