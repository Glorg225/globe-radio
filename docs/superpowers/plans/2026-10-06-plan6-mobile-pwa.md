# План 6 — телефон, установка (PWA), доводка, сдача — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сайт удобен на телефоне по макету, ставится на главный экран, честно работает без интернета, доведён по доступности, и сдаётся с итоговым README.

**Architecture:** Телефонная вёрстка — CSS в `src/ui/mobile.css` (≤ 760 px) поверх существующей разметки + два новых элемента разметки (нижнее меню, кнопка «⋯» в плеере) и маленькие модули поведения (`mobile-nav`, `sheet`, `more-menu`). PWA — `vite-plugin-pwa` (generateSW, `registerType: 'prompt'`), логика установки, сети и обновления — в `src/pwa/*` с внедряемыми зависимостями (тестируются без браузера). Доводка — точечные правки модулей Плана 5.

**Tech Stack:** Vite 8 + TypeScript (vanilla), Vitest + jsdom, `vite-plugin-pwa` 2 + `workbox-window`, `@resvg/resvg-js` (иконки).

**Spec:** `docs/superpowers/specs/2026-10-06-plan6-mobile-pwa-design.md`

## Global Constraints
- Node: в каждой bash-команде `export PATH="/c/Program Files/nodejs:$PATH"`.
- В `src/` нет кириллицы (кроме `languages.ts`, `gazetteer.ts`, `ru-grammar.ts`); все строки интерфейса — в `locales/ru.json`; комментарии в коде — по-английски.
- Данные станций попадают в DOM только через `textContent` / `escapeHtml`.
- Телефон — `max-width: 760px` (константа `NARROW_QUERY = '(max-width: 760px)'`); планшет — 761–1100 px.
- Цвета только из `src/ui/tokens.css`; размеры телефона — из `03_design.md` §6.3 и `design/mockups/MobilePlayer.dc.html`: шапка 60, переключатель на 68 px от верха (кнопки 30), мини-плеер: отступы 8, высота 68, радиус 16, фон `--surface-mini-player`, рамка `--border-popover`, иконка 46, Play 48; нижнее меню 66 px, 4 колонки, полоска 22×3.
- Потоки радио, Radio Browser и Википедия **не** кешируются service worker'ом; `data/*.json` — `NetworkFirst`.
- Название приложения — только из `locales/ru.json` ключ `app.name` (один конфиг).
- Коммиты заканчиваются строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Строки с обратной косой чертой (регулярки) правятся инструментом Edit/Write, не через heredoc.

## Review Focus
1. **Открыта клавиатура на экране «Поиск»** (телефон 360×640) → поле и выдача видны, нижнее меню и мини-плеер не закрывают результаты (ручная проверка в Task 10, пункт 4).
2. **Установленное приложение открыто без сети, файл мест не загрузился** → видна плашка «Нет подключения к интернету», нажатие на станцию сразу даёт «Нет подключения — эфир недоступен», нет бесконечного «Загружаем…» (тест в Task 2).
3. **Сеть пропала и вернулась во время работы** → плашка появляется и исчезает сама, без перезагрузки (тест в Task 2).
4. **Сайт установлен из меню браузера (`appinstalled`) или плашка закрыта до прихода `beforeinstallprompt`** → кнопка в шапке и плашка больше не появляются (тест в Task 3).
5. **Короткое касание ручки шторки без перетаскивания** → шторка списка разворачивается/сворачивается, а не закрывается (тест в Task 5).

---

## File Structure
| Файл | Ответственность |
|---|---|
| `vite.config.ts` | подключение `vite-plugin-pwa` (manifest, precache, runtime caching) |
| `src/pwa/manifest.ts` | `buildManifest(base)`, `THEME_COLOR` |
| `scripts/icons.ts`, `public/icons/*` | иконки 192/512/maskable/apple-touch |
| `src/pwa/update.ts` | регистрация SW и подсказка «Доступна новая версия» |
| `src/pwa/network.ts` | состояние сети (`online/offline`) |
| `src/pwa/install.ts` | логика установки (Android-событие, iOS, визиты, «не показывать») |
| `src/ui/install-ui.ts` | кнопка «Установить» в шапке + плашка «Добавить на главный экран» |
| `src/ui/net-banner.ts` | плашка «Нет подключения к интернету» |
| `src/ui/toast.ts` | + `showActionToast` (уведомление с кнопкой) |
| `src/ui/mobile-nav.ts` | нижнее меню телефона |
| `src/ui/sheet.ts` | перетаскивание шторок (половина/полная/закрыть) |
| `src/ui/more-menu.ts` | меню «⋯» мини-плеера |
| `src/ui/mobile.css` | вся вёрстка телефона и планшета |
| `src/ui/shell.ts` | новые элементы и ссылки (`ShellRefs`) |
| `src/ui/player-bar.ts` | кнопка «⋯», строка «сон через N мин» |
| `src/place-card/place-card.ts` | смахивание шторки карточки |
| `src/ui/search-box.ts`, `sleep-menu.ts`, `share-card.ts`, `station-list.ts`, `src/share/share-link.ts` | доводка (раздел 6 спеки) |
| `src/app/app.ts`, `src/app/main.ts` | связка |
| `README.md` | итоговый |

---

### Task 1: Основа PWA — manifest, иконки, service worker

**Files:**
- Create: `src/pwa/manifest.ts`, `scripts/icons.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `public/icons/apple-touch-icon.png` (генерируются), `tests/pwa-manifest.test.ts`
- Modify: `package.json` (devDependencies `vite-plugin-pwa`, `workbox-window`; скрипт `icons`), `vite.config.ts`, `tsconfig.json` (`types` + `vite-plugin-pwa/client`), `index.html`, `locales/ru.json`

**Interfaces:**
- Produces: `THEME_COLOR = '#0A0F1E'`; `buildManifest(base: string): { name: string; short_name: string; description: string; lang: string; dir: string; start_url: string; scope: string; display: 'standalone'; orientation: 'portrait'; theme_color: string; background_color: string; icons: { src: string; sizes: string; type: string; purpose?: string }[] }`; виртуальный модуль `virtual:pwa-register` (используется в Task 2).

- [ ] **Step 1: Тексты** — в `locales/ru.json` добавить (все ключи Плана 6 сразу, перед закрывающей `}`):
```json
  "app.description": "Живое радио со всего мира на глобусе",
  "net.offline": "Нет подключения к интернету",
  "net.offlinePlay": "Нет подключения — эфир недоступен",
  "update.available": "Доступна новая версия",
  "update.reload": "Обновить",
  "install.banner": "Добавить «{name}» на главный экран",
  "install.ios": "Нажмите «Поделиться» → «На экран Домой», чтобы установить «{name}»",
  "install.button": "Установить",
  "install.close": "Больше не показывать",
  "nav.label": "Разделы",
  "nav.globe": "Глобус",
  "nav.search": "Поиск",
  "nav.favorites": "Избранное",
  "nav.learn": "Учу язык",
  "player.more": "Ещё: таймер сна, поделиться",
  "player.sleepIn": "В эфире · сон через {m} мин",
  "sheet.handle": "Развернуть или свернуть",
  "place.show": "Карточка места"
```

- [ ] **Step 2: Тест** — `tests/pwa-manifest.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { buildManifest, THEME_COLOR } from '../src/pwa/manifest';

const pngSize = (path: string) => { const b = readFileSync(path); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('manifest: name from the one config, standalone, dark theme, scope = site path', () => {
  const m = buildManifest('/globe-radio/');
  expect(m).toMatchObject({
    name: 'Радио планеты', short_name: 'Радио планеты', lang: 'ru', display: 'standalone', orientation: 'portrait',
    start_url: '/globe-radio/', scope: '/globe-radio/', theme_color: THEME_COLOR, background_color: THEME_COLOR,
  });
  expect(THEME_COLOR).toBe('#0A0F1E');
  expect(m.icons.filter((i) => i.purpose === 'maskable')).toHaveLength(1);
});

test('every manifest icon and the apple touch icon exist with the declared size', () => {
  for (const i of buildManifest('/').icons) {
    expect(pngSize(`public/${i.src}`)).toEqual(i.sizes.split('x').map(Number));
  }
  expect(pngSize('public/icons/apple-touch-icon.png')).toEqual([180, 180]);
});

test('index.html: apple touch icon, standalone meta tags', () => {
  const html = readFileSync('index.html', 'utf8');
  expect(html).toContain('rel="apple-touch-icon" href="/icons/apple-touch-icon.png"');
  expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
  expect(html).toContain('name="apple-mobile-web-app-title"');
});
```

- [ ] **Step 3: Run** `npx vitest run tests/pwa-manifest.test.ts` → FAIL (нет модуля).

- [ ] **Step 4: Реализация**

```bash
npm i -D vite-plugin-pwa workbox-window
npm pkg set scripts.icons="tsx scripts/icons.ts"
```

`src/pwa/manifest.ts`:
```ts
import ru from '../../locales/ru.json';

export const THEME_COLOR = '#0A0F1E';

// Web app manifest; the app name comes from the one config (locales/ru.json, key app.name).
export function buildManifest(base: string) {
  return {
    name: ru['app.name'],
    short_name: ru['app.name'],
    description: ru['app.description'],
    lang: 'ru',
    dir: 'ltr',
    start_url: base,
    scope: base,
    display: 'standalone' as const,
    orientation: 'portrait' as const,
    theme_color: THEME_COLOR,
    background_color: THEME_COLOR,
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ] as { src: string; sizes: string; type: string; purpose?: string }[],
  };
}
```

`scripts/icons.ts`:
```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

// Home-screen icons: the amber globe logo on the dark theme background (run once: npm run icons).
function icon(size: number, logoShare: number, radius: number): Buffer {
  const s = size * logoShare;
  const o = (size - s) / 2;
  const k = s / 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#0A0F1E"/>
  <g transform="translate(${o} ${o}) scale(${k})" fill="none" stroke="#FFB547" stroke-width="1.6" stroke-linecap="round">
    <circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17M3.5 15h17"/>
  </g>
</svg>`;
  return new Resvg(svg).render().asPng();
}

mkdirSync('public/icons', { recursive: true });
const files: [string, Buffer][] = [
  ['icon-192.png', icon(192, 0.7, 42)],
  ['icon-512.png', icon(512, 0.7, 112)],
  // Maskable: the logo stays inside the 80% safe zone, the background fills the whole square.
  ['maskable-512.png', icon(512, 0.5, 0)],
  ['apple-touch-icon.png', icon(180, 0.66, 0)],
];
for (const [name, png] of files) writeFileSync(`public/icons/${name}`, png);
console.log(`public/icons: ${files.map(([n]) => n).join(', ')}`);
```
Run: `npm run icons` → 4 файла.

`vite.config.ts` (целиком):
```ts
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { buildManifest } from './src/pwa/manifest';

const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: buildManifest(base),
      includeAssets: ['icons/apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        globIgnores: ['data/**', 'og.png'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/data\//],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/data/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'station-data', networkTimeoutSeconds: 6, expiration: { maxEntries: 300 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'jsdom' },
});
```

`tsconfig.json`: `"types": ["vite/client", "node", "vite-plugin-pwa/client"]`.

`index.html` — после `<meta name="theme-color" …>`:
```html
  <link rel="icon" type="image/png" href="/icons/icon-192.png">
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Радио планеты">
```
(Vite дописывает `base` к абсолютным путям файлов из `public/` при сборке.)

- [ ] **Step 5: Run** `npx vitest run && npx tsc --noEmit` → PASS. Затем `npm run build` и проверка:
```bash
ls dist/sw.js dist/manifest.webmanifest && grep -c '"url":"data/' dist/sw.js; grep -o 'manifest.webmanifest' dist/index.html
```
Expected: оба файла есть; `0` (данные не в precache); в `dist/index.html` есть ссылка на manifest.

- [ ] **Step 6: Commit** `feat(pwa): manifest, home-screen icons and service worker`

---

### Task 2: Сеть и обновления — плашка «Нет подключения», эфир без сети, «Доступна новая версия»

**Files:**
- Create: `src/pwa/network.ts`, `src/pwa/update.ts`, `src/ui/net-banner.ts`, `tests/pwa-network.test.ts`
- Modify: `src/ui/toast.ts`, `src/ui/shell.ts`, `src/ui/shell.css`, `src/app/app.ts`, `src/app/main.ts`, `tests/app.test.ts`, `tests/toast.test.ts`, `tests/shell.test.ts`

**Interfaces:**
- Consumes: `virtual:pwa-register` (Task 1).
- Produces:
  - `interface NetworkStatus { online(): boolean; subscribe(l: (online: boolean) => void): () => void }`; `createNetworkStatus(win: EventTarget & { navigator: { onLine: boolean } }): NetworkStatus`
  - `setupUpdates(d: { register(o: { onNeedRefresh(): void }): (reload?: boolean) => Promise<void>; show(onUpdate: () => void): void }): void`
  - `showActionToast(host: HTMLElement, text: string, action: { label: string; onClick(): void }): HTMLElement` (в `toast.ts`)
  - `bindNetBanner(el: HTMLElement, i18n: I18n, net: NetworkStatus): void`
  - `ShellRefs.netBanner: HTMLElement`, `ShellRefs.root: HTMLElement`
  - `AppDeps.network?: NetworkStatus`

- [ ] **Step 1: Тесты**

`tests/pwa-network.test.ts`:
```ts
import { expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import { createI18n } from '../src/i18n/i18n';
import { createNetworkStatus } from '../src/pwa/network';
import { setupUpdates } from '../src/pwa/update';
import { bindNetBanner } from '../src/ui/net-banner';

const fakeWin = (onLine: boolean) => Object.assign(new EventTarget(), { navigator: { onLine } });

test('network status follows online/offline events (review focus 3)', () => {
  const win = fakeWin(true);
  const net = createNetworkStatus(win);
  const seen: boolean[] = [];
  net.subscribe((o) => seen.push(o));
  expect(net.online()).toBe(true);
  win.navigator.onLine = false;
  win.dispatchEvent(new Event('offline'));
  expect(net.online()).toBe(false);
  win.navigator.onLine = true;
  win.dispatchEvent(new Event('online'));
  expect(seen).toEqual([false, true]);
});

test('offline banner shows and hides by itself', () => {
  const win = fakeWin(false);
  const el = document.createElement('div');
  bindNetBanner(el, createI18n('ru', ru), createNetworkStatus(win));
  expect(el.hidden).toBe(false);
  expect(el.textContent).toBe('Нет подключения к интернету');
  expect(el.getAttribute('role')).toBe('status');
  win.navigator.onLine = true;
  win.dispatchEvent(new Event('online'));
  expect(el.hidden).toBe(true);
});

test('update prompt: a new version offers reload, the button applies it', async () => {
  const update = vi.fn(async () => {});
  let need!: () => void;
  const show = vi.fn();
  setupUpdates({ register: (o) => { need = o.onNeedRefresh; return update; }, show });
  expect(show).not.toHaveBeenCalled();
  need();
  expect(show).toHaveBeenCalledTimes(1);
  (show.mock.calls[0] as [() => void])[0]();
  expect(update).toHaveBeenCalledWith(true);
});
```

В `tests/toast.test.ts` дописать:
```ts
test('action toast stays until the action or close is pressed', async () => {
  const { showActionToast } = await import('../src/ui/toast');
  document.body.innerHTML = '<main></main>';
  const host = document.querySelector('main')!;
  const onClick = vi.fn();
  const box = showActionToast(host, 'Доступна новая версия', { label: 'Обновить', onClick });
  expect(box.textContent).toContain('Доступна новая версия');
  (box.querySelector('button') as HTMLButtonElement).click();
  expect(onClick).toHaveBeenCalled();
  expect(host.contains(box)).toBe(false);
});
```
(если в файле нет импорта `vi` — добавить в строку импорта из `vitest`.)

В `tests/shell.test.ts` дописать:
```ts
test('offline banner slot and root are exposed', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.netBanner.hidden).toBe(true);
  expect(refs.root).toBe(root);
});
```

В `tests/app.test.ts` дописать:
```ts
function fakeNet(on: boolean) {
  const ls = new Set<(o: boolean) => void>();
  return { on, online() { return this.on; }, subscribe(l: (o: boolean) => void) { ls.add(l); return () => { ls.delete(l); }; }, set(o: boolean) { this.on = o; ls.forEach((l) => l(o)); } };
}

test('offline: picking a station says the stream is unavailable at once, nothing connects (review focus 2)', async () => {
  const net = fakeNet(false);
  const app = await startApp({ ...deps, network: net });
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(player.play).not.toHaveBeenCalled();
  expect(deps.refs.stage.textContent).toContain('Нет подключения — эфир недоступен');
  net.set(true);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(player.play).toHaveBeenCalled();
});

test('offline start with no cached places: error status, no endless loading (review focus 2)', async () => {
  await startApp({ ...deps, network: fakeNet(false), loadPlaces: async () => { throw new Error('offline'); } });
  expect(deps.refs.status.textContent).not.toBe('Загружаем станции…');
  expect(deps.refs.status.textContent).not.toBe('');
});
```

- [ ] **Step 2: Run** `npx vitest run tests/pwa-network.test.ts tests/toast.test.ts tests/shell.test.ts tests/app.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`src/pwa/network.ts`:
```ts
export interface NetworkStatus { online(): boolean; subscribe(l: (online: boolean) => void): () => void }

export function createNetworkStatus(win: EventTarget & { navigator: { onLine: boolean } }): NetworkStatus {
  const listeners = new Set<(online: boolean) => void>();
  const fire = () => { for (const l of listeners) l(win.navigator.onLine); };
  win.addEventListener('online', fire);
  win.addEventListener('offline', fire);
  return {
    online: () => win.navigator.onLine,
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
```

`src/pwa/update.ts`:
```ts
// A new service worker is waiting: offer a reload instead of switching versions under the listener.
export function setupUpdates(d: { register(o: { onNeedRefresh(): void }): (reload?: boolean) => Promise<void>; show(onUpdate: () => void): void }): void {
  const update = d.register({ onNeedRefresh: () => d.show(() => { void update(true); }) });
}
```

`src/ui/net-banner.ts`:
```ts
import type { I18n } from '../i18n/i18n';
import type { NetworkStatus } from '../pwa/network';

export function bindNetBanner(el: HTMLElement, i18n: I18n, net: NetworkStatus): void {
  el.setAttribute('role', 'status');
  el.textContent = i18n.t('net.offline');
  const apply = (online: boolean) => { el.hidden = online; };
  apply(net.online());
  net.subscribe(apply);
}
```

`src/ui/toast.ts` — дописать:
```ts
export function showActionToast(host: HTMLElement, text: string, action: { label: string; onClick(): void }): HTMLElement {
  const box = document.createElement('div');
  box.className = 'toast toast--action';
  box.setAttribute('role', 'status');
  const span = document.createElement('span');
  span.textContent = text;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toast__action';
  btn.textContent = action.label;
  btn.addEventListener('click', () => { box.remove(); action.onClick(); });
  box.append(span, btn);
  host.append(box);
  return box;
}
```

`src/ui/shell.ts`:
- после `<div class="learn-banner" hidden></div>` добавить `<div class="net-banner" hidden></div>`
- `ShellRefs` + `netBanner: HTMLElement; root: HTMLElement;`
- в возврате: `netBanner: q('.net-banner'), root,`

`src/ui/shell.css` — дописать:
```css
.net-banner { flex-shrink: 0; padding: 8px 16px; text-align: center; font-size: 14px; background: var(--surface-card); border-block-end: 1px solid var(--border-divider); color: var(--link); }
.toast--action { display: flex; align-items: center; gap: 12px; }
.toast__action { block-size: 32px; padding-inline: 12px; border-radius: 10px; border: 0; background: var(--accent); color: var(--on-accent); font-weight: 600; }
```

`src/app/app.ts`:
- импорт `import type { NetworkStatus } from '../pwa/network';`
- `AppDeps` + `network?: NetworkStatus;`
- в начале `playStation` (первой строкой функции):
```ts
    if (d.network && !d.network.online()) { showToast(refs.stage, t('net.offlinePlay')); return; }
```

`src/app/main.ts`:
```ts
import { registerSW } from 'virtual:pwa-register';
import { createNetworkStatus } from '../pwa/network';
import { setupUpdates } from '../pwa/update';
import { bindNetBanner } from '../ui/net-banner';
import { showActionToast } from '../ui/toast';
```
после `renderStarfield(refs.stars);`:
```ts
const network = createNetworkStatus(window);
bindNetBanner(refs.netBanner, i18n, network);
setupUpdates({
  register: (o) => registerSW({ onNeedRefresh: o.onNeedRefresh }),
  show: (onUpdate) => { showActionToast(refs.stage, i18n.t('update.available'), { label: i18n.t('update.reload'), onClick: onUpdate }); },
});
```
в `startApp({...})` — `network,`.

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(pwa): offline banner, no connecting while offline, update prompt`

---

### Task 3: Установка — кнопка в шапке, плашка «Добавить на главный экран», iPhone

**Files:**
- Create: `src/pwa/install.ts`, `src/ui/install-ui.ts`, `tests/install.test.ts`
- Modify: `src/ui/shell.ts` (ссылка `installButton`), `src/ui/mobile.css` (создаётся здесь; импорт в `shell.ts`), `src/app/app.ts`, `src/app/main.ts`, `tests/app.test.ts`

**Interfaces:**
- Produces:
  - `INSTALL_DISMISSED_KEY = 'installDismissed'`, `VISITS_KEY = 'visits'`
  - `type InstallMode = 'none' | 'prompt' | 'ios'`
  - `interface InstallState { mode(): InstallMode; showBanner(context: 'share' | 'normal'): boolean; install(): Promise<void>; dismiss(): void; subscribe(l: () => void): () => void }`
  - `createInstall(d: { win: EventTarget; storage: Storage | null; userAgent: string; standalone: boolean }): InstallState`
  - `createInstallUi(d: { button: HTMLButtonElement; host: HTMLElement; i18n: I18n; state: InstallState; narrow(): boolean }): { setContext(c: 'share' | 'normal'): void }`
  - `ShellRefs.installButton: HTMLButtonElement`; `AppDeps.installUi?: { setContext(c: 'share' | 'normal'): void }`; `AppDeps.narrow?(): boolean`

- [ ] **Step 1: Тест** — `tests/install.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import { createI18n } from '../src/i18n/i18n';
import { createInstall, INSTALL_DISMISSED_KEY, VISITS_KEY } from '../src/pwa/install';
import { createInstallUi } from '../src/ui/install-ui';

class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } }
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1';
const promptEvent = () => Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
  prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome: 'accepted' as const }),
});
let storage: Storage;
let win: EventTarget;
beforeEach(() => { storage = new Mem() as unknown as Storage; win = new EventTarget(); document.body.innerHTML = '<header><button class="install"></button></header><div id="host"></div>'; });

test('android: nothing until the browser offers install; then prompt; install calls the browser prompt', async () => {
  const s = createInstall({ win, storage, userAgent: ANDROID, standalone: false });
  expect(s.mode()).toBe('none');
  const e = promptEvent();
  win.dispatchEvent(e);
  expect(e.defaultPrevented).toBe(true);
  expect(s.mode()).toBe('prompt');
  await s.install();
  expect(e.prompt).toHaveBeenCalled();
  expect(s.mode()).toBe('none');
});

test('banner: on the share screen at once, otherwise from the second visit; dismiss hides it for good', () => {
  const first = createInstall({ win, storage, userAgent: ANDROID, standalone: false });
  win.dispatchEvent(promptEvent());
  expect(first.showBanner('share')).toBe(true);
  expect(first.showBanner('normal')).toBe(false);
  const second = createInstall({ win, storage, userAgent: ANDROID, standalone: false });
  win.dispatchEvent(promptEvent());
  expect(storage.getItem(VISITS_KEY)).toBe('2');
  expect(second.showBanner('normal')).toBe(true);
  second.dismiss();
  expect(storage.getItem(INSTALL_DISMISSED_KEY)).toBe('1');
  expect(second.showBanner('share')).toBe(false);
});

test('installed from the browser menu, or already standalone → nothing to offer (review focus 4)', () => {
  const s = createInstall({ win, storage, userAgent: ANDROID, standalone: false });
  win.dispatchEvent(promptEvent());
  win.dispatchEvent(new Event('appinstalled'));
  expect(s.mode()).toBe('none');
  win.dispatchEvent(promptEvent());
  expect(s.mode()).toBe('none');
  expect(createInstall({ win, storage, userAgent: IPHONE, standalone: true }).mode()).toBe('none');
});

test('iPhone Safari: instructions mode without a browser event', () => {
  expect(createInstall({ win, storage, userAgent: IPHONE, standalone: false }).mode()).toBe('ios');
});

test('ui: header button only when the browser can install; phone banner with text, install and close', async () => {
  storage.setItem(VISITS_KEY, '5');
  const s = createInstall({ win, storage, userAgent: ANDROID, standalone: false });
  const button = document.querySelector('.install') as HTMLButtonElement;
  const host = document.getElementById('host')!;
  let narrow = false;
  createInstallUi({ button, host, i18n: createI18n('ru', ru), state: s, narrow: () => narrow });
  expect(button.hidden).toBe(true);
  win.dispatchEvent(promptEvent());
  expect(button.hidden).toBe(false);
  expect(host.querySelector('.install-banner')).toBeNull();
  narrow = true;
  win.dispatchEvent(promptEvent());
  const banner = host.querySelector('.install-banner') as HTMLElement;
  expect(banner.textContent).toContain('Добавить «Радио планеты» на главный экран');
  (banner.querySelector('.install-banner__close') as HTMLButtonElement).click();
  expect(host.querySelector('.install-banner')).toBeNull();
  expect(storage.getItem(INSTALL_DISMISSED_KEY)).toBe('1');
});

test('ui: iPhone banner shows the instruction and no install button', () => {
  storage.setItem(VISITS_KEY, '5');
  const s = createInstall({ win, storage, userAgent: IPHONE, standalone: false });
  const host = document.getElementById('host')!;
  createInstallUi({ button: document.querySelector('.install') as HTMLButtonElement, host, i18n: createI18n('ru', ru), state: s, narrow: () => true });
  const banner = host.querySelector('.install-banner') as HTMLElement;
  expect(banner.textContent).toContain('На экран Домой');
  expect(banner.querySelector('.install-banner__go')).toBeNull();
});
```

В `tests/app.test.ts` дописать:
```ts
test('shared link switches the install banner to the share context and back', async () => {
  const ID = '96062a7b-0601-11e8-ae97-52543be04c81';
  shards.get.mockResolvedValue([{ ...st('x', 'c:1', 1, ['pt']), id: ID }]);
  const installUi = { setContext: vi.fn() };
  await startApp({ ...deps, installUi, narrow: () => true, location: { href: `https://u/?station=${ID}&c=PT`, search: `?station=${ID}&c=PT` } });
  await flush();
  expect(installUi.setContext).toHaveBeenLastCalledWith('share');
  expect(deps.refs.left.classList.contains('is-open')).toBe(false);
  (deps.refs.stage.querySelector('.share-card__globe') as HTMLButtonElement).click();
  expect(installUi.setContext).toHaveBeenLastCalledWith('normal');
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/pwa/install.ts`:
```ts
export const INSTALL_DISMISSED_KEY = 'installDismissed';
export const VISITS_KEY = 'visits';
export type InstallMode = 'none' | 'prompt' | 'ios';
export interface InstallState {
  mode(): InstallMode;
  showBanner(context: 'share' | 'normal'): boolean;
  install(): Promise<void>;
  dismiss(): void;
  subscribe(l: () => void): () => void;
}
interface PromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export function createInstall(d: { win: EventTarget; storage: Storage | null; userAgent: string; standalone: boolean }): InstallState {
  const read = (k: string) => { try { return d.storage?.getItem(k) ?? null; } catch { return null; } };
  const write = (k: string, v: string) => { try { d.storage?.setItem(k, v); } catch { /* unavailable */ } };
  const visits = (Number(read(VISITS_KEY)) || 0) + 1;
  write(VISITS_KEY, String(visits));
  const ios = /iPhone|iPad|iPod/.test(d.userAgent);
  let installed = d.standalone;
  let deferred: PromptEvent | null = null;
  const listeners = new Set<() => void>();
  const notify = () => { for (const l of listeners) l(); };

  d.win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    if (installed) return;
    deferred = e as PromptEvent;
    notify();
  });
  d.win.addEventListener('appinstalled', () => { installed = true; deferred = null; notify(); });

  const mode = (): InstallMode => (installed ? 'none' : deferred ? 'prompt' : ios ? 'ios' : 'none');
  return {
    mode,
    showBanner: (context) => mode() !== 'none' && read(INSTALL_DISMISSED_KEY) !== '1' && (context === 'share' || visits >= 2),
    async install() {
      const e = deferred;
      if (!e) return;
      deferred = null;
      await e.prompt();
      const choice = await e.userChoice;
      if (choice.outcome === 'accepted') installed = true;
      notify();
    },
    dismiss() { write(INSTALL_DISMISSED_KEY, '1'); notify(); },
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
```

`src/ui/install-ui.ts`:
```ts
import type { I18n } from '../i18n/i18n';
import type { InstallState } from '../pwa/install';
import { icons } from './icons';

export function createInstallUi(d: { button: HTMLButtonElement; host: HTMLElement; i18n: I18n; state: InstallState; narrow(): boolean }): { setContext(c: 'share' | 'normal'): void } {
  const { i18n, state } = d;
  let context: 'share' | 'normal' = 'normal';
  let banner: HTMLElement | null = null;
  d.button.addEventListener('click', () => { void state.install(); });

  function render() {
    d.button.hidden = state.mode() !== 'prompt';
    const want = d.narrow() && state.showBanner(context);
    if (!want) { banner?.remove(); banner = null; return; }
    banner?.remove();
    banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', i18n.t('install.button'));
    const name = i18n.t('app.name');
    const text = document.createElement('span');
    text.className = 'install-banner__text';
    text.textContent = state.mode() === 'ios' ? i18n.t('install.ios', { name }) : i18n.t('install.banner', { name });
    banner.innerHTML = icons.download;
    banner.append(text);
    if (state.mode() === 'prompt') {
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'install-banner__go';
      go.textContent = i18n.t('install.button');
      go.addEventListener('click', () => { void state.install(); });
      banner.append(go);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'install-banner__close';
    close.setAttribute('aria-label', i18n.t('install.close'));
    close.innerHTML = icons.x;
    close.addEventListener('click', () => state.dismiss());
    banner.append(close);
    d.host.append(banner);
  }
  state.subscribe(render);
  render();
  return { setContext(c) { context = c; render(); } };
}
```

`src/ui/shell.ts`:
- `import './mobile.css';` после `import './conveniences.css';`
- `ShellRefs` + `installButton: HTMLButtonElement;`; в возврате `installButton: q<HTMLButtonElement>('[data-action="install"]'),`

`src/ui/mobile.css` (создать; дополняется в Tasks 4–7):
```css
/* Phone and tablet layout (Plan 6). Desktop styles live in shell.css. */
.install-banner { position: fixed; z-index: 25; inset-inline: 16px; inset-block-end: 150px; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: var(--r-card); background: var(--surface-card); border: 1px solid var(--border-control); font-size: 13px; color: var(--star); }
.install-banner__text { flex: 1; }
.install-banner__go { block-size: 36px; padding-inline: 12px; border-radius: 10px; border: 1px solid var(--border-popover); background: transparent; color: var(--text); font-size: 13px; }
.install-banner__close { inline-size: 32px; block-size: 32px; border: 0; background: transparent; color: var(--text-muted); display: flex; align-items: center; justify-content: center; }
```

`src/app/app.ts`:
- `AppDeps` + `installUi?: { setContext(c: 'share' | 'normal'): void }; narrow?(): boolean;`
- в `openShared()` после `void selectPlace(found.place);` вставить:
```ts
    if (d.narrow?.()) refs.left.classList.remove('is-open');
    d.installUi?.setContext('share');
```
- в `showShareCard(...)` обработчики:
```ts
      onListen: () => { d.installUi?.setContext('normal'); void playStation(found.station, found.place); },
      onClose: () => { d.installUi?.setContext('normal'); },
```

`src/app/main.ts`:
```ts
import { createInstall } from '../pwa/install';
import { createInstallUi } from '../ui/install-ui';
```
после `bindNetBanner(...)`:
```ts
const narrowQuery = matchMedia('(max-width: 760px)');
const installUi = createInstallUi({
  button: refs.installButton,
  host: refs.root,
  i18n,
  state: createInstall({ win: window, storage, userAgent: navigator.userAgent, standalone: matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true }),
  narrow: () => narrowQuery.matches,
});
```
в `startApp({...})`: `installUi, narrow: () => narrowQuery.matches,`

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(pwa): install button, add-to-home-screen banner, iPhone instructions`

---

### Task 4: Телефон — шапка, нижнее меню, экран «Поиск»

**Files:**
- Create: `src/ui/mobile-nav.ts`, `tests/mobile-nav.test.ts`
- Modify: `src/ui/shell.ts`, `src/ui/shell.css` (убрать временный блок `@media (max-width: 760px)` для шапки), `src/ui/mobile.css`, `src/app/app.ts`, `tests/shell.test.ts`, `tests/app.test.ts`

**Interfaces:**
- Consumes: `setTab` (app), `refs.learnButton`, `refs.searchInput`, `ShellRefs.root` (Task 2).
- Produces:
  - `type NavTab = 'globe' | 'search' | 'favorites'`
  - `interface MobileNavDeps { onGlobe(): void; onSearch(): void; onFavorites(): void; onLearn(): void }`
  - `interface MobileNav { set(tab: NavTab): void; setLearning(on: boolean): void }`; `createMobileNav(buttons: HTMLButtonElement[], d: MobileNavDeps): MobileNav`
  - `ShellRefs.navButtons: HTMLButtonElement[]` (кнопки с `data-nav="globe|search|favorites|learn"`)
  - в app: внутренние `closeSearch()`, `closeSheet()` и `nav: MobileNav` (используются в Tasks 5–6)

- [ ] **Step 1: Тесты**

`tests/mobile-nav.test.ts`:
```ts
import { expect, test, vi } from 'vitest';
import { createMobileNav } from '../src/ui/mobile-nav';

const make = () => {
  document.body.innerHTML = ['globe', 'search', 'favorites', 'learn'].map((n) => `<button data-nav="${n}"><span class="mobile-nav__bar"></span></button>`).join('');
  const buttons = [...document.querySelectorAll('button')] as HTMLButtonElement[];
  const d = { onGlobe: vi.fn(), onSearch: vi.fn(), onFavorites: vi.fn(), onLearn: vi.fn() };
  return { buttons, d, nav: createMobileNav(buttons, d) };
};

test('starts on the globe; set marks one tab as current', () => {
  const { buttons, nav } = make();
  expect(buttons[0].getAttribute('aria-current')).toBe('page');
  nav.set('favorites');
  expect(buttons[2].classList.contains('is-active')).toBe(true);
  expect(buttons[0].hasAttribute('aria-current')).toBe(false);
});

test('each button calls its action; learning marks the learn tab', () => {
  const { buttons, d, nav } = make();
  buttons.forEach((b) => b.click());
  expect([d.onGlobe, d.onSearch, d.onFavorites, d.onLearn].every((f) => f.mock.calls.length === 1)).toBe(true);
  nav.setLearning(true);
  expect(buttons[3].classList.contains('is-learning')).toBe(true);
});
```

В `tests/shell.test.ts` дописать:
```ts
test('phone nav has four sections in mockup order', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.navButtons.map((b) => b.dataset.nav)).toEqual(['globe', 'search', 'favorites', 'learn']);
  expect(refs.navButtons.map((b) => b.textContent)).toEqual(['Глобус', 'Поиск', 'Избранное', 'Учу язык']);
  expect(root.querySelector('.mobile-nav')!.getAttribute('aria-label')).toBe('Разделы');
});
```

В `tests/app.test.ts` дописать:
```ts
const navBtn = (n: string) => deps.refs.navButtons.find((b) => b.dataset.nav === n)!;

test('phone nav: search opens the search screen; a picked place returns to the globe', async () => {
  await startApp(deps);
  navBtn('search').click();
  expect(deps.refs.root.classList.contains('is-searching')).toBe(true);
  expect(document.activeElement).toBe(deps.refs.searchInput);
  expect(navBtn('search').getAttribute('aria-current')).toBe('page');
  deps.refs.searchInput.value = 'ра';
  deps.refs.searchInput.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  (document.querySelector('.search-pop__item') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.root.classList.contains('is-searching')).toBe(false);
  expect(navBtn('globe').getAttribute('aria-current')).toBe('page');
});

test('phone nav: favorites opens the saved list, globe closes it, learn opens the picker and marks learning', async () => {
  const app = await startApp(deps);
  navBtn('favorites').click();
  expect(deps.refs.left.classList.contains('is-open')).toBe(true);
  expect(deps.refs.tabs[1].classList.contains('is-active')).toBe(true);
  navBtn('globe').click();
  expect(deps.refs.left.classList.contains('is-open')).toBe(false);
  navBtn('learn').click();
  expect(document.querySelector('.learn-pop')).not.toBeNull();
  app.learn('en');
  expect(navBtn('learn').classList.contains('is-learning')).toBe(true);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/mobile-nav.test.ts tests/shell.test.ts tests/app.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`src/ui/mobile-nav.ts`:
```ts
export type NavTab = 'globe' | 'search' | 'favorites';
export interface MobileNavDeps { onGlobe(): void; onSearch(): void; onFavorites(): void; onLearn(): void }
export interface MobileNav { set(tab: NavTab): void; setLearning(on: boolean): void }

// Phone bottom menu: Globe / Search / Favorites / Learn (Learn opens the language list, it is not a tab).
export function createMobileNav(buttons: HTMLButtonElement[], d: MobileNavDeps): MobileNav {
  const actions: Record<string, () => void> = { globe: d.onGlobe, search: d.onSearch, favorites: d.onFavorites, learn: d.onLearn };
  for (const b of buttons) b.addEventListener('click', () => actions[b.dataset.nav ?? '']?.());
  const nav: MobileNav = {
    set(tab) {
      for (const b of buttons) {
        const on = b.dataset.nav === tab;
        b.classList.toggle('is-active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      }
    },
    setLearning(on) { buttons.find((b) => b.dataset.nav === 'learn')?.classList.toggle('is-learning', on); },
  };
  nav.set('globe');
  return nav;
}
```

`src/ui/shell.ts` — после `<footer class="shell__player"></footer>`:
```ts
    <nav class="mobile-nav" aria-label="${t('nav.label')}">
      <button type="button" data-nav="globe"><span class="mobile-nav__bar"></span><span>${t('nav.globe')}</span></button>
      <button type="button" data-nav="search"><span class="mobile-nav__bar"></span><span>${t('nav.search')}</span></button>
      <button type="button" data-nav="favorites"><span class="mobile-nav__bar"></span><span>${t('nav.favorites')}</span></button>
      <button type="button" data-nav="learn"><span class="mobile-nav__bar"></span><span>${t('nav.learn')}</span></button>
    </nav>
```
`ShellRefs` + `navButtons: HTMLButtonElement[];`; возврат `navButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-nav]')],`.

`src/ui/shell.css` — удалить блок
```css
/* Temporary narrow-screen fallback until Plan 6 (mobile layout per mockup): no horizontal scroll */
@media (max-width: 1100px) { .shell__place { display: none; } }
@media (max-width: 760px) {
  .search, .btn span, .logo__text, .spacer { display: none; }
  ...
}
```
**только** часть `@media (max-width: 760px) { … }` для шапки (строка `@media (max-width: 1100px) { .shell__place … }` удаляется в Task 7).

`src/ui/mobile.css` — дописать:
```css
.mobile-nav { display: none; }
@media (max-width: 760px) {
  .shell { block-size: 100dvh; }
  .shell__header { block-size: 60px; gap: 8px; padding-inline: 16px 12px; }
  .logo { inline-size: auto; flex: 1; gap: 8px; }
  .logo svg { inline-size: 26px; block-size: 26px; }
  .logo__text { font-size: 16px; }
  .shell__header .search, .shell__header .spacer, .shell__header [data-action="learn"], .shell__header [data-action="install"] { display: none; }
  .shell__header [data-action="surprise"] { inline-size: 44px; block-size: 44px; padding: 0; justify-content: center; border-radius: 12px; }
  .shell__header [data-action="surprise"] span { display: none; }
  .shell__header .segment { position: fixed; z-index: 6; inset-block-start: 68px; inset-inline-start: 50%; transform: translateX(-50%); padding: 3px; border-radius: 10px; }
  .shell__header .segment button { block-size: 30px; padding-inline: 14px; border-radius: 8px; font-size: 13px; }
  .stage__zoom { display: none; }
  .stage__attribution { inset-block-start: 108px; inset-block-end: auto; inset-inline: 16px; max-inline-size: none; text-align: center; font-size: 11px; }
  .mobile-nav { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); position: fixed; z-index: 12; inset-inline: 0; inset-block-end: 0; block-size: 66px; background: var(--surface); border-block-start: 1px solid var(--border-divider); }
  .mobile-nav button { border: 0; background: transparent; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 12px; }
  .mobile-nav__bar { inline-size: 22px; block-size: 3px; border-radius: 2px; background: transparent; }
  .mobile-nav button.is-active { color: var(--text); }
  .mobile-nav button.is-active .mobile-nav__bar { background: var(--accent); }
  .mobile-nav button.is-learning .mobile-nav__bar { background: var(--teal); }
  .shell.is-searching .shell__header .search { display: flex; position: fixed; z-index: 20; inset-block-start: 0; inset-inline: 0; block-size: 60px; max-inline-size: none; border-radius: 0; border-width: 0 0 1px; background: var(--surface); padding-inline: 16px; }
  .shell.is-searching .search-pop { position: fixed; inset-block: 60px 66px; inset-inline: 0; inline-size: auto; max-block-size: none; border-radius: 0; border-width: 0; }
  .learn-pop { position: fixed; z-index: 20; inset-block: 68px 74px; inset-inline: 8px; }
}
```

`src/app/app.ts`:
- импорт `import { createMobileNav } from '../ui/mobile-nav';`
- сразу после строки `for (const b of refs.tabs) b.addEventListener('click', () => setTab(b.dataset.tab as PanelTab));`:
```ts
  // Phone: bottom menu, search screen and the list sheet.
  const closeSearch = () => refs.root.classList.remove('is-searching');
  const closeSheet = () => refs.left.classList.remove('is-open', 'is-full');
  const nav = createMobileNav(refs.navButtons, {
    onGlobe: () => { closeSearch(); closeSheet(); nav.set('globe'); },
    onSearch: () => { closeSheet(); refs.root.classList.add('is-searching'); refs.searchInput.focus(); nav.set('search'); },
    onFavorites: () => { closeSearch(); setTab('favorites'); nav.set('favorites'); },
    onLearn: () => { closeSearch(); refs.learnButton.click(); },
  });
  refs.closePanel.addEventListener('click', () => nav.set('globe'));
```
- в `selectPlace` после `showTab('here');`: `nav.set('globe');`
- в `applyLearn` после `picker?.update();`: `nav.setLearning(!!entry);`
- в `createSearchBox(..., { ... })`: в начало `onPlace` и `onStation` добавить `closeSearch(); nav.set('globe');`

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(mobile): phone header, bottom menu and search screen`

---

### Task 5: Шторки — список места (половина/полная), карточка места смахивается

**Files:**
- Create: `src/ui/sheet.ts`, `tests/sheet.test.ts`
- Modify: `src/ui/shell.ts` (ручка шторки), `src/ui/shell.css` (убрать мобильные правила `.shell__left`/`.panel-close`), `src/ui/mobile.css`, `src/place-card/place-card.ts`, `src/place-card/place-card.css`, `src/app/app.ts`, `tests/place-card.test.ts`, `tests/app.test.ts`

**Interfaces:**
- Consumes: `closeSheet`, `nav` (Task 4), `AppDeps.narrow` (Task 3).
- Produces: `SHEET_DRAG_PX = 40`; `attachSheetDrag(sheet: HTMLElement, handle: HTMLElement, o: { expandable: boolean; onClose(): void }): () => void`; `ShellRefs.sheetHandle: HTMLElement`.

- [ ] **Step 1: Тесты**

`tests/sheet.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest';
import { attachSheetDrag } from '../src/ui/sheet';

let sheet: HTMLElement;
let handle: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<section><div class="h" tabindex="0"></div></section>';
  sheet = document.querySelector('section')!;
  handle = document.querySelector('.h')!;
});
const drag = (from: number, to: number) => {
  handle.dispatchEvent(new MouseEvent('pointerdown', { clientY: from, bubbles: true }));
  document.dispatchEvent(new MouseEvent('pointerup', { clientY: to, bubbles: true }));
};

test('expandable: up → full, down → half, down from half → close', () => {
  const onClose = vi.fn();
  attachSheetDrag(sheet, handle, { expandable: true, onClose });
  drag(400, 300);
  expect(sheet.classList.contains('is-full')).toBe(true);
  expect(handle.getAttribute('aria-expanded')).toBe('true');
  drag(300, 400);
  expect(sheet.classList.contains('is-full')).toBe(false);
  expect(onClose).not.toHaveBeenCalled();
  drag(300, 400);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('a short tap toggles size and never closes (review focus 5)', () => {
  const onClose = vi.fn();
  attachSheetDrag(sheet, handle, { expandable: true, onClose });
  drag(400, 395);
  expect(sheet.classList.contains('is-full')).toBe(true);
  drag(400, 410);
  expect(sheet.classList.contains('is-full')).toBe(false);
  expect(onClose).not.toHaveBeenCalled();
});

test('keyboard: Enter toggles, Escape closes', () => {
  const onClose = vi.fn();
  attachSheetDrag(sheet, handle, { expandable: true, onClose });
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(sheet.classList.contains('is-full')).toBe(true);
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(onClose).toHaveBeenCalled();
});

test('not expandable: swipe down closes, tap does nothing; detach removes listeners', () => {
  const onClose = vi.fn();
  const off = attachSheetDrag(sheet, handle, { expandable: false, onClose });
  drag(400, 398);
  expect(onClose).not.toHaveBeenCalled();
  expect(sheet.classList.contains('is-full')).toBe(false);
  drag(300, 400);
  expect(onClose).toHaveBeenCalledTimes(1);
  off();
  drag(300, 400);
  expect(onClose).toHaveBeenCalledTimes(1);
});
```

В `tests/place-card.test.ts` дописать:
```ts
test('phone sheet: swipe down hides it; the next station shows it again', async () => {
  const card = createPlaceCard(panel, stage, deps);
  card.show({ place: lisbon, station: st(), info });
  await flush();
  const sheet = stage.querySelector('.pc-sheet') as HTMLElement;
  const handle = sheet.querySelector('.pcs__handle') as HTMLElement;
  expect(handle.getAttribute('role')).toBe('button');
  handle.dispatchEvent(new MouseEvent('pointerdown', { clientY: 300, bubbles: true }));
  document.dispatchEvent(new MouseEvent('pointerup', { clientY: 400, bubbles: true }));
  expect(sheet.hidden).toBe(true);
  card.show({ place: lisbon, station: { ...st(), id: 's2' }, info });
  expect(sheet.hidden).toBe(false);
});
```

В `tests/app.test.ts` дописать:
```ts
test('phone: picking a station closes the list sheet so the place card shows; the handle can close it', async () => {
  const app = await startApp({ ...deps, narrow: () => true });
  await app.selectPlace(lisbon);
  expect(deps.refs.left.classList.contains('is-open')).toBe(true);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.left.classList.contains('is-open')).toBe(false);
  expect(player.play).toHaveBeenCalled();
  await app.selectPlace(lisbon);
  deps.refs.sheetHandle.dispatchEvent(new MouseEvent('pointerdown', { clientY: 300, bubbles: true }));
  document.dispatchEvent(new MouseEvent('pointerup', { clientY: 400, bubbles: true }));
  expect(deps.refs.left.classList.contains('is-open')).toBe(false);
});

test('desktop: picking a station keeps the list open', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.left.classList.contains('is-open')).toBe(true);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/ui/sheet.ts`:
```ts
export const SHEET_DRAG_PX = 40;

// Bottom sheet handle: drag up → full height, drag down → half (or close from half), tap → toggle size.
export function attachSheetDrag(sheet: HTMLElement, handle: HTMLElement, o: { expandable: boolean; onClose(): void }): () => void {
  let startY: number | null = null;
  const setFull = (on: boolean) => {
    sheet.classList.toggle('is-full', on);
    if (o.expandable) handle.setAttribute('aria-expanded', String(on));
  };
  const onDown = (e: Event) => { startY = (e as MouseEvent).clientY; };
  const onUp = (e: Event) => {
    if (startY === null) return;
    const dy = (e as MouseEvent).clientY - startY;
    startY = null;
    if (dy > SHEET_DRAG_PX) {
      if (sheet.classList.contains('is-full')) setFull(false); else o.onClose();
      return;
    }
    if (!o.expandable) return;
    if (dy < -SHEET_DRAG_PX) setFull(true);
    else setFull(!sheet.classList.contains('is-full'));
  };
  const onKey = (e: Event) => {
    const key = (e as KeyboardEvent).key;
    if (key === 'Escape') { o.onClose(); return; }
    if (key !== 'Enter' && key !== ' ') return;
    e.preventDefault();
    if (o.expandable) setFull(!sheet.classList.contains('is-full')); else o.onClose();
  };
  if (o.expandable) handle.setAttribute('aria-expanded', 'false');
  handle.addEventListener('pointerdown', onDown);
  document.addEventListener('pointerup', onUp);
  handle.addEventListener('keydown', onKey);
  return () => {
    handle.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointerup', onUp);
    handle.removeEventListener('keydown', onKey);
  };
}
```

`src/ui/shell.ts`:
- первым элементом внутри `<aside class="shell__left">`: `<div class="sheet__handle" role="button" tabindex="0" aria-label="${t('sheet.handle')}"></div>`
- `ShellRefs` + `sheetHandle: HTMLElement;`; возврат `sheetHandle: q('.sheet__handle'),`

`src/ui/shell.css` — в блоке `@media (max-width: 760px) { … }` у плеера удалить строки `.shell__left { … }`, `.shell__left.is-open { transform: none; }`, `.panel-close { display: inline-flex; }` (их заменяет `mobile.css`).

`src/ui/mobile.css` — дописать:
```css
.sheet__handle { display: none; }
@media (max-width: 760px) {
  .sheet__handle { display: block; position: relative; flex-shrink: 0; inline-size: 40px; block-size: 4px; border-radius: 2px; background: var(--border-popover); margin: 10px auto 2px; touch-action: none; }
  .sheet__handle::before { content: ''; position: absolute; inset: -14px -40px; }
  .shell__left { display: flex; position: fixed; z-index: 10; inset-inline: 0; inset-block-end: 66px; block-size: 50dvh; inline-size: auto; border-radius: 22px 22px 0 0; border: 1px solid var(--border-card); background: var(--surface-raised); transform: translateY(calc(100% + 66px)); transition: transform .25s ease-out, block-size .25s ease-out; }
  .shell__left.is-open { transform: none; }
  .shell__left.is-full { block-size: calc(100dvh - 60px - 66px); }
  .panel-close { display: inline-flex; }
  .pcs__handle { position: relative; touch-action: none; }
  .pcs__handle::before { content: ''; position: absolute; inset: -14px -40px; }
}
```

`src/place-card/place-card.css`: в `.pc-sheet:not([hidden]) { … inset-block-end: 68px; … }` заменить `68px` на `150px` (над мини-плеером).

`src/place-card/place-card.ts`:
- импорт `import { attachSheetDrag } from '../ui/sheet';`
- в разметке шторки `<div class="pcs__handle"></div>` → `<div class="pcs__handle" role="button" tabindex="0" aria-label="${t('place.collapse')}"></div>`
- после `sheetHost.append(sheet);`: `const detachDrag = attachSheetDrag(sheet, sheet.querySelector<HTMLElement>('.pcs__handle')!, { expandable: false, onClose: () => { sheet.hidden = true; } });`
- в `show(d)` сразу после блока `if (!d) { … return; }`: `sheet.hidden = false;`
- в `destroy()`: `detachDrag();`

`src/app/app.ts`:
- импорт `import { attachSheetDrag } from '../ui/sheet';`
- после создания `nav` (Task 4): `attachSheetDrag(refs.left, refs.sheetHandle, { expandable: true, onClose: () => { closeSheet(); nav.set('globe'); } });`
- в `renderList` → `renderStationList(...)` заменить `onPick: (s) => { void playStation(s, place); },` на:
```ts
        onPick: (s) => { if (d.narrow?.()) { closeSheet(); nav.set('globe'); } void playStation(s, place); },
```
- в `renderTab` → `renderSavedList(...)` заменить `onPick: (item) => { void playSaved(item); },` на:
```ts
      onPick: (item) => { if (d.narrow?.()) { closeSheet(); nav.set('globe'); } void playSaved(item); },
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(mobile): draggable list sheet, swipe-down place card sheet`

---

### Task 6: Мини-плеер — «⋯», «В эфире · сон через N мин»

**Files:**
- Create: `src/ui/more-menu.ts`, `tests/more-menu.test.ts`
- Modify: `src/ui/icons.ts`, `src/ui/player-bar.ts`, `src/ui/shell.css` (убрать оставшиеся мобильные правила плеера), `src/ui/mobile.css`, `src/ui/conveniences.css`, `src/app/app.ts`, `tests/player-extras.test.ts`, `tests/app.test.ts`

**Interfaces:**
- Produces:
  - `interface MenuItem { label: string; onClick(): void }`; `openMoreMenu(anchor: HTMLElement, label: string, items: MenuItem[]): { close(): void }` (повторный вызов с тем же `anchor` закрывает меню)
  - `PlayerBarHandlers` + `onMore?(anchor: HTMLElement): void`; `PlayerBarView` + `sleepMinutes?: number`
  - `icons.more`

- [ ] **Step 1: Тесты**

`tests/more-menu.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest';
import { openMoreMenu } from '../src/ui/more-menu';

let anchor: HTMLButtonElement;
beforeEach(() => { document.body.innerHTML = '<footer><button class="more"></button></footer>'; anchor = document.querySelector('.more')!; });

test('lists items as a menu, runs the picked one and closes', () => {
  const a = vi.fn();
  openMoreMenu(anchor, 'Ещё', [{ label: 'Таймер сна', onClick: a }, { label: 'Поделиться', onClick: vi.fn() }]);
  const menu = document.querySelector('.more-menu') as HTMLElement;
  expect(menu.getAttribute('role')).toBe('menu');
  expect([...menu.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent)).toEqual(['Таймер сна', 'Поделиться']);
  expect(document.activeElement).toBe(menu.querySelector('button'));
  (menu.querySelector('button') as HTMLButtonElement).click();
  expect(a).toHaveBeenCalled();
  expect(document.querySelector('.more-menu')).toBeNull();
});

test('arrows move focus, Escape closes and returns focus, same anchor toggles', () => {
  openMoreMenu(anchor, 'Ещё', [{ label: 'A', onClick() {} }, { label: 'B', onClick() {} }]);
  const items = [...document.querySelectorAll('.more-menu button')] as HTMLButtonElement[];
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  expect(document.activeElement).toBe(items[1]);
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(document.querySelector('.more-menu')).toBeNull();
  expect(document.activeElement).toBe(anchor);
  openMoreMenu(anchor, 'Ещё', [{ label: 'A', onClick() {} }]);
  openMoreMenu(anchor, 'Ещё', [{ label: 'A', onClick() {} }]);
  expect(document.querySelector('.more-menu')).toBeNull();
});
```

В `tests/player-extras.test.ts` дописать:
```ts
test('mini-player: "more" button opens with a station; sleep line replaces the place line', () => {
  const onMore = vi.fn();
  const bar = createPlayerBar(el, i18n, { onToggle() {}, onNext() {}, onVolume() {}, onMute() {}, onMore });
  bar.render({ state: { kind: 'idle' }, place: '', volume: 1, muted: false });
  expect(q('.pb__more').disabled).toBe(true);
  expect(q('.pb__more').getAttribute('aria-label')).toBe('Ещё: таймер сна, поделиться');
  bar.render({ state: { kind: 'playing', station }, place: 'Лиссабон, Португалия', volume: 1, muted: false, sleepMinutes: 30 });
  q('.pb__more').click();
  expect(onMore).toHaveBeenCalledWith(q('.pb__more'));
  expect(el.classList.contains('has-sleep')).toBe(true);
  expect(el.querySelector('.pb__sleepin')!.textContent).toBe('В эфире · сон через 30 мин');
  bar.render({ state: { kind: 'paused', station }, place: 'X', volume: 1, muted: false, sleepMinutes: 30 });
  expect(el.classList.contains('has-sleep')).toBe(false);
});
```

В `tests/app.test.ts` дописать:
```ts
test('mini-player "more" menu: sleep, share and favorite', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  const more = deps.refs.player.querySelector('.pb__more') as HTMLButtonElement;
  more.click();
  const labels = [...document.querySelectorAll('.more-menu button')].map((b) => b.textContent);
  expect(labels).toEqual(['Сон', 'Поделиться', 'В избранное']);
  ([...document.querySelectorAll('.more-menu button')][2] as HTMLButtonElement).click();
  expect(deps.library.isFavorite('a')).toBe(true);
  more.click();
  ([...document.querySelectorAll('.more-menu button')][0] as HTMLButtonElement).click();
  expect(document.querySelector('.sleep-menu')).not.toBeNull();
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/ui/icons.ts` — в объект `icons`:
```ts
  more: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
```

`src/ui/more-menu.ts`:
```ts
export interface MenuItem { label: string; onClick(): void }

let open: { anchor: HTMLElement; close(): void } | null = null;

// Small popup menu (mini-player "more"); pressing the same button again closes it.
export function openMoreMenu(anchor: HTMLElement, label: string, items: MenuItem[]): { close(): void } {
  const wasOpen = open;
  wasOpen?.close();
  if (wasOpen?.anchor === anchor) return { close() {} };
  const menu = document.createElement('div');
  menu.className = 'more-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', label);
  const buttons = items.map((it) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.textContent = it.label;
    b.addEventListener('click', () => { close(); it.onClick(); });
    menu.append(b);
    return b;
  });
  const onKey = (e: KeyboardEvent) => {
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { close(); anchor.focus(); return; }
    if (e.key === 'Tab') { close(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    }
  };
  const onOutside = (e: MouseEvent) => { if (!menu.contains(e.target as Node) && !anchor.contains(e.target as Node)) close(); };
  function close() {
    if (open?.close === close) open = null;
    menu.remove();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('mousedown', onOutside);
  }
  open = { anchor, close };
  anchor.insertAdjacentElement('afterend', menu);
  document.addEventListener('keydown', onKey);
  document.addEventListener('mousedown', onOutside);
  buttons[0]?.focus();
  return { close };
}
```

`src/ui/player-bar.ts`:
- `PlayerBarHandlers` + `onMore?(anchor: HTMLElement): void;`; `PlayerBarView` + `sleepMinutes?: number;`
- в разметке `pb__meta`: `<div class="pb__meta"><span class="pb__live"></span><span class="pb__status"></span><span class="pb__sleepin"></span></div>`
- в `pb__center` перед `<button class="pb__play"></button>`: `<button class="pb__more" type="button" aria-label="${t('player.more')}">${icons.more}</button>`
- после объявления `share`:
```ts
  const more = q<HTMLButtonElement>('.pb__more');
  const sleepIn = q<HTMLSpanElement>('.pb__sleepin');
  more.addEventListener('click', () => h.onMore?.(more));
```
- `render({ …, sleepMinutes })` — в конце:
```ts
      more.disabled = !h.onMore || !station;
      const sleeping = state.kind === 'playing' && sleepMinutes !== undefined;
      host.classList.toggle('has-sleep', sleeping);
      sleepIn.textContent = sleeping ? i18n.t('player.sleepIn', { m: sleepMinutes }) : '';
```

`src/ui/shell.css` — удалить оставшиеся мобильные/планшетные правила плеера:
```css
@media (max-width: 1100px) {
  .pb__right .pb__sleep, .pb__right .pb__share { display: none; }
}
@media (max-width: 760px) {
  .shell__player { … } … .pb__next { … }
}
```
(весь этот блок; планшет получает свои правила в Task 7, телефон — ниже).

`src/ui/conveniences.css` — дописать (меню «⋯» в стиле меню сна):
```css
.more-menu { position: absolute; z-index: 20; inset-block-end: 56px; display: flex; flex-direction: column; padding: 6px; border-radius: var(--r-card); background: var(--surface-raised); border: 1px solid var(--border-popover); }
.more-menu button { padding: 10px 14px; border: 0; border-radius: 10px; background: transparent; color: var(--text); text-align: start; font-size: 15px; }
.more-menu button:hover, .more-menu button:focus-visible { background: var(--item-selected); }
.pb__center { position: relative; }
```

`src/ui/mobile.css` — дописать:
```css
.pb__more { display: none; }
.pb__sleepin { display: none; }
@media (max-width: 760px) {
  .shell__player { position: fixed; z-index: 11; inset-inline: 8px; inset-block-end: 74px; block-size: 68px; padding: 0 8px 0 10px; gap: 10px; border-radius: 16px; background: var(--surface-mini-player); border: 1px solid var(--border-popover); }
  .pb__now { gap: 10px; }
  .pb__tile { inline-size: 46px; block-size: 46px; border-radius: 10px; font-size: 18px; }
  .pb__name { font-size: 15px; }
  .pb__meta { font-size: 12px; margin-block-start: 2px; }
  .pb__live, .pb__star, .pb__next, .pb__right { display: none; }
  .pb__center { gap: 0; }
  .pb__more { display: flex; inline-size: 44px; block-size: 44px; border: 0; background: transparent; color: var(--text); align-items: center; justify-content: center; }
  .pb__play { inline-size: 48px; block-size: 48px; }
  .shell__player.has-sleep .pb__status { display: none; }
  .shell__player.has-sleep .pb__sleepin { display: inline; }
  .more-menu, .sleep-menu { position: fixed; inset-block-end: 150px; inset-inline-end: 8px; }
}
```

`src/app/app.ts`:
- импорт `import { openMoreMenu } from '../ui/more-menu';`
- вынести открытие меню сна в функцию над `const bar = …`:
```ts
  const openSleep = (anchor: HTMLElement) => {
    openSleepMenu(anchor, i18n, sleepChoice, (m) => {
      sleepChoice = m;
      if (m) d.sleep.start(m); else d.sleep.cancel();
    });
  };
```
- в `createPlayerBar(...)`: `onSleep: openSleep,` (вместо прежнего тела) и
```ts
    onMore: (anchor) => {
      const s = player.getState();
      if (s.kind === 'idle') return;
      const fav = d.library.isFavorite(s.station.id);
      openMoreMenu(anchor, t('player.more'), [
        { label: t('player.sleep'), onClick: () => openSleep(anchor) },
        { label: t('player.share'), onClick: () => { void shareCurrent(); } },
        { label: t(fav ? 'station.unfavorite' : 'station.favorite'), onClick: () => { d.library.toggleFavorite(toSaved(s.station)); } },
      ]);
    },
```
- в `renderBar` → `bar.render({ … })` добавить: `sleepMinutes: d.sleep.minutesLeft() ?? undefined,`

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(mobile): floating mini-player with more menu and sleep line`

---

### Task 7: Планшет — карточка места шторкой справа

**Files:**
- Modify: `src/ui/icons.ts`, `src/ui/shell.ts`, `src/ui/shell.css` (удалить `@media (max-width: 1100px) { .shell__place { display: none; } }` и комментарий над ним), `src/ui/mobile.css`, `src/app/app.ts`, `tests/shell.test.ts`, `tests/app.test.ts`

**Interfaces:**
- Produces: `ShellRefs.placeToggle: HTMLButtonElement`; `icons.info`.

- [ ] **Step 1: Тесты**

В `tests/shell.test.ts` дописать:
```ts
test('tablet place-card toggle is exposed', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.placeToggle.getAttribute('aria-label')).toBe('Карточка места');
  expect(refs.placeToggle.getAttribute('aria-expanded')).toBe('false');
});
```
В `tests/app.test.ts` дописать:
```ts
test('tablet: the toggle opens and closes the place-card drawer; Escape closes it', async () => {
  await startApp(deps);
  deps.refs.placeToggle.click();
  expect(deps.refs.placeCard.classList.contains('is-open')).toBe(true);
  expect(deps.refs.placeToggle.getAttribute('aria-expanded')).toBe('true');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(deps.refs.placeCard.classList.contains('is-open')).toBe(false);
  expect(deps.refs.placeToggle.getAttribute('aria-expanded')).toBe('false');
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/ui/icons.ts`: `info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),`

`src/ui/shell.ts` — в `<main class="shell__stage">` после `<div class="stage__map"></div>`:
```ts
        <button class="btn btn--outline btn--icon stage__place-toggle" type="button" aria-label="${t('place.show')}" aria-expanded="false">${icons.info}</button>
```
`ShellRefs` + `placeToggle: HTMLButtonElement;`; возврат `placeToggle: q<HTMLButtonElement>('.stage__place-toggle'),`

`src/ui/mobile.css` — дописать:
```css
.stage__place-toggle { display: none; }
@media (min-width: 761px) and (max-width: 1100px) {
  .shell__place { position: fixed; z-index: 10; inset-block: var(--h-header) var(--h-player); inset-inline-end: 0; overflow-y: auto; transform: translateX(100%); transition: transform .25s ease-out; box-shadow: -12px 0 30px rgb(0 0 0 / .35); }
  .shell__place.is-open { transform: none; }
  .shell__place .pc__collapse { display: none; }
  .stage__place-toggle { display: inline-flex; position: absolute; z-index: 3; inset-block-start: 16px; inset-inline-start: 20px; }
  .pb__sleep span { display: none; }
  .pb__sleep { padding-inline: 12px; }
  .pb__range { inline-size: 80px; }
}
@media (max-width: 760px) { .shell__place { display: none; } }
```

`src/app/app.ts` — рядом с `refs.closePanel.addEventListener(...)` (Task 4):
```ts
  const setPlaceDrawer = (open: boolean) => {
    refs.placeCard.classList.toggle('is-open', open);
    refs.placeToggle.setAttribute('aria-expanded', String(open));
  };
  refs.placeToggle.addEventListener('click', () => setPlaceDrawer(!refs.placeCard.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && refs.placeCard.classList.contains('is-open')) setPlaceDrawer(false); });
```

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `feat(tablet): place card as a right-side drawer`

---

### Task 8: Доступность всплывающих окон — меню сна, карточка ссылки, поиск

**Files:**
- Modify: `src/ui/sleep-menu.ts`, `src/ui/share-card.ts`, `src/ui/search-box.ts`, `tests/player-extras.test.ts`, `tests/search-box.test.ts`

**Interfaces:**
- Без изменений сигнатур (спека §6, пункты 1–3 и 10).

- [ ] **Step 1: Тесты**

В `tests/player-extras.test.ts` дописать:
```ts
test('sleep menu: arrows, Home/End move focus; Tab closes', () => {
  const anchor = document.createElement('button');
  el.append(anchor);
  openSleepMenu(anchor, i18n, null, vi.fn());
  const items = [...document.querySelectorAll('.sleep-menu button')] as HTMLButtonElement[];
  expect(document.activeElement).toBe(items[0]);
  const key = (k: string) => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  key('ArrowDown');
  expect(document.activeElement).toBe(items[1]);
  key('End');
  expect(document.activeElement).toBe(items[4]);
  key('ArrowDown');
  expect(document.activeElement).toBe(items[0]);
  key('ArrowUp');
  expect(document.activeElement).toBe(items[4]);
  key('Home');
  expect(document.activeElement).toBe(items[0]);
  key('Tab');
  expect(document.querySelector('.sleep-menu')).toBeNull();
});

test('share card: the background is inert, Tab cycles inside the card', () => {
  const host = document.querySelector('main')!;
  const map = document.createElement('div');
  host.append(map);
  const card = showShareCard(host, i18n, { name: 'X', flag: null, line: '' }, { onListen() {}, onClose() {} });
  expect(map.hasAttribute('inert')).toBe(true);
  const listen = host.querySelector('.share-card__listen') as HTMLButtonElement;
  const globe = host.querySelector('.share-card__globe') as HTMLButtonElement;
  const tab = (shift = false) => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(listen);
  tab();
  expect(document.activeElement).toBe(globe);
  tab();
  expect(document.activeElement).toBe(listen);
  tab(true);
  expect(document.activeElement).toBe(globe);
  card.close();
  expect(map.hasAttribute('inert')).toBe(false);
});
```

В `tests/search-box.test.ts` дописать:
```ts
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
```

- [ ] **Step 2: Run** `npx vitest run tests/player-extras.test.ts tests/search-box.test.ts` → FAIL.

- [ ] **Step 3: Реализация**

`src/ui/sleep-menu.ts` — заменить строку `const onKey = …` на:
```ts
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { close(); anchor.focus(); return; }
    if (e.key === 'Tab') { close(); return; }
    const list = [...menu.querySelectorAll<HTMLButtonElement>('button')];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === 'ArrowDown' ? (i + 1) % list.length
      : e.key === 'ArrowUp' ? (i - 1 + list.length) % list.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? list.length - 1
      : -1;
    if (to >= 0) { e.preventDefault(); list[to].focus(); }
  };
```

`src/ui/share-card.ts`:
- перед `host.classList.add('is-dimmed');` (до `host.append(card)`):
```ts
  // Modal: the rest of the stage is inert while the card is open.
  const others = [...host.children].filter((c) => c !== card) as HTMLElement[];
  for (const o of others) o.setAttribute('inert', '');
```
- заменить `const onKey = …` на:
```ts
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { close(); h.onClose(); return; }
    if (e.key !== 'Tab') return;
    const f = [card.querySelector<HTMLButtonElement>('.share-card__listen')!, card.querySelector<HTMLButtonElement>('.share-card__globe')!];
    const i = f.indexOf(document.activeElement as HTMLButtonElement);
    e.preventDefault();
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  };
```
- в `close()` добавить `for (const o of others) o.removeAttribute('inert');`
(объявление `others` должно стоять выше функции `close` по тексту или быть `let`-переменной, заполняемой до первого вызова; при `function close` с подъёмом — `const others` объявить до `function close`.)

`src/ui/search-box.ts`:
- после `let active = -1;`:
```ts
  const POP_ID = 'search-pop';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', POP_ID);
```
- в `close()` добавить: `input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');`
- в `ensurePop()` внутри `if (!pop) { … }`: `pop.id = POP_ID;` и `input.setAttribute('aria-expanded', 'true');`
- в `item(...)` после `b.setAttribute('role', 'option');`: `b.id = \`search-opt-${actions.length}\`;` (через Edit — в строке есть обратные кавычки)
- `highlight()` заменить на:
```ts
  function highlight() {
    const items = pop ? [...pop.querySelectorAll<HTMLElement>('.search-pop__item')] : [];
    items.forEach((el, i) => { el.classList.toggle('is-active', i === active); el.setAttribute('aria-selected', String(i === active)); });
    if (active >= 0 && items[active]) input.setAttribute('aria-activedescendant', items[active].id);
    else input.removeAttribute('aria-activedescendant');
  }
```
- в обработчике `input` сразу после `clearTimeout(timer);`: `actions = []; active = -1; highlight();` (старая выдача больше не выполняется с клавиатуры, пока не пришла новая)
- в обработчике `keydown` после строки с `Escape`: `if (e.key === 'Tab') { close(); return; }`

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `fix(a11y): keyboard and screen-reader support in sleep menu, share card and search`

---

### Task 9: Доводка поведения — фокус, подсветка, гонки, честные сообщения, старые iPhone

**Files:**
- Modify: `src/ui/station-list.ts`, `src/app/app.ts`, `src/share/share-link.ts`, `tests/station-list.test.ts`, `tests/app.test.ts`, `tests/share.test.ts`

**Interfaces:**
- Produces: `SavedListProps.focus?: { id: string; index: number }`; `renderSavedList(...)` возвращает `SavedListHandle = { setPlaying(id: string | null): void }`.

- [ ] **Step 1: Тесты**

В `tests/station-list.test.ts` дописать:
```ts
test('saved list keeps focus on the starred row, or the same position when the row is gone; highlight moves', async () => {
  const { renderSavedList } = await import('../src/ui/station-list');
  const item = (id: string) => ({ id, name: id, placeId: 'c:1', cc: 'PT', favicon: '' });
  const base = { playingId: 'a', empty: 'Пусто', sub: () => '', onPick() {}, isFavorite: () => true, onToggleFavorite() {} };
  renderSavedList(el, i18n, { ...base, items: [item('a'), item('b')], focus: { id: 'b', index: 1 } });
  expect(document.activeElement).toBe(el.querySelectorAll('.station__star')[1]);
  const h = renderSavedList(el, i18n, { ...base, items: [item('a'), item('c')], focus: { id: 'b', index: 1 } });
  expect(document.activeElement).toBe(el.querySelectorAll('.station__star')[1]);
  h.setPlaying('c');
  expect(el.querySelectorAll('.station')[1].classList.contains('is-playing')).toBe(true);
  expect(el.querySelectorAll('.station')[0].classList.contains('is-playing')).toBe(false);
});
```

В `tests/app.test.ts` дописать:
```ts
test('saved tab: the star keeps keyboard focus; the highlight follows the playing station', async () => {
  deps.library.toggleFavorite({ id: 'a', name: 'Radio a', placeId: 'c:1', cc: 'PT', favicon: '' });
  deps.library.toggleFavorite({ id: 'b', name: 'Radio b', placeId: 'c:1', cc: 'PT', favicon: '' });
  const app = await startApp(deps);
  app.tab('history');
  deps.library.remember({ id: 'a', name: 'Radio a', placeId: 'c:1', cc: 'PT', favicon: '' });
  (deps.refs.panelBody.querySelector('.station__star') as HTMLButtonElement).click();
  expect(document.activeElement).toBe(deps.refs.panelBody.querySelector('.station__star'));
  app.tab('favorites');
  player.set({ kind: 'playing', station: st('b', 'c:1') });
  expect(deps.refs.panelBody.querySelector('.station.is-playing .station__name')!.textContent).toBe('Radio b');
});

test('back to "Here" shows loading at once instead of the old saved list', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  app.tab('favorites');
  shards.get.mockImplementationOnce(() => new Promise(() => {}));
  app.tab('here');
  expect(deps.refs.panelBody.textContent).toBe('Загружаем станции…');
});

test('the last pick wins over a slower earlier one', async () => {
  deps.library.toggleFavorite({ id: 'a', name: 'Radio a', placeId: 'c:1', cc: 'PT', favicon: '' });
  deps.library.toggleFavorite({ id: 'p', name: 'Radio p', placeId: 'c:2', cc: 'PT', favicon: '' });
  let releaseSlow!: (v: StationLite[]) => void;
  shards.get.mockImplementationOnce(() => new Promise((r) => { releaseSlow = r; }));
  const app = await startApp(deps);
  app.tab('favorites');
  const picks = () => [...deps.refs.panelBody.querySelectorAll('.station__pick')] as HTMLButtonElement[];
  picks()[1].click();
  picks()[0].click();
  await flush();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'p' }));
  releaseSlow(pt);
  await flush();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'p' }));
  expect(player.play).toHaveBeenCalledTimes(1);
});

test('honest messages: search hit missing from the data; country file failed to load', async () => {
  const app = await startApp({ ...deps, createSearch: () => ({ search: async () => ({ places: [], stations: [{ name: 'Ghost FM', place: lisbon }] }) }) });
  deps.refs.searchInput.value = 'gh';
  deps.refs.searchInput.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  (document.querySelector('.search-pop__item') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.stage.textContent).toContain('Станция больше не вещает');
  deps.library.toggleFavorite({ id: 'a', name: 'Radio a', placeId: 'c:1', cc: 'PT', favicon: '' });
  app.tab('favorites');
  shards.get.mockRejectedValueOnce(new Error('offline'));
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.stage.textContent).toContain('Не удалось загрузить станции этого места');
});
```

В `tests/share.test.ts` дописать:
```ts
test('a link without a country works where AbortSignal.timeout is missing (old iPhones)', async () => {
  const orig = AbortSignal.timeout;
  (AbortSignal as unknown as { timeout?: unknown }).timeout = undefined;
  try {
    const f = vi.fn(async () => new Response(JSON.stringify([{ countrycode: 'PT' }])));
    const r = await resolveShared({ id: ID, cc: null }, { places: [place], shards: shards([station]), fetchFn: f as unknown as typeof fetch, mirrors: ['m1'] });
    expect(r).toEqual({ station, place });
  } finally {
    AbortSignal.timeout = orig;
  }
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Реализация**

`src/ui/station-list.ts`:
- `SavedListProps` + `focus?: { id: string; index: number };`
- `export interface SavedListHandle { setPlaying(id: string | null): void }`
- `renderSavedList` → возвращает `SavedListHandle`:
  - пустой список: `renderListMessage(host, p.empty); return { setPlaying() {} };`
  - перед циклом: `const rows: { id: string; row: HTMLLIElement; pick: HTMLButtonElement; star: HTMLButtonElement }[] = [];`; в цикле после создания `star` — `rows.push({ id: item.id, row, pick, star });`; у строки играющей станции `pick.setAttribute('aria-current', 'true')` (уже есть)
  - после `host.replaceChildren(list);`:
```ts
  if (p.focus) (rows.find((r) => r.id === p.focus!.id) ?? rows[Math.min(p.focus.index, rows.length - 1)])?.star.focus();
  return {
    setPlaying(id) {
      for (const r of rows) {
        const on = r.id === id;
        r.row.classList.toggle('is-playing', on);
        if (on) r.pick.setAttribute('aria-current', 'true'); else r.pick.removeAttribute('aria-current');
      }
    },
  };
```

`src/app/app.ts`:
- импорт типа: `import { renderListMessage, renderSavedList, renderStationList, type SavedListHandle, type StationListHandle } from '../ui/station-list';`
- состояние рядом с `let tab`: `let saved: SavedListHandle | null = null;`, `let focusStar: { id: string; index: number } | null = null;`, `let pickToken = 0;`
- `renderTab()`:
  - ветка `here`: `if (selected) void renderList(selected, true);` и `saved = null;` в начале ветки
  - `const items = tab === 'favorites' ? d.library.favorites() : d.library.history();`
  - `saved = renderSavedList(refs.panelBody, i18n, { items, …, focus: focusStar ?? undefined, onToggleFavorite: (item) => { focusStar = { id: item.id, index: items.findIndex((x) => x.id === item.id) }; d.library.toggleFavorite(item); } });`
  - после вызова: `focusStar = null;`
- в `player.subscribe(...)` после строки с `list.handle.setPlaying(...)`: `if (tab !== 'here') saved?.setPlaying(station?.id ?? null);`
- `playStation` — первой строкой (до проверки сети): `pickToken++;`
- `playSaved(item)` целиком:
```ts
  async function playSaved(item: SavedStation) {
    const my = ++pickToken;
    const place = byId.get(item.placeId);
    let station: StationLite | undefined;
    try {
      station = (await d.shards.get(item.cc)).find((s) => s.id === item.id);
    } catch {
      if (my === pickToken) showToast(refs.stage, t('list.loadError'));
      return;
    }
    if (my !== pickToken) return;
    if (!station || !place) { showToast(refs.stage, t('library.gone')); return; }
    view?.flyTo(place.lat, place.lon);
    await playStation(station, place);
  }
```
  (последняя строка прежней версии `if (tab !== 'here') renderTab();` больше не нужна — подсветку двигает `saved.setPlaying`, а историю перерисовывает `library.subscribe`.)
- в `createSearchBox` → `onStation` целиком:
```ts
    onStation: async (h) => {
      closeSearch();
      nav.set('globe');
      const my = ++pickToken;
      view?.flyTo(h.place.lat, h.place.lon);
      void selectPlace(h.place);
      let station: StationLite | undefined;
      try { station = (await d.shards.get(h.place.cc)).find((s) => s.placeId === h.place.id && s.name === h.name); } catch { return; }
      if (my !== pickToken) return;
      if (!station) { showToast(refs.stage, t('library.gone')); return; }
      await playStation(station, h.place);
    },
```

`src/share/share-link.ts` — в `countryOf` заменить тело `try { … }` на:
```ts
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      const r = await fetchFn(`https://${host}/json/stations/byuuid/${id}`, { signal: ctrl.signal });
      if (!r.ok) continue;
      const list = (await r.json()) as { countrycode?: string }[];
      const cc = (list[0]?.countrycode ?? '').toUpperCase();
      return /^[A-Z]{2}$/.test(cc) ? cc : null;
    } catch { /* next mirror */ } finally { clearTimeout(timer); }
```
(правка через Edit — в строке регулярка.)

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** `fix: saved-list focus and highlight, last pick wins, honest load messages, old iOS links`

---

### Task 10: Lighthouse и приёмка

**Files:**
- Create: `scripts/lighthouse-summary.mjs`
- Modify: `.claude/launch.json` (конфигурация `preview`), по результатам — файлы, на которые укажет Lighthouse

- [ ] **Step 1: Сборка и сервер** — `npm run build`; в `.claude/launch.json` добавить конфигурацию:
```json
    {
      "name": "preview",
      "runtimeExecutable": "C:\\Program Files\\nodejs\\npm.cmd",
      "runtimeArgs": ["run", "preview", "--", "--port", "4173", "--strictPort"],
      "port": 4173
    }
```
и запустить её через `preview_start` (`name: "preview"`).

- [ ] **Step 2: Замер** —
```bash
npx -y lighthouse@12 http://localhost:4173/ --preset=desktop --only-categories=performance,accessibility --output=json --output-path=.cache/lh-desktop.json --chrome-flags="--headless=new" --quiet
node scripts/lighthouse-summary.mjs .cache/lh-desktop.json
```
`scripts/lighthouse-summary.mjs`:
```js
import { readFileSync } from 'node:fs';

// Prints category scores and every audit that lost points (score < 1) with its weight.
const r = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const c of Object.values(r.categories)) {
  console.log(`${c.title}: ${Math.round(c.score * 100)}`);
  for (const ref of c.auditRefs) {
    const a = r.audits[ref.id];
    if (ref.weight > 0 && a.score !== null && a.score < 1) console.log(`  - ${ref.id} (w${ref.weight}, ${a.score}) ${a.displayValue ?? ''} ${a.title}`);
  }
}
```
Expected: «Performance: N», «Accessibility: N» и список потерь.

- [ ] **Step 3: Исправления до ≥ 90** — по каждой строке списка с весом ≥ 3, начиная с наибольшего веса:
  - доступность (`color-contrast`, `button-name`, `link-name`, `label`, `heading-order`, `aria-*`): исправить разметку/токен; если проверяемо в jsdom — сначала тест в соответствующем `tests/*.test.ts` (RED → GREEN);
  - производительность (`render-blocking-resources`, `largest-contentful-paint`, `total-blocking-time`, `unused-javascript`): шрифты Google — `<link rel="preload" as="style" … onload="this.rel='stylesheet'">` + `<noscript>`; тяжёлое — только через уже существующий ленивый `import()`; картинки — явные `width/height`.
  После каждой правки — `npm run build`, повторить Step 2. Каждое решение — строкой `Ruling:` в журнале.

- [ ] **Step 4: Приёмка вручную** (результат — в журнал):
  1. 390×844: главный экран бок о бок с `design/mockups/MobilePlayer.dc.html` — шапка, переключатель, шторка карточки, мини-плеер, нижнее меню (`resize_window` 390×844, скриншот).
  2. 390×844: ссылка `?station=…&c=…` — карточка по `MobileShare`, внизу плашка установки (если браузер её предлагает), список места не выезжает.
  3. 360×640: `document.documentElement.scrollWidth <= innerWidth` на главном экране, с открытым списком, на экране поиска.
  4. 360×640: экран «Поиск» — поле видно, выдача между полем и меню (Review Focus 1).
  5. 768×1024: раскладка ПК, кнопка «Карточка места» открывает шторку справа.
  6. Без сети: в консоли `dispatchEvent(new Event('offline'))` при `navigator.onLine` — плашка; проверка `navigator.serviceWorker.controller` после перезагрузки (production-сборка) — не `null`.
  7. Lighthouse: итоговые числа ≥ 90.

- [ ] **Step 5: Commit** `perf/a11y: Lighthouse fixes` (если были правки) — вместе со `scripts/lighthouse-summary.mjs` и `.claude/launch.json`.

---

### Task 11: Итоговый README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Правки README**
  - Первый абзац: убрать «(рабочее название)» из заголовка нельзя — название рабочее; заменить описание «карточку места (время, погода, факт)» на «карточку места (флаг, местное время, язык эфира, факт из Википедии)».
  - «Структура»: добавить `src/pwa/` — установка, сеть, обновления; `public/icons/` — иконки приложения (`npm run icons`).
  - «Запуск локально»: добавить `npm run preview   # проверить сборку (с service worker) на http://localhost:4173`.
  - Новый раздел после «Удобства»:
```markdown
## Телефон и установка (PWA)
- На телефоне (до 760 px) — раскладка по макету: нижнее меню «Глобус / Поиск / Избранное / Учу язык», шторки списка и карточки места, плавающий мини-плеер (кнопка «⋯» — таймер сна, «Поделиться», избранное).
- **Android (Chrome):** плашка «Добавить на главный экран» (на экране ссылки сразу, иначе со второго визита) или меню браузера → «Установить приложение». Эфир играет при выключенном экране, на экране блокировки — название, место, кнопки.
- **ПК (Chrome, Edge):** кнопка «Установить» в шапке.
- **iPhone (Safari):** «Поделиться» → «На экран Домой» (подсказка появляется на сайте). Ограничения iOS: система может остановить эфир в фоне; громкость из страницы не регулируется, поэтому таймер сна не затухает плавно, а просто останавливает эфир вовремя.
- **Без интернета** сайт открывается из памяти (service worker хранит оболочку, флаги, текстуру Земли и последнюю копию данных станций), сверху плашка «Нет подключения к интернету»; эфир без сети невозможен.
- **Обновления:** после публикации новой версии сайт показывает «Доступна новая версия · Обновить».
```
  - Новый раздел:
```markdown
## Как выложить обновление самому
1. Внести правку (или попросить агента) в отдельной ветке, проверить: `npm test`, `npm run build`.
2. Отправить ветку на GitHub и создать pull request в `main`.
3. Влить pull request — GitHub Actions сам соберёт сайт со свежим снимком станций и опубликует его (≈ 2 мин).
4. Если сборка упала — **Actions → build-and-deploy** → открыть запуск и прочитать ошибку; повторить — **Re-run jobs**.
```
  - Раздел «Название проекта»: дописать «…и в `index.html` (теги `og:title`, `apple-mobile-web-app-title`) и `scripts/og-image.ts` (картинка-превью: `npm run og`)».
  - Новый раздел «Проверка качества»: «Lighthouse (ПК, production-сборка): производительность N, доступность N» — фактические числа из Task 10, Step 2 (последний замер), дата замера.

- [ ] **Step 2: Run** `npx vitest run && npm run build` → PASS.

- [ ] **Step 3: Commit** `docs: final README (phone, PWA, publishing, quality)`
