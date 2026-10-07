# План 7 (часть второго разработчика) — SEO-страницы стран и городов, sitemap, robots, 404

> Выполняет второй разработчик со своим агентом. Спецификация: `docs/superpowers/specs/2026-10-07-plan7-english-seo-design.md` (§4.2–4.4, §10). Задача GitHub: #17 (контракт с частью Claude — в задаче). Ветка `17-seo-pages`.

**Goal:** после `vite build` скрипт пишет в `dist/` статические страницы `/radio/`, `/radio/<country>/`, `/radio/<country>/<city>/`, а также `sitemap.xml`, `robots.txt`, `404.html`.

**Architecture:** чистые функции в `scripts/seo/` (slug → модель данных → HTML-шаблоны → sitemap), тонкий `scripts/build-seo-pages.ts` читает `public/data/` и пишет файлы. Данные декодируются функциями приложения (`decodePlace`, `decodeStation`), экранирование — `escapeHtml` из `src/ui/html.ts`. Без JS-бандла и без 3D: HTML + один CSS (`src/ui/tokens.css` + `scripts/seo/seo.css`, склеиваются при сборке в `dist/radio/seo.css`).

**Global Constraints:** не трогаем `src/`, `locales/`, `index.html`, `vite.config.ts` (зона Claude); в `package.json` меняется только строка `build`; все тексты страниц — английский, `lang="en"`, название **Globe Radio**; в `<head>` каждой страницы ровно одна метка `<!-- analytics -->`; адрес сайта — `VITE_SITE_URL` (по умолчанию `https://glorg225.github.io/globe-radio`, без слеша в конце), путь — `BASE_PATH` (по умолчанию `/`); адреса страниц со слешем в конце, canonical абсолютный; кнопка Listen → `${BASE_PATH}?station=<id>&c=<CC>`; порог страницы — ≥ 3 станций; данные станций экранируются, JSON-LD — `JSON.stringify` + `<` → `<`; цвета — только переменные `tokens.css`; нет данных → предупреждение и код 0; комментарии в коде по-английски; коммиты с `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Review Focus:**
1. Название станции `</script><script>alert(1)</script>` не ломает ни разметку, ни JSON-LD.
2. Lisbon (город `c:2267057`) + Lisbon (регион `a:PT.14`) → одна страница `/radio/portugal/lisbon/`.
3. Совпадение slug в стране (`São Paulo` / `Sao Paulo`) → разные адреса, ни одна страница не перезаписана.
4. Локальная сборка без `public/data/` не падает.
5. Метка `<!-- analytics -->` одна и стоит в `<head>` — `scripts/inject-analytics.ts` заменяет первое вхождение.

---

### Task 1: slug
- **Тесты (сначала):** `tests/seo-slug.test.ts` — `slugify`: `São Paulo` → `sao-paulo`, `Köln` → `koln`, `Côte d'Ivoire` → `cote-d-ivoire`, `Łódź` → `lodz`, `Straße` → `strasse`, пробелы по краям обрезаются, `東京` → `''`. `assignSlugs`: первый сохраняет чистый slug, совпадение получает суффикс из id (`c:2` → `sao-paulo-2`), пустой slug — из id (`c:3` → `c-3`).
- **Код:** `scripts/seo/slug.ts` — `slugify(s: string): string`, `assignSlugs<T>(items: T[], name: (t: T) => string, id: (t: T) => string): Map<T, string>`.
- **Commit:** `feat(seo): URL slugs for country and city pages`

### Task 2: модель данных
- **Тесты:** `tests/seo-model.test.ts` — город и регион с одним английским названием объединяются; город с < 3 станциями не получает страницу; страна с < 3 станциями пропускается; станции отсортированы по `clicks` (убывание); координаты города — у места с бо́льшим числом станций; часовой пояс — первый непустой из `places` шарда; slug страны из названия; `nearbyCities` — до 8 ближайших, без самого города, по расстоянию.
- **Код:** `scripts/seo/model.ts` — `MIN_STATIONS = 3`; типы `CityPage { cc, name, slug, lat, lon, tz, stations }`, `CountryPage { cc, name, slug, stations, cities }`, `CountryData { stations: StationLite[]; info: Map<string, PlaceInfo> }`, `CityRef { country, city }`; `buildModel(places, data: Map<string, CountryData>, countryName: (cc) => string): CountryPage[]` (страны по алфавиту, города по алфавиту; slug-приоритет — у большего по числу станций); `allCities(countries): CityRef[]`; `nearbyCities(target: CityRef, all: CityRef[], n = 8): CityRef[]` (гаверсинус).
- **Commit:** `feat(seo): group places into country and city pages`

### Task 3: тексты страниц
- **Тесты:** `tests/seo-text.test.ts` — `topLanguages` по числу станций, коды → английские названия (`pt` → `Portuguese`); `topGenres` пропускает теги с цифрами (`64kbps`), названия страны/города и одиночные теги; `listPhrase` (`a`, `a and b`, `a, b and c`); `fitDescription` ≤ 160 символов, убирает лишние названия станций, при длинном начале обрезает с `…`; `plural`.
- **Код:** `scripts/seo/text.ts`.
- **Commit:** `feat(seo): intro and description text for SEO pages`

### Task 4: HTML-шаблоны
- **Тесты:** `tests/seo-html.test.ts` (разбор `DOMParser` в jsdom) — для города: `<title>Lisbon Radio Stations — Listen Live Online | Globe Radio</title>`, `lang="en"`, description ≤ 160, canonical `https://example.com/gr/radio/portugal/lisbon/`, `og:*`, `twitter:card`, H1, видимые крошки Home › Portugal › Lisbon, JSON-LD (`BreadcrumbList`, `ItemList` из `RadioStation`, ≤ 50) — валидный JSON, ссылка Listen `/gr/?station=s1&c=PT`, «Nearby cities», ссылка на страну, метка `<!-- analytics -->` одна и в `<head>`; опасное название станции — `textContent` совпадает, в HTML нет `<script>alert`, в JSON-LD `<`; страна — топ-50 станций и ссылки на города; `/radio/` — все страны; 404 — `noindex`, без canonical, ссылки на главную и `/radio/`; нет кириллицы.
- **Код:** `scripts/seo/html.ts` — `Site { url, base }`, `radioPath()`, `countryPath(c)`, `cityPath(c, city)`, `listenHref(site, s)`, `jsonLd(data)`, `indexPage(site, countries)`, `countryPage(site, c)`, `cityPage(site, ref, nearby)`, `notFoundPage(site)`; `scripts/seo/seo.css`.
- **Commit:** `feat(seo): country, city, index and 404 page templates`

### Task 5: sitemap, robots, сборка
- **Тесты:** `tests/seo-sitemap.test.ts` — `sitemapXml` валидный XML, `<loc>` по адресу, `<lastmod>` = дата снимка (`YYYY-MM-DD`), `&` экранирован; `robotsTxt` — `Allow: /` и `Sitemap:`. `tests/seo-build.test.ts` — на временной папке со снимком (`encodePlace`, `encodeStation`) пишет `radio/index.html`, страницу страны и города, `404.html`, `sitemap.xml` (главная, `/radio/`, страна, город), `robots.txt`, `radio/seo.css` (с переменными `tokens.css`); без `places.json` возвращает `null`; `siteFromEnv` — значения по умолчанию, слеши.
- **Код:** `scripts/seo/sitemap.ts`, `scripts/build-seo-pages.ts` (`buildSeoPages`, `siteFromEnv`, запуск из командной строки), `package.json` — `"build": "tsc --noEmit && vite build && tsx scripts/build-seo-pages.ts"`.
- **Проверка вручную:** `npm run build` с настоящим снимком → число стран и городов в логе (ожидание ≈ 196 и ≈ 1 300), `npm run preview` → `/radio/`, `/radio/portugal/`, `/radio/portugal/lisbon/` в браузере, Listen открывает станцию в приложении.
- **Commit:** `feat(seo): build static SEO pages, sitemap.xml, robots.txt and 404 after vite build`

### Task 6: документы
- `CHANGELOG.md` — строка сверху; `README.md` — короткий раздел «SEO-страницы»; комментарий в #17 с итогом.
- **Commit:** `docs: SEO pages in README and changelog`
