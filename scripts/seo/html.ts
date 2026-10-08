// HTML templates for the static SEO pages. Station names and tags are third-party data:
// everything goes through escapeHtml, JSON-LD through jsonLd().
import { genreById, stationGenres, type Genre, type GenreGroup } from '../../src/data/genres';
import type { StationLite } from '../../src/data/shards';
import { escapeHtml as esc } from '../../src/ui/html';
import { countStyles, hasCountryPage, STYLE_MIN_HERE, type GenreCountry, type GenrePage, type StyleHere } from './genres';
import type { CityRef, CountryPage } from './model';
import { countryInSentence, fitDescription, languageName, listPhrase, plural, topLanguages } from './text';

// url: absolute site address without a trailing slash; base: path prefix with a trailing slash;
// css: the stylesheet, inlined into every page (one request less before the first paint).
export interface Site { url: string; base: string; css?: string }

const SITE_NAME = 'Globe Radio';
const TOP_STATIONS = 50;
const FONTS = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700&family=Golos+Text:wght@400;500;600&display=swap';

export const radioPath = () => 'radio/';
export const countryPath = (c: CountryPage) => `radio/${c.slug}/`;
export const cityPath = (r: CityRef) => `radio/${r.country.slug}/${r.city.slug}/`;
export const genreIndexPath = () => 'radio/genre/';
export const genrePath = (g: Genre) => `radio/genre/${g.id}/`;
export const genreCountryPath = (g: Genre, c: CountryPage) => `radio/genre/${g.id}/${c.slug}/`;
const absolute = (site: Site, path: string) => `${site.url}/${path}`;
const link = (site: Site, path: string) => `${site.base}${path}`;
const stationQuery = (s: StationLite) => `?station=${encodeURIComponent(s.id)}&c=${encodeURIComponent(s.cc)}`;
export const listenHref = (site: Site, s: StationLite) => `${site.base}${stationQuery(s)}`;

export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

const title = (subject: string) => `${subject} Radio Stations — Listen Live Online | ${SITE_NAME}`;

interface Crumb { name: string; path: string }

interface Page {
  path?: string; // canonical path; omitted for the 404 page
  title: string;
  description: string;
  h1: string;
  intro: string; // plain text
  crumbs?: Crumb[];
  data?: object[];
  main: string; // HTML
  noindex?: boolean;
}

function layout(site: Site, p: Page): string {
  const canonical = p.path === undefined ? '' : absolute(site, p.path);
  const crumbs = p.crumbs ?? [];
  const data = [...(crumbs.length ? [breadcrumbData(site, crumbs)] : []), ...(p.data ?? [])];
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}">`,
    p.noindex ? '<meta name="robots" content="noindex">' : '',
    canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '',
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:title" content="${esc(p.title)}">`,
    `<meta property="og:description" content="${esc(p.description)}">`,
    canonical ? `<meta property="og:url" content="${esc(canonical)}">` : '',
    `<meta property="og:image" content="${esc(absolute(site, 'og.png'))}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<link rel="icon" type="image/png" href="${esc(link(site, 'icons/icon-192.png'))}">`,
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    // Web fonts must not block the first paint: text shows in the fallback font, then swaps.
    `<link rel="preload" href="${esc(FONTS)}" as="style" onload="this.onload=null;this.rel='stylesheet'">`,
    `<noscript><link rel="stylesheet" href="${esc(FONTS)}"></noscript>`,
    // "</style" inside the CSS would end the element early.
    site.css ? `<style>${site.css.replace(/<\/(style)/gi, '<\\/$1')}</style>` : '',
    ...data.map((d) => `<script type="application/ld+json">${jsonLd(d)}</script>`),
    '<!-- analytics -->',
  ].filter(Boolean);
  const nav = crumbs.length
    ? `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs
      .map((c, i) => (i < crumbs.length - 1 ? `<li><a href="${esc(link(site, c.path))}">${esc(c.name)}</a></li>` : `<li aria-current="page">${esc(c.name)}</li>`))
      .join('')}</ol></nav>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
${head.join('\n')}
</head>
<body>
<header class="top"><a class="logo" href="${esc(site.base)}">${SITE_NAME}</a><a class="btn" href="${esc(site.base)}">Open the 3D globe</a></header>
<main class="page">
${nav}
<h1>${esc(p.h1)}</h1>
<p class="intro">${esc(p.intro)}</p>
${p.main}
</main>
<footer class="foot">
<p><a href="${esc(link(site, radioPath()))}">Radio stations by country</a> · <a href="${esc(link(site, genreIndexPath()))}">Radio stations by style</a><span class="cookies" hidden> · <button type="button" class="link-btn" onclick="window.globeConsent.open()">Cookie settings</button></span></p>
<p>Station directory: <a href="https://www.radio-browser.info/">Radio Browser</a>. Places: <a href="https://www.geonames.org/">GeoNames</a> (CC BY 4.0). Place facts: Wikipedia (CC BY-SA). We don't store or rebroadcast streams.</p>
</footer>
<script>if(window.globeConsent)document.querySelector('.cookies').hidden=false</script>
</body>
</html>
`;
}

function breadcrumbData(site: Site, crumbs: Crumb[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absolute(site, c.path) })),
  };
}

// Station logos from Radio Browser are often .ico or extensionless links: publish only https image files.
const IMAGE_URL = /^https:\/\/[^\s?#]+\.(?:png|jpe?g|gif|webp|svg)(?:[?#]\S*)?$/i;

// address: the station's city when known, and its country; image: the station logo.
function stationsData(site: Site, name: string, stations: StationLite[], locality: (s: StationLite) => string | undefined): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: stations.slice(0, TOP_STATIONS).map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'RadioStation',
        name: s.name,
        url: `${site.url}/${stationQuery(s)}`,
        ...(IMAGE_URL.test(s.favicon) ? { image: s.favicon } : {}),
        address: { '@type': 'PostalAddress', ...(locality(s) ? { addressLocality: locality(s) } : {}), addressCountry: s.cc },
      },
    })),
  };
}

// Language and styles from the dictionary, not raw tags (those mix in bitrates, places and station names).
function stationItem(site: Site, s: StationLite): string {
  const details = [...s.langs.slice(0, 1).map(languageName), ...stationGenres(s.tags).slice(0, 3).map((id) => genreById(id)!.name)];
  return `<li class="station"><div class="station__text"><span class="station__name">${esc(s.name)}</span>${
    details.length ? `<span class="station__meta">${esc(details.join(' · '))}</span>` : ''
  }</div><a class="listen" href="${esc(listenHref(site, s))}" aria-label="${esc(`Listen to ${s.name}`)}">Listen</a></li>`;
}

function stationList(site: Site, stations: StationLite[]): string {
  return `<ol class="stations">${stations.map((s) => stationItem(site, s)).join('')}</ol>`;
}

function linkList(cls: string, items: { href: string; name: string; count: number }[]): string {
  return `<ul class="links ${cls}">${items
    .map((i) => `<li><a href="${esc(i.href)}">${esc(i.name)}</a> <span class="count">${i.count.toLocaleString('en-US')}</span></li>`)
    .join('')}</ul>`;
}

// The 3 most frequent styles (from the style dictionary, not raw tags), same rule as "Popular styles here".
function topStyles(stations: StationLite[], n = 3): string[] {
  return [...countStyles(stations)].filter(([, c]) => c >= STYLE_MIN_HERE).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => genreById(id)!.name);
}

function summary(stations: StationLite[]): string {
  const langs = topLanguages(stations);
  const styles = topStyles(stations);
  return [
    langs.length ? `Most broadcast in ${listPhrase(langs)}.` : '',
    styles.length ? `Popular styles: ${listPhrase(styles)}.` : '',
  ].filter(Boolean).join(' ');
}

// "Popular styles here": the style in this country when that page exists, else the style worldwide.
function stylesSection(site: Site, country: CountryPage, styles: StyleHere[]): string {
  if (!styles.length) return '';
  const items = styles.map((s) => ({
    href: link(site, s.countryPage ? genreCountryPath(s.genre, country) : genrePath(s.genre)),
    name: s.genre.name,
    count: s.count,
  }));
  return `<section><h2>Popular styles here</h2>${linkList('styles', items)}</section>`;
}

const home: Crumb = { name: 'Home', path: '' };
const lead = (n: number, where: string) => `Listen to ${plural(n, 'live radio station')} from ${where} online`;
const TAIL = 'Free, no sign-up.';

export function indexPage(site: Site, countries: CountryPage[]): string {
  const total = countries.reduce((sum, c) => sum + c.stations.length, 0);
  return layout(site, {
    path: radioPath(),
    title: `Radio Stations by Country — Listen Live Online | ${SITE_NAME}`,
    description: `Browse ${plural(total, 'live radio station')} from ${plural(countries.length, 'country', 'countries')}. Pick a country and listen online on ${SITE_NAME}. ${TAIL}`,
    h1: 'Radio Stations by Country',
    intro: `${SITE_NAME} has ${plural(total, 'live radio station')} from ${plural(countries.length, 'country', 'countries')}. Pick a country to see its stations and cities.`,
    crumbs: [home, { name: 'All countries', path: radioPath() }],
    main: [
      `<p class="more"><a href="${esc(link(site, genreIndexPath()))}">Browse by style: jazz, news, 80s and more</a></p>`,
      `<section><h2>All countries</h2>${linkList('countries', countries.map((c) => ({ href: link(site, countryPath(c)), name: c.name, count: c.stations.length })))}</section>`,
    ].join('\n'),
  });
}

const styles: Crumb = { name: 'Styles', path: genreIndexPath() };
const GROUPS: [GenreGroup, string][] = [['genre', 'Genres'], ['format', 'Formats'], ['decade', 'Decades']];
const GENRE_COUNTRY_MAX = 100;
// A city page lists this many stations at most: Mexico City has 374, and the full list made a 171 KB page.
const CITY_MAX = 100;

export function genreIndexPage(site: Site, pages: GenrePage[]): string {
  const total = new Set(pages.flatMap((p) => p.stations.map((s) => s.id))).size;
  const sections = GROUPS.map(([group, heading]) => {
    const list = pages.filter((p) => p.genre.group === group);
    return list.length
      ? `<section><h2>${heading}</h2>${linkList('styles', list.map((p) => ({ href: link(site, genrePath(p.genre)), name: p.genre.name, count: p.stations.length })))}</section>`
      : '';
  });
  return layout(site, {
    path: genreIndexPath(),
    title: `Radio Stations by Style — Listen Live Online | ${SITE_NAME}`,
    description: `Browse ${plural(total, 'live radio station')} by style: music genres, news and talk, and the music of every decade. Listen online on ${SITE_NAME}. ${TAIL}`,
    h1: 'Radio Stations by Style',
    intro: `Pick a style to hear it live from around the world: ${plural(pages.length, 'style')} with ${plural(total, 'station')}.`,
    crumbs: [home, styles],
    main: sections.filter(Boolean).join('\n'),
  });
}

export function genrePage(site: Site, page: GenrePage): string {
  const { genre, stations, countries } = page;
  const n = stations.length;
  const top = countries.slice(0, 3).map((c) => countryInSentence(c.country.name));
  const withPage = countries.filter(hasCountryPage);
  return layout(site, {
    path: genrePath(genre),
    title: title(genre.name),
    description: fitDescription(`Listen to ${plural(n, `live ${genre.name} radio station`)} from ${plural(countries.length, 'country', 'countries')} online`, stations.map((s) => s.name), TAIL),
    h1: `${genre.name} Radio Stations`,
    intro: `${SITE_NAME} has ${plural(n, `live ${genre.name} radio station`)} in ${plural(countries.length, 'country', 'countries')}. ${top.length === 1 ? `The biggest country for ${genre.name} radio is ${top[0]}.` : `The biggest countries for ${genre.name} radio are ${listPhrase(top)}.`}`,
    crumbs: [home, styles, { name: genre.name, path: genrePath(genre) }],
    data: [stationsData(site, `${genre.name} radio stations`, stations, () => undefined)],
    main: [
      `<section><h2>Most popular ${esc(genre.name)} stations</h2>${stationList(site, stations.slice(0, TOP_STATIONS))}</section>`,
      withPage.length
        ? `<section><h2>${esc(genre.name)} radio by country</h2>${linkList('countries', withPage.map((c) => ({ href: link(site, genreCountryPath(genre, c.country)), name: c.country.name, count: c.stations.length })))}</section>`
        : '',
    ].join('\n'),
  });
}

export function genreCountryPage(site: Site, page: GenrePage, gc: GenreCountry): string {
  const { genre } = page;
  const { country, stations } = gc;
  const n = stations.length;
  const where = `${genre.name} Radio Stations in ${countryInSentence(country.name)}`;
  return layout(site, {
    path: genreCountryPath(genre, country),
    title: `${where} — Listen Live Online | ${SITE_NAME}`,
    description: fitDescription(`Listen to ${plural(n, `live ${genre.name} radio station`)} from ${countryInSentence(country.name)} online`, stations.map((s) => s.name), TAIL),
    h1: where,
    intro: [`${countryInSentence(country.name, true)} has ${plural(n, `live ${genre.name} radio station`)} on ${SITE_NAME}.`, summary(stations)].filter(Boolean).join(' '),
    crumbs: [home, styles, { name: genre.name, path: genrePath(genre) }, { name: country.name, path: genreCountryPath(genre, country) }],
    data: [stationsData(site, where, stations, () => undefined)],
    main: [
      `<section><h2>${esc(where)}</h2>${stationList(site, stations.slice(0, GENRE_COUNTRY_MAX))}</section>`,
      `<p class="more"><a href="${esc(link(site, countryPath(country)))}">All radio stations in ${esc(countryInSentence(country.name))}</a> · <a href="${esc(link(site, genrePath(genre)))}">${esc(genre.name)} radio worldwide</a></p>`,
    ].join('\n'),
  });
}

export function countryPage(site: Site, c: CountryPage, styles: StyleHere[] = []): string {
  const cityOf = new Map(c.cities.flatMap((city) => city.stations.map((s) => [s.id, city.name] as const)));
  const n = c.stations.length;
  const cities = c.cities.length ? ` in ${plural(c.cities.length, 'city', 'cities')}` : '';
  return layout(site, {
    path: countryPath(c),
    title: title(c.name),
    description: fitDescription(lead(n, countryInSentence(c.name)), c.stations.map((s) => s.name), TAIL),
    h1: `${c.name} Radio Stations`,
    intro: `${countryInSentence(c.name, true)} has ${plural(n, 'live radio station')} on ${SITE_NAME}${cities}. ${summary(c.stations)}`.trim(),
    crumbs: [home, { name: c.name, path: countryPath(c) }],
    data: [stationsData(site, `${c.name} radio stations`, c.stations, (s) => cityOf.get(s.id))],
    main: [
      `<section><h2>Most popular stations in ${esc(countryInSentence(c.name))}</h2>${stationList(site, c.stations.slice(0, TOP_STATIONS))}</section>`,
      c.cities.length
        ? `<section><h2>Radio by city</h2>${linkList('cities', c.cities.map((city) => ({ href: link(site, cityPath({ country: c, city })), name: city.name, count: city.stations.length })))}</section>`
        : '',
      stylesSection(site, c, styles),
    ].join('\n'),
  });
}

export function cityPage(site: Site, ref: CityRef, nearby: CityRef[], styles: StyleHere[] = []): string {
  const { country, city } = ref;
  const n = city.stations.length;
  const where = `${city.name}, ${country.name}`;
  const nearbyItems = nearby.map((r) => ({
    href: link(site, cityPath(r)),
    name: r.country === country ? r.city.name : `${r.city.name}, ${r.country.name}`,
    count: r.city.stations.length,
  }));
  return layout(site, {
    path: cityPath(ref),
    title: title(city.name),
    description: fitDescription(lead(n, where), city.stations.map((s) => s.name), TAIL),
    h1: `${city.name} Radio Stations`,
    intro: [`${where} has ${plural(n, 'live radio station')} on ${SITE_NAME}.`, summary(city.stations), city.tz ? `Local time zone: ${city.tz}.` : '']
      .filter(Boolean).join(' '),
    crumbs: [home, { name: country.name, path: countryPath(country) }, { name: city.name, path: cityPath(ref) }],
    data: [stationsData(site, `${city.name} radio stations`, city.stations, () => city.name)],
    main: [
      `<section><h2>Stations in ${esc(city.name)}</h2>${stationList(site, city.stations.slice(0, CITY_MAX))}${
        n > CITY_MAX
          ? `<p class="stations-more">Showing the ${CITY_MAX} most popular of ${n.toLocaleString('en-US')} stations. <a href="${esc(site.base)}">Open the 3D globe</a> to hear all of them.</p>`
          : ''
      }</section>`,
      stylesSection(site, country, styles),
      nearbyItems.length ? `<section><h2>Nearby cities</h2>${linkList('nearby', nearbyItems)}</section>` : '',
      `<p class="more"><a href="${esc(link(site, countryPath(country)))}">All radio stations in ${esc(countryInSentence(country.name))}</a></p>`,
    ].join('\n'),
  });
}

// An address that moved (a country renamed): send people and crawlers to the new one, keep it out of the index.
export function redirectPage(site: Site, toPath: string): string {
  const to = link(site, toPath);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved | ${SITE_NAME}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(absolute(site, toPath))}">
<meta http-equiv="refresh" content="0; url=${esc(to)}">
</head>
<body><p><a href="${esc(to)}">This page has moved</a></p></body>
</html>
`;
}

export function notFoundPage(site: Site): string {
  return layout(site, {
    title: `Page not found | ${SITE_NAME}`,
    description: `This page does not exist. Listen to live radio from every country on ${SITE_NAME}.`,
    h1: 'Page not found',
    intro: 'The page you are looking for does not exist or has moved.',
    noindex: true,
    main: `<p class="more"><a href="${esc(site.base)}">Open the 3D globe</a> · <a href="${esc(link(site, radioPath()))}">Radio stations by country</a></p>`,
  });
}
