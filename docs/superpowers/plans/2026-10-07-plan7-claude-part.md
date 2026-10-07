# План 7 (часть Claude) — английская версия, главная для Google, GA4 с согласием, чек-лист SEO

> Выполняет Claude сам (Native). Спецификация: `docs/superpowers/specs/2026-10-07-plan7-english-seo-design.md` (§3, §4.1, §5, §6, §10). Задача GitHub: #8. Часть второго разработчика (SEO-страницы) — #17, её файлы не трогаем: `scripts/seo/*`, `scripts/build-seo-pages.ts`, строка `build` в `package.json`.

**Global Constraints:** в `src/` нет кириллицы (кроме трёх разрешённых файлов); продакшен — только `en`; название — Globe Radio (`app.name` в `locales/en.json`); GA4 `G-ENKZYY7NQ6` из `VITE_GA_ID`, без ID ничего не грузится; аналитика — только после Accept (Consent Mode v2, basic); тесты с русским каталогом остаются; коммиты с `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Review Focus:**
1. Пользователь из ЕС не нажал ничего → ни одного запроса к googletagmanager/google-analytics.
2. Reject → выбор запомнен, баннер не возвращается, gtag.js не загружен; «Cookie settings» позволяет передумать.
3. Установленное приложение (service worker) открывает `/radio/...` → показывается SEO-страница, а не глобус.
4. Режим «Learn a language» на английском: «Next in Spanish», баннер и подписи без русских падежей.
5. Карточка места на английском: английская статья Википедии, без пометки «Article in English».

---

### Task 1: Английская версия
- **Тесты (сначала):** `tests/en-locale.test.ts` — в `en.json` есть все ключи `ru.json` (и наоборот), множественные формы `one`/`other`, нет кириллицы; `index.html` без кириллицы и `lang="en"`; `createI18n('en', en)` даёт «1 station», «2 stations». `tests/learn.test.ts`/`app.test.ts` — `langPrep` для `en` = «Spanish» («Next in Spanish»). `tests/wiki.test.ts` — `findArticle(info, fetch, cache, 'en')` берёт `wikiEn` и не ищет русскую. `tests/place-card.test.ts` — пометка «статья на английском» показывается, только если язык статьи ≠ языку интерфейса. `tests/pwa-manifest.test.ts` — имя «Globe Radio», `lang: 'en'`.
- **Код:** `locales/en.json` (+ ключи `app.title`, `footer.byCountry`, `footer.cookies` и в `ru.json`); `src/app/config.ts` (`['en']`, `'en'`); `src/app/main.ts` (`catalogs = { en }`); `src/app/app.ts` (`langPrep` — `prepositional` только для `ru`); `src/place-card/wiki.ts` (параметр `prefer: 'ru' | 'en'`, по умолчанию `'ru'`); `src/place-card/place-card.ts` (передать `i18n.locale`, пометка по языку); `src/app/main.ts` (`findArticle(..., i18n.locale)`); `src/pwa/manifest.ts` (`en.json`, `lang: 'en'`); `src/ui/shell.ts` (`document.title = t('app.title')`); `index.html` (`lang="en"`, title/description/og/apple title на английском); `scripts/og-image.ts` + `npm run og`.
- **Commit:** `feat(i18n): English-only production version (Globe Radio)`

### Task 2: Главная для Google и service worker
- **Тесты:** `tests/og-meta.test.ts` — canonical `%VITE_SITE_URL%/`, `og:url`, JSON-LD `WebApplication` (валидный JSON, name «Globe Radio»), description ≤ 160; `tests/shell.test.ts` — ссылка «Radio by country» ведёт на `radio/`, кнопка «Cookie settings» есть и скрыта по умолчанию; `tests/pwa-sw.test.ts` — в конфиге service worker `navigateFallbackDenylist` содержит `/radio/` и `404.html`, `globIgnores` — `radio/**`.
- **Код:** `index.html`; `src/ui/shell.ts` (ссылка и кнопка в `stage__attribution`); `vite.config.ts` (денайлист вынесен в экспортируемую константу `src/pwa/sw-config.ts`, чтобы тестировать).
- **Commit:** `feat(seo): home page title, description, canonical, JSON-LD; keep /radio/ out of the service worker`

### Task 3: Аналитика GA4 с согласием
- **Тесты:** `tests/consent.test.ts` — сниппет `consentSnippet(id)` (выполняется в jsdom): по умолчанию `consent default denied`, gtag.js не добавлен, баннер показан; Accept → `consent update granted`, добавлен `<script src=…gtag/js?id=G-…>`, выбор сохранён, баннер скрыт; Reject → сохранён `denied`, скрипта нет; повторная загрузка с сохранённым выбором — без баннера; `window.globeConsent.open()` снова показывает баннер; пустой id → пустая строка. `tests/track.test.ts` — `track()` вызывает `gtag('event', …)` и молчит без gtag. `tests/app.test.ts` — события `play_station`, `search`, `surprise`, `share`; кнопка «Cookie settings» видна при `globeConsent` и открывает баннер.
- **Код:** `src/analytics/consent-snippet.ts`, `src/analytics/track.ts`, вставка сниппета плагином в `vite.config.ts` (`transformIndexHtml`, только при `VITE_GA_ID`); `scripts/inject-analytics.ts` — после сборки заменяет `<!-- analytics -->` в `dist/**/*.html` (для SEO-страниц второго разработчика); `.github/workflows/deploy.yml` — `VITE_GA_ID: G-ENKZYY7NQ6` и шаг `npx tsx scripts/inject-analytics.ts`.
- **Commit:** `feat(analytics): GA4 with Consent Mode v2 banner and events`

### Task 4: Документы
- `docs/SEO-CHECKLIST.md` (сделано в коде / делает владелец / может сделать Claude в браузере), `README.md` (английская версия, аналитика, SEO), `CHANGELOG.md`, обновить #8.
- **Commit:** `docs: SEO checklist, README, changelog`

### Task 5: Приёмка и сдача
- `npm test`, `npm run build`, preview: главная по-английски, баннер согласия, Accept → запрос к GA (в DevTools сети), Reject → нет; Lighthouse SEO и доступность главной; финальный обзор ветки, исправления, PR, вливание, проверка на сайте.
