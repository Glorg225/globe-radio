# Globe Radio — чек-лист видимости в Google

Сайт: https://glorg225.github.io/globe-radio/ · Search Console: https://search.google.com/search-console · Analytics: https://analytics.google.com (поток `G-ENKZYY7NQ6`)

## 1. Уже сделано в коде
| Что | Где |
|---|---|
| Английская версия, `lang="en"`, название Globe Radio | `locales/en.json`, `index.html` |
| Заголовок и описание главной под поиск, canonical, Open Graph, Twitter card | `index.html` |
| Структурированные данные главной (`WebApplication`) | `index.html` |
| Подтверждение Search Console (мета-тег) | `index.html` |
| Картинка-превью 1200×630 | `public/og.png` (`npm run og`) |
| Ссылка «Radio by country» на каталог стран | подвал приложения |
| Service worker не подменяет SEO-страницы, 404, sitemap, robots | `src/pwa/sw-config.ts` |
| Google Analytics 4 с баннером согласия (Consent Mode v2: без «Accept» ничего не отправляется) | `src/analytics/`, `vite.config.ts`, `deploy.yml` |
| События: запуск станции, поиск, «Surprise me», «Share» | `src/app/app.ts` |
| Быстрая загрузка, доступность 100 (Lighthouse) | — |
| **Делает второй разработчик (#17):** страницы стран и городов `/radio/...`, `sitemap.xml`, `robots.txt`, `404.html` | `scripts/seo/*` |

## 2. Что сделать владельцу (нужен вход в аккаунт Google)
1. **Search Console — подтвердить сайт.** Добавить ресурс → «Префикс URL» → `https://glorg225.github.io/globe-radio/` → «HTML-тег» → **Подтвердить** (тег уже на сайте).
2. **Search Console — отправить карту сайта** (после вливания #17): «Файлы Sitemap» → `https://glorg225.github.io/globe-radio/sitemap.xml`. Важно: на адресе github.io поисковики не читают `robots.txt` из папки сайта, поэтому карту нужно отправить вручную.
3. **Search Console — проверить индексацию** главной и 2–3 страниц городов: «Проверка URL» → «Запросить индексирование».
4. **Analytics — связать с Search Console:** Администратор → «Связи с Search Console» → выбрать ресурс.
5. **Analytics — отметить ключевое событие** `play_station` (Администратор → События → «Отметить как ключевое»): это главный показатель — человек начал слушать.
6. **Bing Webmaster Tools** (https://www.bing.com/webmasters) → «Импорт из Google Search Console» — один клик, плюс трафик из Bing, DuckDuckGo, Yahoo.
7. **Свой домен** (задача #14): заметно лучше для SEO; переезжать лучше раньше. Купить (например, Cloudflare Registrar) и прислать название.
8. **Внешние ссылки и упоминания** (главный фактор ранжирования для нового сайта):
   - Product Hunt (запуск), Hacker News «Show HN», Reddit: r/InternetIsBeautiful, r/radio, r/languagelearning (режим «Learn a language»);
   - каталоги: AlternativeTo (как альтернатива Radio Garden), сайты-подборки онлайн-радио и сервисов для изучения языков;
   - рассказать Radio Browser (источник данных) — у них есть список приложений.
9. **Политика конфиденциальности (GDPR).** Баннер согласия по правилам ЕС должен ссылаться на короткую страницу: кто ведёт сайт, что статистика уходит в Google Analytics, сколько хранится, как отказаться. Нужно решение владельца: чьё имя и какой e-mail указать — Claude сделает страницу `privacy.html` и ссылки на неё.
10. **Шрифты Google** грузятся до согласия (адрес посетителя уходит Google). Для строгого соответствия GDPR лучше хранить шрифты на самом сайте — скажите, и Claude это сделает.
11. **Раз в месяц:** Search Console → «Эффективность»: по каким запросам приходят, какие страницы растут; присылать Claude — он усилит такие страницы.

## 3. Что Claude может сделать в браузере сам
Если владелец вошёл в Google в браузере приложения (Claude не вводит пароли): отправить sitemap, запросить индексирование страниц, проверить страницы в Rich Results Test (https://search.google.com/test/rich-results) и PageSpeed Insights, посмотреть отчёты Search Console и Analytics и предложить улучшения.

## 4. Следующие шаги SEO (кандидаты в задачи)
- Страницы языков («Spanish radio stations online») — для режима «Learn a language».
- Страницы жанров (jazz, news, classical…) — по тегам станций.
- Короткие тексты о городах (из Википедии, с указанием лицензии) на страницах городов.
- `hreflang` — когда появятся другие языки сайта.
