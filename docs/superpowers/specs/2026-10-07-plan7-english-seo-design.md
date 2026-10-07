# План 7: английская версия Globe Radio, SEO, аналитика, работа вдвоём — дизайн

*07.10.2026 · Основа — Планы 1–6 (в `main`) · Утверждено в чате 07.10.2026.*

## 1. Цель и критерии готовности
Публичный сайт — на английском под именем **Globe Radio**, максимально оптимизирован для Google (90 % трафика — поиск), с аналитикой GA4 по согласию, и готов к работе второго разработчика параллельно.

**Готово, когда:**
- На сайте нет русского текста: интерфейс, заголовки, manifest, превью — на английском; названия мест — английские.
- Есть страницы стран `/radio/<country>/` (~240) и городов `/radio/<country>/<city>/` (~1 200, только где ≥ 3 станций); каждая — свой `<title>`, `description`, canonical, H1, текст, список станций со ссылкой «Listen», хлебные крошки, JSON-LD.
- `sitemap.xml`, `robots.txt`, `404.html` опубликованы; Google Rich Results Test и Search Console не находят ошибок разметки.
- GA4 `G-ENKZYY7NQ6` работает только после «Accept» (Consent Mode v2); события play/search/surprise/share.
- `docs/SEO-CHECKLIST.md` (что делаю я / что делает заказчик) и `docs/COLLABORATION.md` (на русском) в репозитории; задачи заведены как Issues.

## 2. Решения заказчика (07.10.2026)
1. Только английская версия на сайте; русский — не нужен в продакшене (остаётся в коде для тестов и на будущее).
2. Название — **Globe Radio** (не «Planet Radio» — чужой бренд).
3. Домен пока `glorg225.github.io/globe-radio/`; переезд на свой домен — позже, с редиректами.
4. SEO-страницы: страны + города (не отдельные страницы станций).
5. Аналитика — Google Analytics 4 `G-ENKZYY7NQ6` + баннер согласия.
6. Search Console подтверждается мета-тегом (уже на сайте, PR #7).
7. Документ для второго разработчика — на русском.

## 3. Английская версия
- `locales/en.json` — все ключи `ru.json`, английские тексты (множественные формы `one/other`). `app.name` = «Globe Radio».
- `SUPPORTED_LOCALES = ['en']`, `DEFAULT_LOCALE = 'en'`; `?lang=ru` больше не включает русский.
- Названия мест: `placeTitle` для `en` уже берёт `name` (английское); страны — `Intl.DisplayNames('en')`.
- «Учу язык» → «Learn a language»; фразы с языком: «Next in Spanish», «Radio in Spanish nearby». Русский предложный падеж (`prepositional`) — только для `ru`; для `en` — название языка как есть.
- Википедия: для `en` сначала английская статья (`wikiEn`), русская не ищется.
- `index.html` (`lang="en"`, title, description, og), manifest (`lang: 'en'`, имя из `en.json`), `og.png` (английский текст), `apple-mobile-web-app-title`.
- Автотесты продолжают проверять русский каталог там, где проверяют логику; добавляется тест «в `en.json` все ключи `ru.json`, и в продакшене нет кириллицы в `dist/index.html`».

## 4. SEO
### 4.1 Главная
- `<title>Globe Radio — Listen to Live Radio Stations Worldwide on a 3D Globe</title>` (≤ 60 символов в видимой части), `description` ~150 символов.
- `link rel="canonical"` на `https://glorg225.github.io/globe-radio/` (адрес сайта из `VITE_SITE_URL`).
- JSON-LD: `WebSite` (с `SearchAction` не делаем — нет страницы поиска), `Organization`/`WebApplication`.
- Ссылки на все страны внизу страницы (видимый блок «Radio by country»), чтобы Google нашёл SEO-страницы.

### 4.2 Страницы стран и городов (генерируются при сборке)
- Скрипт `scripts/build-seo-pages.ts` после `vite build` читает `public/data/*` и пишет статический HTML в `dist/radio/...`. Без 3D и без JS-бандла приложения (только стили + маленький скрипт согласия/аналитики).
- **Адреса:** slug из английского названия (`portugal`, `lisbon`, `sao-paulo`); при совпадении slug внутри страны — добавляется регион/код (`springfield-il`).
- **Город:** место `exact` или `region` с тем же английским названием в одной стране объединяются; страница создаётся, если в сумме ≥ 3 станций.
- **Содержимое страны:** H1 «Portugal Radio Stations», вступление (число станций и городов, языки эфира, топ-жанры по тегам), список топ-50 станций по популярности (название, теги, язык, кнопка «Listen» → `/?station=<id>&c=<CC>`), список городов со ссылками, местное время столицы не нужно.
- **Содержимое города:** H1 «Lisbon Radio Stations», вступление (станции, языки, жанры, часовой пояс), все станции, «Nearby cities» (до 8 ближайших городов со страницами), ссылка на страну.
- **Мета:** `<title>Lisbon Radio Stations — Listen Live Online | Globe Radio</title>`, `description` с числом станций и 2–3 названиями, canonical, `og:*`, `twitter:card`.
- **JSON-LD:** `BreadcrumbList` (Home › Portugal › Lisbon), `ItemList` из `RadioStation` (name, url → ссылка Listen).
- **Хлебные крошки** видимые.
- Названия станций — экранируются (данные чужие).
- Страница «All countries» `/radio/` — индекс стран по алфавиту.

### 4.3 Технические файлы
- `sitemap.xml` (главная, `/radio/`, страны, города; `lastmod` = дата снимка). Если > 50 000 адресов — sitemap index (сейчас не нужно).
- `robots.txt`: всё разрешено, ссылка на sitemap. *Важно:* на `github.io` robots.txt читается только из корня `glorg225.github.io` — для подпапки он не работает; поэтому sitemap дополнительно отправляется в Search Console вручную. При переезде на свой домен robots.txt заработает.
- `404.html` — английская страница «Page not found» со ссылками на главную и `/radio/`.
- Редиректы: на GitHub Pages серверных нет; используются canonical и единый формат адресов (со слешем в конце). При переезде на домен — Cloudflare Pages / redirects.

### 4.4 Производительность
- SEO-страницы — статический HTML + общий CSS, без глобуса: быстрые для Google.

## 5. Аналитика и согласие
- `src/analytics/consent.ts`: Consent Mode v2 — по умолчанию `analytics_storage: denied`, `ad_storage/ad_user_data/ad_personalization: denied`; баннер внизу «We use cookies for anonymous statistics · Accept · Reject», выбор в `localStorage` (`consent`), ссылка «Cookie settings» в подвале меняет выбор.
- `gtag.js` с `G-ENKZYY7NQ6` (из `VITE_GA_ID`; без ID аналитика не грузится — локально и в тестах).
- События: `play_station` (country, place), `search` (term длиной ≥ 2, без персональных данных), `surprise`, `share` (method), `install`.
- SEO-страницы получают тот же баннер и gtag (маленький общий скрипт).

## 6. Документы
- `docs/SEO-CHECKLIST.md` — задачи видимости в Google: что сделано в коде; что делает заказчик (Search Console: подтвердить, отправить sitemap, проверить индексацию; GA4: связать с Search Console; Bing Webmaster Tools; домен; внешние ссылки и каталоги; соцсети); что Claude может сделать в браузере, если заказчик вошёл в аккаунт.
- `docs/COLLABORATION.md` (на русском) — для второго разработчика: запуск, структура кода, правила (ветка на задачу, PR в `main`, без прямых коммитов, CI/тесты зелёные), как не пересекаться (Issues + назначение + метка `in progress`, ветка `<issue>-<slug>`), обмен информацией (Issues, PR, `CHANGELOG.md`, раздел «Сейчас в работе»), работа с ИИ-агентом (Superpowers: спецификация → план → тесты → PR), ссылки (репозиторий, сайт, Actions, Search Console).
- `CHANGELOG.md` — заводится, дальше дополняется в каждом PR.
- Issues на GitHub: открытые задачи (отложенные мелочи Планов 5–6, SEO-задачи заказчика) с метками `for: claude`, `for: dev2`, `for: owner`.

## 7. Модули (ориентир)
```
locales/en.json, src/app/config.ts, src/app/app.ts (langPrep), src/place-card/wiki.ts, src/pwa/manifest.ts
index.html, scripts/og-image.ts, public/og.png
scripts/build-seo-pages.ts, scripts/seo/*.ts (slug, шаблоны, sitemap), src/seo/seo.css
src/analytics/consent.ts, src/analytics/gtag.ts, src/ui/consent-banner.ts
package.json ("build": … && tsx scripts/build-seo-pages.ts), .github/workflows/deploy.yml (VITE_GA_ID)
docs/SEO-CHECKLIST.md, docs/COLLABORATION.md, CHANGELOG.md, README.md
```

## 8. Проверка
**Автотесты:** en-каталог полон; нет кириллицы в собранных HTML; `langPrep` для `en`; Википедия для `en`; slug (диакритика, совпадения); группировка город/регион и порог ≥ 3; шаблоны страниц (title, canonical, H1, крошки, JSON-LD валиден, экранирование названий); sitemap (все страницы, формат); согласие (по умолчанию denied, Accept/Reject, сохранение, без ID — ничего не грузится); события аналитики.
**Вручную:** главная и 2–3 SEO-страницы в браузере; Rich Results Test по одной странице города; Lighthouse SEO ≥ 95 на главной и странице города; GA4 Realtime видит визит после Accept.

## 9. Не входит
Отдельные страницы станций; другие языки сайта; покупка домена и переезд; блог/статьи.
