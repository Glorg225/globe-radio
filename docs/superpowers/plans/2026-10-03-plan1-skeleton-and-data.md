# План 1: Каркас и данные — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Каркас сайта «Радио планеты» (тёмная тема по макету, i18n, оболочка экрана ПК) и ежедневный снимок станций Radio Browser (только рабочие HTTPS, нормализованные языки) — этапы 1–2 ТЗ.

**Architecture:** Одностраничное приложение на Vite + TypeScript без фреймворка (DOM-модули). Данные: скрипт `scripts/snapshot.ts` (запускается через `tsx`, в CI — раз в сутки) скачивает станции, фильтрует и пишет компактный `public/data/stations.json`; браузер грузит его модулем `src/data/load.ts`. Чистые функции (нормализация языков, фильтр/сжатие станций, i18n) покрыты тестами Vitest.

**Tech Stack:** Node 22+, Vite, TypeScript (strict), Vitest + jsdom, tsx, world-countries (центроиды стран, только в скрипте). Хостинг — GitHub Pages + GitHub Actions (снимок и деплой в одном конвейере, бесплатно).

**Spec:** `docs/02_tz.md` (этапы 1–2, разделы 5, 6, 7, 9), `docs/03_design.md` (токены, шрифты, шапка ПК), эталон разметки `design/mockups/Main.dc.html`.

**Следующие планы (не в этом):** План 2 — глобус/карта + плеер (этап 3); План 3 — карточка места (4); План 4 — «Учу язык» (5); План 5 — поиск, избранное, история, «Поделиться», таймер (6); План 6 — PWA, мобильная вёрстка, полировка, README сдачи (7–8).

## Global Constraints

- $0 на инфраструктуру; без собственного сервера и БД; без регистрации.
- Ни одной строки интерфейса в коде: все тексты в `locales/ru.json`. Тест запрещает кириллицу в `src/`.
- Языки интерфейса: v1 только `ru`; выбор: `?lang=` → сохранённый → язык браузера → `ru`.
- Вёрстка на логических CSS-свойствах (`margin-inline-start`, `inset-inline-*`), `dir` на `<html>`.
- Числа, множественное число — через `Intl` (`Intl.PluralRules`, `Intl.NumberFormat`).
- Название проекта — в одном месте: ключ `app.name` в `locales/ru.json`; технический id — `APP_ID` в `src/app/config.ts`. Название не использовать в путях/домене.
- Все цвета — CSS-переменные из `src/ui/tokens.css`; в компонентах цветов «вручную» нет.
- Шрифты: Unbounded (500/700) и Golos Text (400/500/600) из Google Fonts + системный резервный стек для CJK/арабского.
- Иконки линейные, толщина 2 px, скруглённые концы; эмодзи в интерфейсе нет.
- Станции: только `lastcheckok = 1` и `url_resolved` начинается с `https://`. Без координат — центр страны с флагом `approx`.
- Языки станции нормализуются к ISO 639-1; нераспознанные отбрасываются.
- Внизу экрана атрибуция: Radio Browser, Википедия (CC BY-SA), дисклеймер о ретрансляции.

## Review Focus

1. **Зеркало Radio Browser недоступно** → скрипт пробует следующий сервер, а не падает (тест в Task 6).
2. **`localStorage` бросает исключение (приватный режим)** → выбор языка работает без ошибок (тест в Task 2).
3. **Грязное поле языка** («Spanish, Catalan», «español», «  ENGLISH », опечатки) → нормализуется или отбрасывается, без дублей (тест в Task 4).
4. **Дубли станций по `stationuuid` и пустой `url_resolved` при https `url`** → дубль удаляется, станция без `url_resolved` отбрасывается (тест в Task 5).
5. **Нет ключа перевода / нет формы множественного числа** → возвращается ключ или форма `other`, интерфейс не падает (тест в Task 2).

---

## File Structure

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore
src/app/config.ts        — APP_ID, SUPPORTED_LOCALES, DEFAULT_LOCALE
src/app/main.ts          — точка входа: i18n → оболочка → загрузка станций
src/i18n/i18n.ts         — createI18n, resolveLocale, applyDirection
src/i18n/storage.ts      — safeStorage (localStorage без исключений)
src/ui/tokens.css        — дизайн-токены
src/ui/shell.css         — раскладка оболочки
src/ui/icons.ts          — SVG-иконки (строки)
src/ui/shell.ts          — renderShell
src/data/types.ts        — Station, CompactStation
src/data/languages.ts    — normalizeLanguages
src/data/stations.ts     — toStation (фильтр + сжатие), encode/decode
src/data/load.ts         — loadStations
locales/ru.json
scripts/snapshot.ts      — ежедневный снимок
.github/workflows/deploy.yml
tests/*.test.ts
```

---

### Task 1: Каркас проекта (Vite + TS + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/app/main.ts`, `src/app/config.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `APP_ID: string`, `SUPPORTED_LOCALES: readonly string[]`, `DEFAULT_LOCALE: string` из `src/app/config.ts`; скрипты npm `dev`, `build`, `test`, `snapshot`.

- [ ] **Step 1: git init и зависимости**

```bash
git init
npm init -y
npm i -D vite typescript vitest jsdom tsx world-countries @types/node
```

- [ ] **Step 2: Конфиги**

`package.json` → поле `"type": "module"` и scripts:
```json
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "snapshot": "tsx scripts/snapshot.ts"
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "scripts", "tests", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  test: { environment: 'jsdom' },
});
```

`.gitignore`:
```
node_modules
dist
public/data/
```

`src/app/config.ts`:
```ts
export const APP_ID = 'globe-radio';
export const SUPPORTED_LOCALES = ['ru'] as const;
export const DEFAULT_LOCALE = 'ru';
```

`index.html`:
```html
<!doctype html>
<html lang="ru" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0A0F1E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700&family=Golos+Text:wght@400;500;600&display=swap">
  <title></title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/app/main.ts"></script>
</body>
</html>
```

`src/app/main.ts` (временно):
```ts
import { APP_ID } from './config';
console.info(APP_ID);
```

- [ ] **Step 3: Smoke-тест**

`tests/smoke.test.ts`:
```ts
import { expect, test } from 'vitest';
import { APP_ID, DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../src/app/config';

test('config is consistent', () => {
  expect(APP_ID).toBe('globe-radio');
  expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
});
```

Run: `npm test` → Expected: 1 passed. Run: `npm run build` → Expected: `dist/` создан без ошибок.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + TypeScript + Vitest project"
```

---

### Task 2: Модуль i18n и `ru.json`

**Files:**
- Create: `src/i18n/i18n.ts`, `src/i18n/storage.ts`, `locales/ru.json`, `tests/i18n.test.ts`

**Interfaces:**
- Consumes: `SUPPORTED_LOCALES`, `DEFAULT_LOCALE` (Task 1).
- Produces:
  - `type Messages = Record<string, string | Partial<Record<Intl.LDMLPluralRule, string>>>`
  - `interface I18n { locale: string; t(key: string, params?: Record<string, string | number>): string; formatNumber(n: number): string }`
  - `createI18n(locale: string, messages: Messages): I18n`
  - `resolveLocale(search: string, storage: Storage | null, navLangs: readonly string[], supported: readonly string[], fallback: string): string`
  - `applyDirection(doc: Document, locale: string): void` — ставит `lang` и `dir` (`rtl` для `ar`, `he`, `fa`, `ur`).
  - `safeStorage(): Storage | null`
  - `LOCALE_STORAGE_KEY = 'locale'`

- [ ] **Step 1: Тесты**

`tests/i18n.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { applyDirection, createI18n, resolveLocale } from '../src/i18n/i18n';
import { safeStorage } from '../src/i18n/storage';

const messages = {
  hello: 'Привет, {name}!',
  'stations.count': { one: '{count} станция', few: '{count} станции', many: '{count} станций', other: '{count} станции' },
  'only.other': { other: '{count} шт.' },
};

describe('t', () => {
  const i18n = createI18n('ru', messages);
  test('interpolates params', () => expect(i18n.t('hello', { name: 'Мир' })).toBe('Привет, Мир!'));
  test('russian plurals', () => {
    expect(i18n.t('stations.count', { count: 1 })).toBe('1 станция');
    expect(i18n.t('stations.count', { count: 3 })).toBe('3 станции');
    expect(i18n.t('stations.count', { count: 5 })).toBe('5 станций');
    expect(i18n.t('stations.count', { count: 21 })).toBe('21 станция');
  });
  test('formats count with locale separators', () =>
    expect(i18n.t('stations.count', { count: 12000 })).toBe('12 000 станций'));
  test('missing plural form falls back to other', () =>
    expect(i18n.t('only.other', { count: 2 })).toBe('2 шт.'));
  test('missing key returns key', () => expect(i18n.t('nope')).toBe('nope'));
});

describe('resolveLocale', () => {
  const sup = ['ru', 'en'];
  const store = (v: string | null) => ({ getItem: () => v } as unknown as Storage);
  test('query param wins', () => expect(resolveLocale('?lang=en', store('ru'), ['ru'], sup, 'ru')).toBe('en'));
  test('stored next', () => expect(resolveLocale('', store('en'), ['ru'], sup, 'ru')).toBe('en'));
  test('browser language by prefix', () => expect(resolveLocale('', null, ['en-GB'], sup, 'ru')).toBe('en'));
  test('unsupported → fallback', () => expect(resolveLocale('?lang=xx', null, ['de'], sup, 'ru')).toBe('ru'));
  test('storage that throws is ignored', () => {
    const bad = { getItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(resolveLocale('', bad, [], sup, 'ru')).toBe('ru');
  });
});

test('applyDirection sets rtl for arabic', () => {
  applyDirection(document, 'ar');
  expect(document.documentElement.dir).toBe('rtl');
  applyDirection(document, 'ru');
  expect(document.documentElement.dir).toBe('ltr');
  expect(document.documentElement.lang).toBe('ru');
});

test('safeStorage never throws', () => {
  expect(() => safeStorage()).not.toThrow();
});
```

- [ ] **Step 2: Run** `npx vitest run tests/i18n.test.ts` → FAIL (модуль не найден).

- [ ] **Step 3: Реализация**

`src/i18n/storage.ts`:
```ts
export function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__probe__';
    s.setItem(probe, probe);
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
```

`src/i18n/i18n.ts`:
```ts
export type Messages = Record<string, string | Partial<Record<Intl.LDMLPluralRule, string>>>;

export interface I18n {
  locale: string;
  t(key: string, params?: Record<string, string | number>): string;
  formatNumber(n: number): string;
}

export const LOCALE_STORAGE_KEY = 'locale';
const RTL = new Set(['ar', 'he', 'fa', 'ur']);

export function createI18n(locale: string, messages: Messages): I18n {
  const plural = new Intl.PluralRules(locale);
  const num = new Intl.NumberFormat(locale);
  const formatNumber = (n: number) => num.format(n);

  function t(key: string, params: Record<string, string | number> = {}): string {
    const entry = messages[key];
    if (entry === undefined) return key;
    let template: string | undefined;
    if (typeof entry === 'string') {
      template = entry;
    } else {
      const count = Number(params.count ?? 0);
      template = entry[plural.select(count)] ?? entry.other;
    }
    if (template === undefined) return key;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => {
      const v = params[name];
      if (v === undefined) return `{${name}}`;
      return typeof v === 'number' ? formatNumber(v) : v;
    });
  }

  return { locale, t, formatNumber };
}

export function resolveLocale(
  search: string,
  storage: Storage | null,
  navLangs: readonly string[],
  supported: readonly string[],
  fallback: string,
): string {
  const pick = (tag: string | null | undefined) => {
    if (!tag) return undefined;
    const base = tag.toLowerCase().split('-')[0];
    return supported.includes(base) ? base : undefined;
  };
  const fromQuery = pick(new URLSearchParams(search).get('lang'));
  if (fromQuery) return fromQuery;
  let stored: string | null = null;
  try { stored = storage?.getItem(LOCALE_STORAGE_KEY) ?? null; } catch { stored = null; }
  const fromStore = pick(stored);
  if (fromStore) return fromStore;
  for (const l of navLangs) {
    const p = pick(l);
    if (p) return p;
  }
  return fallback;
}

export function applyDirection(doc: Document, locale: string): void {
  doc.documentElement.lang = locale;
  doc.documentElement.dir = RTL.has(locale.split('-')[0]) ? 'rtl' : 'ltr';
}
```

`locales/ru.json` (тексты оболочки ПК из макета):
```json
{
  "app.name": "Радио планеты",
  "header.search.placeholder": "Станция, город или страна",
  "header.surprise": "Удиви меня",
  "header.learn": "Учу язык",
  "header.view.label": "Вид карты",
  "header.view.globe": "3D",
  "header.view.map": "Карта",
  "header.install": "Установить на устройство",
  "panel.tabs.here": "Здесь",
  "panel.tabs.favorites": "Избранное",
  "panel.tabs.history": "История",
  "panel.empty": "Выберите точку на глобусе",
  "stations.count": { "one": "{count} станция", "few": "{count} станции", "many": "{count} станций", "other": "{count} станции" },
  "map.zoomIn": "Приблизить",
  "map.zoomOut": "Отдалить",
  "place.title": "Карточка места",
  "place.collapse": "Свернуть",
  "player.idle": "Ничего не играет",
  "footer.attribution": "Данные о станциях — Radio Browser · Тексты — Википедия (CC BY-SA) · Мы не храним и не ретранслируем эфир, станции вещают со своих серверов",
  "data.loading": "Загружаем станции…",
  "data.error": "Не удалось загрузить станции. Проверьте подключение и обновите страницу."
}
```

- [ ] **Step 4: Run** `npx vitest run tests/i18n.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(i18n): JSON messages, plurals, locale resolution, RTL direction"
```

---

### Task 3: Дизайн-токены и оболочка экрана ПК

**Files:**
- Create: `src/ui/tokens.css`, `src/ui/shell.css`, `src/ui/icons.ts`, `src/ui/shell.ts`, `tests/shell.test.ts`, `tests/no-hardcoded-strings.test.ts`
- Modify: `src/app/main.ts`

**Interfaces:**
- Consumes: `I18n` (Task 2).
- Produces: `renderShell(root: HTMLElement, i18n: I18n): ShellRefs`, где
  ```ts
  interface ShellRefs { header: HTMLElement; left: HTMLElement; stage: HTMLElement; placeCard: HTMLElement; player: HTMLElement; status: HTMLElement }
  ```
  Последующие планы монтируют свои модули в эти контейнеры. `status` — `role="status"` строка внутри `stage` для сообщений загрузки/ошибок.

- [ ] **Step 1: Тесты**

`tests/shell.test.ts`:
```ts
import { beforeEach, expect, test } from 'vitest';
import ru from '../locales/ru.json';
import { createI18n } from '../src/i18n/i18n';
import { renderShell } from '../src/ui/shell';

let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
});

test('renders all regions with localized labels', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.header.textContent).toContain('Радио планеты');
  expect(refs.header.querySelector('input[type=search]')!.getAttribute('placeholder')).toBe('Станция, город или страна');
  expect(refs.header.textContent).toContain('Удиви меня');
  expect(refs.header.textContent).toContain('Учу язык');
  expect(refs.header.querySelector('[aria-label="Установить на устройство"]')).not.toBeNull();
  const seg = refs.header.querySelectorAll('[role=group] button');
  expect([...seg].map((b) => b.textContent)).toEqual(['3D', 'Карта']);
  expect(seg[0].getAttribute('aria-pressed')).toBe('true');
  expect(refs.left.textContent).toContain('Избранное');
  expect(refs.placeCard.textContent).toContain('Карточка места');
  expect(refs.stage.textContent).toContain('Radio Browser');
  expect(refs.status.getAttribute('role')).toBe('status');
  expect(refs.player).toBeInstanceOf(HTMLElement);
});

test('every button has an accessible name', () => {
  renderShell(root, createI18n('ru', ru));
  for (const b of root.querySelectorAll('button')) {
    const name = b.textContent!.trim() || b.getAttribute('aria-label');
    expect(name, b.outerHTML).toBeTruthy();
  }
});
```

`tests/no-hardcoded-strings.test.ts`:
```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

// Data dictionaries (native language names) are not UI strings.
const ALLOWED = new Set([join('src', 'data', 'languages.ts')]);

test('no Cyrillic UI strings in src/', () => {
  const offenders = files('src')
    .filter((f) => /\.(ts|css|html)$/.test(f) && !ALLOWED.has(f))
    .filter((f) => /[А-Яа-яЁё]/.test(readFileSync(f, 'utf8')));
  expect(offenders).toEqual([]);
});
```

- [ ] **Step 2: Run** `npm test` → FAIL (`renderShell` не найден).

- [ ] **Step 3: Токены**

`src/ui/tokens.css` — все токены из `docs/03_design.md` §1 дословно:
```css
:root {
  --bg: #0A0F1E;
  --surface: #0D1326;
  --surface-player: #111833;
  --surface-raised: #121931;
  --surface-card: #151C38;
  --surface-mini-player: #1A2346;
  --item-selected: #1E2850;
  --segment-active: #2A3566;
  --tile: #222D5A;
  --border-divider: #222B4F;
  --border-card: #26305A;
  --border-control: #2A3460;
  --border-popover: #34407A;
  --text: #EEF1F8;
  --text-muted: #A3ADC8;
  --text-faint: #8D97B5;
  --star: #C9D3F5;

  --accent: #FFB547;
  --on-accent: #1A1206;
  --link: #FFC978;
  --link-hover: #FFE2B0;
  --live: #FF5D6C;
  --star-off: #6E7899;

  --teal: #5EE0D0;
  --on-teal: #062320;
  --teal-banner-bg: #0E2A2F;
  --teal-banner-border: #1E4B50;
  --teal-tip-bg: #10262B;
  --teal-chip-bg: #16343A;
  --teal-tile: #1B3A40;
  --teal-text-muted: #A9D9D3;
  --teal-tip-text: #CBEDE8;
  --teal-link: #7FE9DC;

  --globe-gradient: radial-gradient(circle at 34% 30%, #1E2C55 0%, #111A3A 55%, #070B1A 100%);
  --globe-border: #2A3768;
  --globe-grid: #3A4A85;
  --map-bg: #0F1630;
  --map-grid: #25305C;
  --map-axis: #33407A;
  --dot-muted: #5A6690;

  --font-display: 'Unbounded', system-ui, 'Noto Sans SC', 'Noto Sans JP', 'Noto Sans Arabic', sans-serif;
  --font-body: 'Golos Text', system-ui, -apple-system, 'Segoe UI', 'Noto Sans SC', 'Noto Sans JP', 'Noto Sans Arabic', sans-serif;

  --r-control: 12px;
  --r-card: 14px;
  --r-item: 12px;
  --r-letter: 10px;
  --r-segment-inner: 9px;

  --h-header: 68px;
  --h-player: 92px;
  --w-left: 320px;
  --w-right: 360px;
  --pad-panel: 20px;
}
```

- [ ] **Step 4: Иконки**

`src/ui/icons.ts` (пути из макета `Main.dc.html`, Lucide-стиль):
```ts
const svg = (body: string, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  logo: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17M3.5 15h17"/></svg>`,
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  shuffle: svg('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  message: svg('<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>'),
  download: svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  chevronRight: svg('<path d="M9 6l6 6-6 6"/>'),
};
```

- [ ] **Step 5: Оболочка**

`src/ui/shell.ts`:
```ts
import type { I18n } from '../i18n/i18n';
import { icons } from './icons';
import './tokens.css';
import './shell.css';

export interface ShellRefs {
  header: HTMLElement;
  left: HTMLElement;
  stage: HTMLElement;
  placeCard: HTMLElement;
  player: HTMLElement;
  status: HTMLElement;
}

export function renderShell(root: HTMLElement, i18n: I18n): ShellRefs {
  const { t } = i18n;
  document.title = t('app.name');
  root.className = 'shell';
  root.innerHTML = `
    <header class="shell__header">
      <div class="logo">${icons.logo}<span class="logo__text">${t('app.name')}</span></div>
      <label class="search">${icons.search}
        <input type="search" placeholder="${t('header.search.placeholder')}" aria-label="${t('header.search.placeholder')}">
      </label>
      <button class="btn btn--accent" data-action="surprise">${icons.shuffle}<span>${t('header.surprise')}</span></button>
      <div class="spacer"></div>
      <button class="btn btn--outline" data-action="learn">${icons.message}<span>${t('header.learn')}</span></button>
      <div class="segment" role="group" aria-label="${t('header.view.label')}">
        <button aria-pressed="true" data-view="globe">${t('header.view.globe')}</button>
        <button aria-pressed="false" data-view="map">${t('header.view.map')}</button>
      </div>
      <button class="btn btn--outline btn--icon" data-action="install" aria-label="${t('header.install')}">${icons.download}</button>
    </header>
    <div class="shell__body">
      <aside class="shell__left">
        <nav class="tabs">
          <button class="tabs__tab is-active">${t('panel.tabs.here')}</button>
          <button class="tabs__tab">${t('panel.tabs.favorites')}</button>
          <button class="tabs__tab">${t('panel.tabs.history')}</button>
        </nav>
        <p class="panel-empty">${t('panel.empty')}</p>
      </aside>
      <main class="shell__stage">
        <p class="stage__status" role="status"></p>
        <div class="stage__zoom">
          <button aria-label="${t('map.zoomIn')}">+</button>
          <button aria-label="${t('map.zoomOut')}">−</button>
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
    <footer class="shell__player"><span class="player__idle">${t('player.idle')}</span></footer>
  `;
  const q = (s: string) => root.querySelector<HTMLElement>(s)!;
  return {
    header: q('.shell__header'),
    left: q('.shell__left'),
    stage: q('.shell__stage'),
    placeCard: q('.shell__place'),
    player: q('.shell__player'),
    status: q('.stage__status'),
  };
}
```

`src/ui/shell.css` (размеры из `03_design.md` §3, логические свойства):
```css
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font-family: var(--font-body); font-size: 15px; }
a { color: var(--link); } a:hover { color: var(--link-hover); }
button { font-family: inherit; cursor: pointer; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.shell { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
.shell__header { height: var(--h-header); flex-shrink: 0; display: flex; align-items: center; gap: 20px; padding-inline: 24px; background: var(--surface); border-block-end: 1px solid var(--border-divider); }
.logo { display: flex; align-items: center; gap: 10px; inline-size: 272px; }
.logo__text { font-family: var(--font-display); font-weight: 700; font-size: 18px; letter-spacing: .2px; }
.search { flex: 1; max-inline-size: 520px; display: flex; align-items: center; gap: 10px; block-size: 42px; padding-inline: 14px; border-radius: var(--r-control); background: var(--surface-card); border: 1px solid var(--border-control); color: var(--text-muted); }
.search input { flex: 1; background: transparent; border: 0; outline: 0; color: var(--text); font: inherit; font-size: 15px; }
.spacer { flex: 1; }
.btn { block-size: 42px; display: inline-flex; align-items: center; gap: 8px; padding-inline: 18px; border-radius: var(--r-control); font-size: 15px; }
.btn--accent { border: 0; background: var(--accent); color: var(--on-accent); font-weight: 600; }
.btn--outline { background: transparent; border: 1px solid var(--border-control); color: var(--text); padding-inline: 16px; }
.btn--icon { inline-size: 42px; padding: 0; justify-content: center; }
.btn--ghost { background: transparent; border: 0; color: var(--text-muted); inline-size: 36px; block-size: 36px; display: inline-flex; align-items: center; justify-content: center; }
.segment { display: flex; padding: 4px; border-radius: var(--r-control); background: var(--surface-card); border: 1px solid var(--border-control); }
.segment button { block-size: 34px; padding-inline: 14px; border-radius: var(--r-segment-inner); border: 0; background: transparent; color: var(--text-muted); font-size: 14px; }
.segment button[aria-pressed="true"] { background: var(--segment-active); color: var(--text); font-weight: 600; }

.shell__body { flex: 1; display: flex; min-block-size: 0; }
.shell__left { inline-size: var(--w-left); flex-shrink: 0; background: var(--surface); border-inline-end: 1px solid var(--border-divider); display: flex; flex-direction: column; }
.tabs { display: flex; gap: 4px; padding: 16px 16px 8px; }
.tabs__tab { flex: 1; block-size: 36px; border-radius: 10px; border: 0; background: transparent; color: var(--text-muted); font-size: 14px; }
.tabs__tab.is-active { background: var(--item-selected); color: var(--text); font-weight: 600; }
.panel-empty { padding: 10px var(--pad-panel); color: var(--text-muted); font-size: 14px; margin: 0; }

.shell__stage { flex: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.stage__status { position: absolute; inset-block-start: 16px; margin: 0; color: var(--text-muted); font-size: 13px; }
.stage__status:empty { display: none; }
.stage__zoom { position: absolute; inset-inline-end: 20px; inset-block-end: 16px; display: flex; flex-direction: column; gap: 8px; }
.stage__zoom button { inline-size: 40px; block-size: 40px; border-radius: 10px; border: 1px solid var(--border-control); background: var(--surface-raised); color: var(--text); font-size: 20px; }
.stage__attribution { position: absolute; inset-inline-start: 20px; inset-block-end: 16px; margin: 0; font-size: 12px; color: var(--text-faint); max-inline-size: calc(100% - 100px); }

.shell__place { inline-size: var(--w-right); flex-shrink: 0; background: var(--surface); border-inline-start: 1px solid var(--border-divider); padding: var(--pad-panel); display: flex; flex-direction: column; gap: 16px; }
.place__head { display: flex; align-items: center; justify-content: space-between; }
.section-label { font-size: 13px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--text-muted); }

.shell__player { block-size: var(--h-player); flex-shrink: 0; background: var(--surface-player); border-block-start: 1px solid var(--border-divider); display: flex; align-items: center; padding-inline: 24px; }
.player__idle { color: var(--text-muted); }

/* Temporary narrow-screen fallback until Plan 6 (mobile layout per mockup): no horizontal scroll */
@media (max-width: 1100px) { .shell__place { display: none; } }
@media (max-width: 760px) {
  .shell__left, .search, .btn--outline span, .logo__text { display: none; }
  .logo { inline-size: auto; }
  .shell__header { gap: 10px; padding-inline: 12px; }
}

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
```

- [ ] **Step 6: Подключить в `main.ts`**

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

- [ ] **Step 7: Проверка**

Run: `npm test` → все PASS. Run: `npm run dev`, открыть в браузере 1440×900, сравнить шапку с `design/mockups/Main.dc.html` (цвета, высота 68, кнопки 42, сегмент). Проверить `?lang=ar`… (поддерживается только `ru` — `dir` остаётся `ltr`; для ручной проверки RTL временно выполнить в консоли `document.documentElement.dir='rtl'` — панели должны зеркально поменяться местами).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): design tokens and desktop shell per approved mockup"
```

---

### Task 4: Нормализация языков

**Files:**
- Create: `src/data/languages.ts`, `tests/languages.test.ts`

**Interfaces:**
- Produces: `normalizeLanguages(languagecodes: string, language: string): string[]` — уникальные коды ISO 639-1 в нижнем регистре, порядок как в источнике.

- [ ] **Step 1: Тесты**

`tests/languages.test.ts`:
```ts
import { expect, test } from 'vitest';
import { normalizeLanguages } from '../src/data/languages';

test('uses languagecodes when present', () =>
  expect(normalizeLanguages('es,ca', 'spanish,catalan')).toEqual(['es', 'ca']));
test('codes are trimmed, lowercased, deduped', () =>
  expect(normalizeLanguages(' EN , en,es', '')).toEqual(['en', 'es']));
test('falls back to names in english and native forms', () =>
  expect(normalizeLanguages('', 'Spanish, español,  ENGLISH ,русский')).toEqual(['es', 'en', 'ru']));
test('accepts names separated by / ; and "and"', () =>
  expect(normalizeLanguages('', 'french/german;italian and portuguese')).toEqual(['fr', 'de', 'it', 'pt']));
test('drops unknown codes and names', () =>
  expect(normalizeLanguages('zz,xx1', 'klingon, music')).toEqual([]));
test('3-letter ISO 639-2 codes map to 639-1 when known', () =>
  expect(normalizeLanguages('spa,eng', '')).toEqual(['es', 'en']));
test('empty input', () => expect(normalizeLanguages('', '')).toEqual([]));
```

- [ ] **Step 2: Run** `npx vitest run tests/languages.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`src/data/languages.ts`:
```ts
// English and native language names -> ISO 639-1.
// Extend from the snapshot report (unknownLanguages).
const NAME_TO_CODE: Record<string, string> = {
  english: 'en', spanish: 'es', 'español': 'es', espanol: 'es', castellano: 'es',
  french: 'fr', 'français': 'fr', francais: 'fr', german: 'de', deutsch: 'de',
  italian: 'it', italiano: 'it', portuguese: 'pt', 'português': 'pt', portugues: 'pt', brazilian: 'pt', 'brazilian portuguese': 'pt',
  russian: 'ru', 'русский': 'ru', ukrainian: 'uk', 'українська': 'uk', belarusian: 'be',
  polish: 'pl', polski: 'pl', czech: 'cs', 'čeština': 'cs', slovak: 'sk', slovenian: 'sl', croatian: 'hr', serbian: 'sr', bosnian: 'bs',
  bulgarian: 'bg', macedonian: 'mk', romanian: 'ro', 'română': 'ro', hungarian: 'hu', magyar: 'hu',
  greek: 'el', 'ελληνικά': 'el', turkish: 'tr', 'türkçe': 'tr', dutch: 'nl', nederlands: 'nl', flemish: 'nl',
  swedish: 'sv', svenska: 'sv', norwegian: 'no', norsk: 'no', danish: 'da', dansk: 'da', finnish: 'fi', suomi: 'fi', icelandic: 'is',
  estonian: 'et', latvian: 'lv', lithuanian: 'lt', irish: 'ga', welsh: 'cy', catalan: 'ca', 'català': 'ca', basque: 'eu', euskara: 'eu', galician: 'gl',
  arabic: 'ar', 'العربية': 'ar', hebrew: 'he', persian: 'fa', farsi: 'fa', urdu: 'ur', hindi: 'hi', bengali: 'bn', bangla: 'bn',
  tamil: 'ta', telugu: 'te', malayalam: 'ml', kannada: 'kn', marathi: 'mr', gujarati: 'gu', punjabi: 'pa', nepali: 'ne', sinhala: 'si',
  chinese: 'zh', mandarin: 'zh', cantonese: 'zh', '中文': 'zh', japanese: 'ja', '日本語': 'ja', korean: 'ko', '한국어': 'ko',
  thai: 'th', vietnamese: 'vi', 'tiếng việt': 'vi', indonesian: 'id', 'bahasa indonesia': 'id', malay: 'ms', filipino: 'tl', tagalog: 'tl',
  swahili: 'sw', amharic: 'am', hausa: 'ha', yoruba: 'yo', zulu: 'zu', afrikaans: 'af', somali: 'so',
  armenian: 'hy', georgian: 'ka', azerbaijani: 'az', kazakh: 'kk', uzbek: 'uz', mongolian: 'mn', albanian: 'sq', esperanto: 'eo', latin: 'la',
};

// ISO 639-2/3 -> 639-1 for common cases
const THREE_TO_TWO: Record<string, string> = {
  eng: 'en', spa: 'es', fra: 'fr', fre: 'fr', deu: 'de', ger: 'de', ita: 'it', por: 'pt', rus: 'ru', ukr: 'uk',
  pol: 'pl', nld: 'nl', dut: 'nl', ara: 'ar', zho: 'zh', chi: 'zh', jpn: 'ja', kor: 'ko', tur: 'tr', ell: 'el', gre: 'el',
  swe: 'sv', nor: 'no', dan: 'da', fin: 'fi', ces: 'cs', cze: 'cs', ron: 'ro', rum: 'ro', hun: 'hu', heb: 'he', hin: 'hi', fas: 'fa', per: 'fa',
};

const display = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });

function isKnownCode(code: string): boolean {
  if (!/^[a-z]{2}$/.test(code)) return false;
  try { return display.of(code) !== undefined; } catch { return false; }
}

function fromCode(raw: string): string | undefined {
  const c = raw.trim().toLowerCase();
  if (c.length === 3) return THREE_TO_TWO[c];
  return isKnownCode(c) ? c : undefined;
}

function fromName(raw: string): string | undefined {
  const n = raw.trim().toLowerCase();
  return n ? NAME_TO_CODE[n] : undefined;
}

export function normalizeLanguages(languagecodes: string, language: string): string[] {
  const out: string[] = [];
  const push = (c: string | undefined) => { if (c && !out.includes(c)) out.push(c); };
  for (const part of languagecodes.split(',')) push(fromCode(part));
  if (out.length === 0) {
    for (const part of language.split(/,|\/|;|\band\b/i)) push(fromName(part));
  }
  return out;
}
```

- [ ] **Step 4: Run** `npx vitest run tests/languages.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(data): normalize station languages to ISO 639-1"
```

---

### Task 5: Модель станции: фильтр, сжатие, распаковка

**Files:**
- Create: `src/data/types.ts`, `src/data/stations.ts`, `tests/stations.test.ts`

**Interfaces:**
- Consumes: `normalizeLanguages` (Task 4).
- Produces (`src/data/types.ts`):
  ```ts
  export interface RawStation { stationuuid: string; name: string; url: string; url_resolved: string; favicon: string; tags: string; countrycode: string; language: string; languagecodes: string; votes: number; clickcount: number; lastcheckok: number; hls: number; geo_lat: number | null; geo_long: number | null; state: string }
  export interface Station { id: string; name: string; url: string; lat: number; lon: number; approx: boolean; cc: string; state: string; langs: string[]; tags: string[]; votes: number; clicks: number; favicon: string; hls: boolean }
  export type CompactStation = [id: string, name: string, url: string, lat: number, lon: number, approx: 0 | 1, cc: string, state: string, langs: string, tags: string, votes: number, clicks: number, favicon: string, hls: 0 | 1];
  export type Centroids = Record<string, [lat: number, lon: number]>;
  ```
- Produces (`src/data/stations.ts`): `toStation(raw: RawStation, centroids: Centroids): Station | null`, `dedupe(list: Station[]): Station[]`, `encode(s: Station): CompactStation`, `decode(c: CompactStation): Station`.

- [ ] **Step 1: Тесты**

`tests/stations.test.ts`:
```ts
import { expect, test } from 'vitest';
import { decode, dedupe, encode, toStation } from '../src/data/stations';
import type { RawStation } from '../src/data/types';

const centroids = { PT: [39.5, -8.0] as [number, number] };
const raw = (o: Partial<RawStation> = {}): RawStation => ({
  stationuuid: 'u1', name: '  Rádio Comercial ', url: 'https://a/stream', url_resolved: 'https://b/stream',
  favicon: 'https://a/ico.png', tags: 'Pop, Rock,pop,,news,talk,hits,extra', countrycode: 'pt',
  language: 'portuguese', languagecodes: 'pt', votes: 10, clickcount: 5, lastcheckok: 1, hls: 0,
  geo_lat: 38.72, geo_long: -9.14, state: 'Lisboa', ...o,
});

test('maps a good station', () => {
  expect(toStation(raw(), centroids)).toEqual({
    id: 'u1', name: 'Rádio Comercial', url: 'https://b/stream', lat: 38.72, lon: -9.14, approx: false,
    cc: 'PT', state: 'Lisboa', langs: ['pt'], tags: ['pop', 'rock', 'news', 'talk', 'hits'],
    votes: 10, clicks: 5, favicon: 'https://a/ico.png', hls: false,
  });
});
test('rejects http stream', () => expect(toStation(raw({ url_resolved: 'http://b/s' }), centroids)).toBeNull());
test('rejects empty url_resolved even if url is https', () => expect(toStation(raw({ url_resolved: '' }), centroids)).toBeNull());
test('rejects not-ok stations', () => expect(toStation(raw({ lastcheckok: 0 }), centroids)).toBeNull());
test('rejects empty name', () => expect(toStation(raw({ name: '   ' }), centroids)).toBeNull());
test('missing coords → country centroid, approx', () => {
  const s = toStation(raw({ geo_lat: null, geo_long: null }), centroids)!;
  expect([s.lat, s.lon, s.approx]).toEqual([39.5, -8.0, true]);
});
test('0,0 coords are treated as missing', () =>
  expect(toStation(raw({ geo_lat: 0, geo_long: 0 }), centroids)!.approx).toBe(true));
test('out-of-range coords are treated as missing', () =>
  expect(toStation(raw({ geo_lat: 120, geo_long: 10 }), centroids)!.approx).toBe(true));
test('no coords and unknown country → dropped', () =>
  expect(toStation(raw({ geo_lat: null, geo_long: null, countrycode: 'ZZ' }), centroids)).toBeNull());
test('http favicon is dropped (mixed content)', () =>
  expect(toStation(raw({ favicon: 'http://a/ico.png' }), centroids)!.favicon).toBe(''));
test('dedupe keeps first by id', () => {
  const a = toStation(raw(), centroids)!;
  const b = { ...a, name: 'dup' };
  expect(dedupe([a, b])).toEqual([a]);
});
test('encode/decode roundtrip', () => {
  const s = toStation(raw({ hls: 1 }), centroids)!;
  expect(decode(encode(s))).toEqual(s);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/stations.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`src/data/types.ts` — как в блоке Interfaces выше.

`src/data/stations.ts`:
```ts
import { normalizeLanguages } from './languages';
import type { Centroids, CompactStation, RawStation, Station } from './types';

const MAX_TAGS = 5;

function validCoords(lat: number | null, lon: number | null): lat is number {
  return typeof lat === 'number' && typeof lon === 'number'
    && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
}

function parseTags(tags: string): string[] {
  const out: string[] = [];
  for (const t of tags.split(',')) {
    const v = t.trim().toLowerCase();
    if (v && !out.includes(v)) out.push(v);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;

export function toStation(raw: RawStation, centroids: Centroids): Station | null {
  const name = raw.name.trim();
  const url = raw.url_resolved.trim();
  if (raw.lastcheckok !== 1 || !name || !url.startsWith('https://')) return null;
  const cc = raw.countrycode.trim().toUpperCase();
  let lat: number, lon: number, approx: boolean;
  if (validCoords(raw.geo_lat, raw.geo_long)) {
    lat = raw.geo_lat; lon = raw.geo_long as number; approx = false;
  } else {
    const c = centroids[cc];
    if (!c) return null;
    [lat, lon] = c; approx = true;
  }
  return {
    id: raw.stationuuid, name, url, lat: round(lat), lon: round(lon), approx, cc,
    state: raw.state.trim(),
    langs: normalizeLanguages(raw.languagecodes, raw.language),
    tags: parseTags(raw.tags),
    votes: raw.votes, clicks: raw.clickcount,
    favicon: raw.favicon.startsWith('https://') ? raw.favicon : '',
    hls: raw.hls === 1,
  };
}

export function dedupe(list: Station[]): Station[] {
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

export function encode(s: Station): CompactStation {
  return [s.id, s.name, s.url, s.lat, s.lon, s.approx ? 1 : 0, s.cc, s.state, s.langs.join(','), s.tags.join(','), s.votes, s.clicks, s.favicon, s.hls ? 1 : 0];
}

export function decode(c: CompactStation): Station {
  const [id, name, url, lat, lon, approx, cc, state, langs, tags, votes, clicks, favicon, hls] = c;
  return {
    id, name, url, lat, lon, approx: approx === 1, cc, state,
    langs: langs ? langs.split(',') : [], tags: tags ? tags.split(',') : [],
    votes, clicks, favicon, hls: hls === 1,
  };
}
```

- [ ] **Step 4: Run** `npx vitest run tests/stations.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(data): station filter (HTTPS, working), centroid fallback, compact encoding"
```

---

### Task 6: Скрипт ежедневного снимка

**Files:**
- Create: `scripts/snapshot.ts`, `scripts/radio-browser.ts`, `tests/radio-browser.test.ts`

**Interfaces:**
- Consumes: `toStation`, `dedupe`, `encode` (Task 5), `APP_ID` (Task 1).
- Produces: файлы `public/data/stations.json` (`{ "v": 1, "generated": ISO-строка, "stations": CompactStation[] }`) и `public/data/meta.json` (`{ generated, stations, countries, languages, unknownLanguages: [name, count][] }`); `fetchWithMirrors<T>(path: string, fetchFn?: typeof fetch): Promise<T>` в `scripts/radio-browser.ts`.

- [ ] **Step 1: Тест переключения зеркал**

`tests/radio-browser.test.ts`:
```ts
import { expect, test, vi } from 'vitest';
import { fetchWithMirrors } from '../scripts/radio-browser';

test('tries next mirror when one fails', async () => {
  const calls: string[] = [];
  const fake = vi.fn(async (url: string) => {
    calls.push(url);
    if (url.endsWith('/json/servers')) return new Response(JSON.stringify([{ name: 'a.example' }, { name: 'b.example' }]));
    if (url.includes('a.example')) throw new Error('down');
    return new Response(JSON.stringify({ ok: true }));
  }) as unknown as typeof fetch;
  const res = await fetchWithMirrors<{ ok: boolean }>('/json/stats', fake, () => 0);
  expect(res).toEqual({ ok: true });
  expect(calls.some((u) => u.includes('b.example/json/stats'))).toBe(true);
});

test('throws after all mirrors fail', async () => {
  const fake = (async (url: string) => {
    if (url.endsWith('/json/servers')) return new Response(JSON.stringify([{ name: 'a.example' }]));
    return new Response('err', { status: 503 });
  }) as unknown as typeof fetch;
  await expect(fetchWithMirrors('/json/stats', fake, () => 0)).rejects.toThrow(/all mirrors failed/);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация клиента**

`scripts/radio-browser.ts`:
```ts
import { APP_ID } from '../src/app/config';

const DISCOVERY = 'https://all.api.radio-browser.info/json/servers';
const FALLBACK = ['de1.api.radio-browser.info', 'nl1.api.radio-browser.info', 'at1.api.radio-browser.info'];
const headers = { 'User-Agent': `${APP_ID}/1.0` };

async function servers(fetchFn: typeof fetch): Promise<string[]> {
  try {
    const r = await fetchFn(DISCOVERY, { headers });
    const list = (await r.json()) as { name: string }[];
    const names = [...new Set(list.map((s) => s.name))];
    return names.length ? names : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export async function fetchWithMirrors<T>(path: string, fetchFn: typeof fetch = fetch, random: () => number = Math.random): Promise<T> {
  const list = await servers(fetchFn);
  const start = Math.floor(random() * list.length);
  const ordered = [...list.slice(start), ...list.slice(0, start)];
  const errors: string[] = [];
  for (const host of ordered) {
    try {
      const r = await fetchFn(`https://${host}${path}`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as T;
    } catch (e) {
      errors.push(`${host}: ${(e as Error).message}`);
    }
  }
  throw new Error(`all mirrors failed: ${errors.join('; ')}`);
}
```

- [ ] **Step 4: Run** `npx vitest run tests/radio-browser.test.ts` → PASS.

- [ ] **Step 5: Скрипт снимка**

`scripts/snapshot.ts`:
```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dedupe, encode, toStation } from '../src/data/stations';
import type { Centroids, RawStation } from '../src/data/types';
import { fetchWithMirrors } from './radio-browser';

const require = createRequire(import.meta.url);
const countries = require('world-countries/countries.json') as { cca2: string; latlng: [number, number] }[];
const centroids: Centroids = Object.fromEntries(countries.map((c) => [c.cca2, c.latlng]));

const raw = await fetchWithMirrors<RawStation[]>('/json/stations/search?hidebroken=true&is_https=true&limit=200000&order=clickcount&reverse=true');
const stations = dedupe(raw.map((r) => toStation(r, centroids)).filter((s) => s !== null));

if (stations.length < 1000) throw new Error(`suspiciously few stations: ${stations.length}`);

const unknown = new Map<string, number>();
for (const r of raw) {
  if (r.language && toStation(r, centroids)?.langs.length === 0) {
    for (const n of r.language.split(',')) {
      const k = n.trim().toLowerCase();
      if (k) unknown.set(k, (unknown.get(k) ?? 0) + 1);
    }
  }
}

const generated = new Date().toISOString();
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/stations.json', JSON.stringify({ v: 1, generated, stations: stations.map(encode) }));
const meta = {
  generated,
  stations: stations.length,
  countries: new Set(stations.map((s) => s.cc)).size,
  languages: new Set(stations.flatMap((s) => s.langs)).size,
  approx: stations.filter((s) => s.approx).length,
  httpInOutput: stations.filter((s) => !s.url.startsWith('https://')).length,
  unknownLanguages: [...unknown].sort((a, b) => b[1] - a[1]).slice(0, 30),
};
writeFileSync('public/data/meta.json', JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 2));
```

- [ ] **Step 6: Запуск на реальных данных**

Run: `npm run snapshot`
Expected: печатается отчёт; `stations` > 1000, `httpInOutput: 0`; `public/data/stations.json` существует. Сохранить отчёт (числа станций/стран/языков) — это критерий приёмки этапа 2. Если в `unknownLanguages` есть частые названия реальных языков — добавить их в `NAME_TO_CODE` (Task 4) с тестом.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(data): daily snapshot script with mirror failover and report"
```

---

### Task 7: Загрузка станций в браузере

**Files:**
- Create: `src/data/load.ts`, `tests/load.test.ts`
- Modify: `src/app/main.ts`

**Interfaces:**
- Consumes: `decode` (Task 5), `ShellRefs.status` (Task 3), `I18n` (Task 2).
- Produces: `loadStations(baseUrl: string, fetchFn?: typeof fetch): Promise<Station[]>` — бросает `Error` при сетевой ошибке/неверном формате.

- [ ] **Step 1: Тесты**

`tests/load.test.ts`:
```ts
import { expect, test } from 'vitest';
import { loadStations } from '../src/data/load';

const row = ['u1', 'A', 'https://x', 1, 2, 0, 'PT', '', 'pt', 'pop', 3, 4, '', 0];

test('loads and decodes', async () => {
  const f = (async (url: string) => {
    expect(url).toBe('/base/data/stations.json');
    return new Response(JSON.stringify({ v: 1, generated: 'x', stations: [row] }));
  }) as unknown as typeof fetch;
  const list = await loadStations('/base/', f);
  expect(list[0]).toMatchObject({ id: 'u1', cc: 'PT', langs: ['pt'] });
});

test('rejects unknown format version', async () => {
  const f = (async () => new Response(JSON.stringify({ v: 2, stations: [] }))) as unknown as typeof fetch;
  await expect(loadStations('/', f)).rejects.toThrow(/format/);
});

test('rejects HTTP error', async () => {
  const f = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
  await expect(loadStations('/', f)).rejects.toThrow(/404/);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/data/load.ts`:
```ts
import { decode } from './stations';
import type { CompactStation, Station } from './types';

export async function loadStations(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<Station[]> {
  const r = await fetchFn(`${baseUrl}data/stations.json`);
  if (!r.ok) throw new Error(`stations HTTP ${r.status}`);
  const body = (await r.json()) as { v?: number; stations?: CompactStation[] };
  if (body.v !== 1 || !Array.isArray(body.stations)) throw new Error('unsupported stations format');
  return body.stations.map(decode);
}
```

`src/app/main.ts` целиком:
```ts
import ru from '../../locales/ru.json';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config';
import { applyDirection, createI18n, resolveLocale, type Messages } from '../i18n/i18n';
import { safeStorage } from '../i18n/storage';
import { renderShell } from '../ui/shell';
import { loadStations } from '../data/load';

const catalogs: Record<string, Messages> = { ru };
const locale = resolveLocale(location.search, safeStorage(), navigator.languages, SUPPORTED_LOCALES, DEFAULT_LOCALE);
const i18n = createI18n(locale, catalogs[locale]);
applyDirection(document, locale);
const refs = renderShell(document.getElementById('app')!, i18n);

refs.status.textContent = i18n.t('data.loading');
loadStations(import.meta.env.BASE_URL)
  .then((stations) => {
    refs.status.textContent = '';
    // Temporary debug handle until Plan 2 mounts the map.
    (window as unknown as { __stations: unknown }).__stations = stations;
  })
  .catch((e) => {
    console.error(e);
    refs.status.textContent = i18n.t('data.error');
  });
```

- [ ] **Step 4: Проверка**

Run: `npm test` → все PASS. Run: `npm run dev` → «Загружаем станции…» исчезает; в консоли `__stations.length` > 1000. Удалить `public/data/stations.json` → в центре появляется текст ошибки, страница не падает.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(data): load station snapshot in the browser with error state"
```

---

### Task 8: CI — ежедневный снимок и деплой на GitHub Pages + README

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

- [ ] **Step 1: Workflow**

`.github/workflows/deploy.yml`:
```yaml
name: build-and-deploy
on:
  push:
    branches: [main]
  schedule:
    - cron: '17 3 * * *'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run snapshot
      - run: npm run build
        env:
          BASE_PATH: /${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: README** — добавить разделы:
  - **Запуск локально:** `npm install`, `npm run snapshot`, `npm run dev`, `npm test`.
  - **Хостинг и почему GitHub Pages:** бесплатно, HTTPS, тот же GitHub Actions делает ежедневный снимок станций — один конвейер, без отдельного сервиса.
  - **Как обновить снимок:** сам раз в сутки; вручную — Actions → build-and-deploy → Run workflow.
  - **Как добавить язык интерфейса:** создать `locales/<код>.json` с теми же ключами, добавить код в `SUPPORTED_LOCALES` и в `catalogs` в `src/app/main.ts`.
  - **Почему без фреймворка:** экран — несколько независимых панелей вокруг canvas глобуса; vanilla TS + Vite даёт минимальный бандл для «первого показа < 3 с».

- [ ] **Step 3: Проверка**

Run: `npm test && npm run build` → PASS. Workflow проверяется после публикации репозитория (делает заказчик или с его подтверждения — это внешнее действие).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: daily snapshot + GitHub Pages deploy; README"
```
