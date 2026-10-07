// HTML templates for the static SEO pages. Station names and tags are third-party data:
// everything goes through escapeHtml, JSON-LD through jsonLd().
import type { StationLite } from '../../src/data/shards';
import { escapeHtml as esc } from '../../src/ui/html';
import type { CityRef, CountryPage } from './model';
import { fitDescription, genreTags, languageName, listPhrase, plural, topGenres, topLanguages } from './text';

// url: absolute site address without a trailing slash; base: path prefix with a trailing slash.
export interface Site { url: string; base: string }

const SITE_NAME = 'Globe Radio';
const TOP_STATIONS = 50;
const FONTS = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700&family=Golos+Text:wght@400;500;600&display=swap';

export const radioPath = () => 'radio/';
export const countryPath = (c: CountryPage) => `radio/${c.slug}/`;
export const cityPath = (r: CityRef) => `radio/${r.country.slug}/${r.city.slug}/`;
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
    `<link rel="stylesheet" href="${FONTS}">`,
    `<link rel="stylesheet" href="${esc(link(site, 'radio/seo.css'))}">`,
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
<p><a href="${esc(link(site, radioPath()))}">Radio stations by country</a><span class="cookies" hidden> · <button type="button" class="link-btn" onclick="window.globeConsent.open()">Cookie settings</button></span></p>
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

function stationsData(site: Site, name: string, stations: StationLite[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: stations.slice(0, TOP_STATIONS).map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: { '@type': 'RadioStation', name: s.name, url: `${site.url}/${stationQuery(s)}` },
    })),
  };
}

function stationItem(site: Site, s: StationLite, exclude: string[]): string {
  const details = [...s.langs.slice(0, 1).map(languageName), ...genreTags(s.tags, exclude).slice(0, 4)];
  return `<li class="station"><div class="station__text"><span class="station__name">${esc(s.name)}</span>${
    details.length ? `<span class="station__meta">${esc(details.join(' · '))}</span>` : ''
  }</div><a class="listen" href="${esc(listenHref(site, s))}" aria-label="${esc(`Listen to ${s.name}`)}">Listen</a></li>`;
}

function stationList(site: Site, stations: StationLite[], exclude: string[]): string {
  return `<ol class="stations">${stations.map((s) => stationItem(site, s, exclude)).join('')}</ol>`;
}

function linkList(cls: string, items: { href: string; name: string; count: number }[]): string {
  return `<ul class="links ${cls}">${items
    .map((i) => `<li><a href="${esc(i.href)}">${esc(i.name)}</a> <span class="count">${i.count.toLocaleString('en-US')}</span></li>`)
    .join('')}</ul>`;
}

function summary(stations: StationLite[], exclude: string[]): string {
  const langs = topLanguages(stations);
  const genres = topGenres(stations, exclude);
  return [
    langs.length ? `Most broadcast in ${listPhrase(langs)}.` : '',
    genres.length ? `Popular genres: ${listPhrase(genres)}.` : '',
  ].filter(Boolean).join(' ');
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
    main: `<section><h2>All countries</h2>${linkList('countries', countries.map((c) => ({ href: link(site, countryPath(c)), name: c.name, count: c.stations.length })))}</section>`,
  });
}

export function countryPage(site: Site, c: CountryPage): string {
  const exclude = [c.name];
  const n = c.stations.length;
  const cities = c.cities.length ? ` in ${plural(c.cities.length, 'city', 'cities')}` : '';
  return layout(site, {
    path: countryPath(c),
    title: title(c.name),
    description: fitDescription(lead(n, c.name), c.stations.map((s) => s.name), TAIL),
    h1: `${c.name} Radio Stations`,
    intro: `${c.name} has ${plural(n, 'live radio station')} on ${SITE_NAME}${cities}. ${summary(c.stations, exclude)}`.trim(),
    crumbs: [home, { name: c.name, path: countryPath(c) }],
    data: [stationsData(site, `${c.name} radio stations`, c.stations)],
    main: [
      `<section><h2>Most popular stations in ${esc(c.name)}</h2>${stationList(site, c.stations.slice(0, TOP_STATIONS), exclude)}</section>`,
      c.cities.length
        ? `<section><h2>Radio by city</h2>${linkList('cities', c.cities.map((city) => ({ href: link(site, cityPath({ country: c, city })), name: city.name, count: city.stations.length })))}</section>`
        : '',
    ].join('\n'),
  });
}

export function cityPage(site: Site, ref: CityRef, nearby: CityRef[]): string {
  const { country, city } = ref;
  const exclude = [country.name, city.name];
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
    intro: [`${where} has ${plural(n, 'live radio station')} on ${SITE_NAME}.`, summary(city.stations, exclude), city.tz ? `Local time zone: ${city.tz}.` : '']
      .filter(Boolean).join(' '),
    crumbs: [home, { name: country.name, path: countryPath(country) }, { name: city.name, path: cityPath(ref) }],
    data: [stationsData(site, `${city.name} radio stations`, city.stations)],
    main: [
      `<section><h2>Stations in ${esc(city.name)}</h2>${stationList(site, city.stations, exclude)}</section>`,
      nearbyItems.length ? `<section><h2>Nearby cities</h2>${linkList('nearby', nearbyItems)}</section>` : '',
      `<p class="more"><a href="${esc(link(site, countryPath(country)))}">All radio stations in ${esc(country.name)}</a></p>`,
    ].join('\n'),
  });
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
