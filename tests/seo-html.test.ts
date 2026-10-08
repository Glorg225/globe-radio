import { expect, test } from 'vitest';
import type { StationLite } from '../src/data/shards';
import type { CityPage, CountryPage } from '../scripts/seo/model';
import { cityPage, countryPage, genreCountryPage, genreIndexPage, genrePage, indexPage, notFoundPage, type Site } from '../scripts/seo/html';
import { buildGenres, stylesOf } from '../scripts/seo/genres';

const site: Site = { url: 'https://example.com/gr', base: '/gr/' };
const EVIL = '</script><script>alert(1)</script>';
const st = (id: string, o: Partial<StationLite> = {}): StationLite => ({
  id, name: `Station ${id}`, url: '', placeId: 'c:1', cc: 'PT', langs: ['pt'], tags: ['news', 'talk', '64kbps', 'viseu'], votes: 0, clicks: 0, favicon: '', hls: false, ...o,
});

function fixture() {
  const lisbon: CityPage = { cc: 'PT', name: 'Lisbon', slug: 'lisbon', lat: 38.7, lon: -9.1, tz: 'Europe/Lisbon', stations: [st('s1', { name: EVIL }), st('s2'), st('s3')] };
  const porto: CityPage = { cc: 'PT', name: 'Porto', slug: 'porto', lat: 41.1, lon: -8.6, tz: 'Europe/Lisbon', stations: [st('s4'), st('s5'), st('s6')] };
  const extra = Array.from({ length: 60 }, (_, i) => st(`x${i}`));
  const pt: CountryPage = { cc: 'PT', name: 'Portugal', slug: 'portugal', stations: [...lisbon.stations, ...porto.stations, ...extra], cities: [lisbon, porto] };
  return { pt, lisbon, porto };
}

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const meta = (doc: Document, sel: string) => doc.querySelector(sel)?.getAttribute('content') ?? doc.querySelector(sel)?.getAttribute('href');
const ld = (doc: Document) => [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent ?? ''));

function commonChecks(html: string) {
  const doc = parse(html);
  expect(doc.documentElement.lang).toBe('en');
  expect(html.split('<!-- analytics -->')).toHaveLength(2);
  expect(html.indexOf('<!-- analytics -->')).toBeLessThan(html.indexOf('</head>'));
  expect(html).not.toMatch(/[А-Яа-яЁё]/);
  expect((meta(doc, 'meta[name="description"]') ?? '').length).toBeLessThanOrEqual(160);
  expect(doc.querySelectorAll('h1')).toHaveLength(1);
  return doc;
}

test('city page: title, canonical, social tags, H1, breadcrumbs', () => {
  const { pt, lisbon, porto } = fixture();
  const doc = commonChecks(cityPage(site, { country: pt, city: lisbon }, [{ country: pt, city: porto }]));
  expect(doc.title).toBe('Lisbon Radio Stations — Listen Live Online | Globe Radio');
  expect(meta(doc, 'link[rel="canonical"]')).toBe('https://example.com/gr/radio/portugal/lisbon/');
  expect(meta(doc, 'meta[property="og:url"]')).toBe('https://example.com/gr/radio/portugal/lisbon/');
  expect(meta(doc, 'meta[property="og:image"]')).toBe('https://example.com/gr/og.png');
  expect(meta(doc, 'meta[property="og:title"]')).toBe(doc.title);
  expect(meta(doc, 'meta[name="twitter:card"]')).toBe('summary_large_image');
  expect(doc.querySelector('h1')!.textContent).toBe('Lisbon Radio Stations');
  expect([...doc.querySelectorAll('.crumbs li')].map((li) => li.textContent)).toEqual(['Home', 'Portugal', 'Lisbon']);
  expect(doc.querySelector('.crumbs a[href="/gr/radio/portugal/"]')).not.toBeNull();
  expect(doc.querySelector('.intro')!.textContent).toContain('Europe/Lisbon');
});

test('city page: stations with Listen links, nearby cities, link to the country', () => {
  const { pt, lisbon, porto } = fixture();
  const doc = parse(cityPage(site, { country: pt, city: lisbon }, [{ country: pt, city: porto }]));
  const listen = [...doc.querySelectorAll<HTMLAnchorElement>('a.listen')];
  expect(listen).toHaveLength(3);
  expect(listen[1].getAttribute('href')).toBe('/gr/?station=s2&c=PT');
  expect(listen[1].getAttribute('aria-label')).toBe('Listen to Station s2');
  expect(doc.querySelector('.station__meta')!.textContent).toBe('Portuguese · News · Talk');
  expect(doc.querySelector('.nearby a[href="/gr/radio/portugal/porto/"]')).not.toBeNull();
  expect(doc.querySelector('a[href="/gr/radio/portugal/"]')).not.toBeNull();
});

test('station names are escaped in the page and in JSON-LD', () => {
  const { pt, lisbon } = fixture();
  const html = cityPage(site, { country: pt, city: lisbon }, []);
  expect(html).not.toContain('<script>alert');
  const doc = parse(html);
  expect(doc.querySelector('.station__name')!.textContent).toBe(EVIL);
  expect(html).toContain('\\u003c/script>');
  const list = ld(doc).find((d) => d['@type'] === 'ItemList');
  expect(list.itemListElement[0].item.name).toBe(EVIL);
});

test('JSON-LD: breadcrumbs and a list of radio stations with absolute URLs', () => {
  const { pt, lisbon } = fixture();
  const data = ld(parse(cityPage(site, { country: pt, city: lisbon }, [])));
  const crumbs = data.find((d) => d['@type'] === 'BreadcrumbList');
  expect(crumbs.itemListElement.map((i: { item: string }) => i.item)).toEqual([
    'https://example.com/gr/', 'https://example.com/gr/radio/portugal/', 'https://example.com/gr/radio/portugal/lisbon/',
  ]);
  const list = data.find((d) => d['@type'] === 'ItemList');
  expect(list.itemListElement[1]).toEqual({ '@type': 'ListItem', position: 2, item: { '@type': 'RadioStation', name: 'Station s2', url: 'https://example.com/gr/?station=s2&c=PT', address: { '@type': 'PostalAddress', addressLocality: 'Lisbon', addressCountry: 'PT' } } });
});

test('country page: top 50 stations, links to its cities, JSON-LD capped at 50', () => {
  const { pt } = fixture();
  const doc = commonChecks(countryPage(site, pt));
  expect(doc.title).toBe('Portugal Radio Stations — Listen Live Online | Globe Radio');
  expect(meta(doc, 'link[rel="canonical"]')).toBe('https://example.com/gr/radio/portugal/');
  expect(doc.querySelector('h1')!.textContent).toBe('Portugal Radio Stations');
  expect(doc.querySelectorAll('a.listen')).toHaveLength(50);
  expect([...doc.querySelectorAll('.cities a')].map((a) => a.getAttribute('href'))).toEqual(['/gr/radio/portugal/lisbon/', '/gr/radio/portugal/porto/']);
  expect(ld(doc).find((d) => d['@type'] === 'ItemList').itemListElement).toHaveLength(50);
  expect(doc.querySelector('.intro')!.textContent).toContain('2 cities');
  expect(doc.querySelector('.intro')!.textContent).toContain('Popular styles: News and Talk.');
});

test('index page lists every country', () => {
  const { pt } = fixture();
  const es: CountryPage = { ...pt, cc: 'ES', name: 'Spain', slug: 'spain', cities: [] };
  const doc = commonChecks(indexPage(site, [pt, es]));
  expect(doc.title).toBe('Radio Stations by Country — Listen Live Online | Globe Radio');
  expect(meta(doc, 'link[rel="canonical"]')).toBe('https://example.com/gr/radio/');
  expect([...doc.querySelectorAll('.countries a')].map((a) => a.getAttribute('href'))).toEqual(['/gr/radio/portugal/', '/gr/radio/spain/']);
});

test('404 page: noindex, no canonical, links home and to all countries', () => {
  const doc = commonChecks(notFoundPage(site));
  expect(doc.querySelector('h1')!.textContent).toBe('Page not found');
  expect(meta(doc, 'meta[name="robots"]')).toBe('noindex');
  expect(doc.querySelector('link[rel="canonical"]')).toBeNull();
  expect(doc.querySelector('main a[href="/gr/"]')).not.toBeNull();
  expect(doc.querySelector('main a[href="/gr/radio/"]')).not.toBeNull();
});

test('footer: attribution, link to all countries, cookie settings hidden until the consent snippet exists', () => {
  const { pt } = fixture();
  const doc = parse(countryPage(site, pt));
  const foot = doc.querySelector('footer')!;
  expect(foot.textContent).toContain('Radio Browser');
  expect(foot.textContent).toContain("We don't store or rebroadcast streams");
  expect(foot.querySelector('a[href="/gr/radio/"]')).not.toBeNull();
  expect(foot.querySelector<HTMLElement>('.cookies')!.hidden).toBe(true);
});

test('JSON-LD stations carry the logo (https only) and the city and country as address', () => {
  const { pt, lisbon } = fixture();
  lisbon.stations[1].favicon = 'https://cdn.example/logo.png';
  lisbon.stations[2].favicon = 'http://insecure.example/logo.png';
  const items = ld(parse(cityPage(site, { country: pt, city: lisbon }, []))).find((d) => d['@type'] === 'ItemList').itemListElement;
  expect(items[1].item.image).toBe('https://cdn.example/logo.png');
  expect(items[2].item).not.toHaveProperty('image');
  expect(items[1].item.address).toEqual({ '@type': 'PostalAddress', addressLocality: 'Lisbon', addressCountry: 'PT' });
});

test('nothing blocks the first paint: styles inline, web fonts load without blocking', () => {
  const { pt } = fixture();
  const html = countryPage({ ...site, css: '.x{color:var(--text)}' }, pt);
  const doc = parse(html);
  expect(doc.querySelector('head style')!.textContent).toBe('.x{color:var(--text)}');
  expect(doc.querySelector('link[rel="stylesheet"][href*="seo.css"]')).toBeNull();
  // The only stylesheet link to Google Fonts is inside <noscript>; scripts load it via preload + onload.
  expect([...doc.querySelectorAll('head > link[rel="stylesheet"]')].map((l) => l.getAttribute('href'))).toEqual([]);
  const preload = doc.querySelector('link[rel="preload"][as="style"]')!;
  expect(preload.getAttribute('href')).toContain('fonts.googleapis.com');
  expect(preload.getAttribute('onload')).toContain("this.rel='stylesheet'");
  expect(html).toMatch(/<noscript><link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com/);
});

test('station image only for https links to an image file; country pages give the station city', () => {
  const { pt, lisbon } = fixture();
  lisbon.stations[0].favicon = 'https://cdn.example/favicon.ico';
  lisbon.stations[1].favicon = 'https://cdn.example/logo.PNG?v=2';
  lisbon.stations[2].favicon = 'https://cdn.example/logo';
  const items = ld(parse(cityPage(site, { country: pt, city: lisbon }, []))).find((d) => d['@type'] === 'ItemList').itemListElement;
  expect(items.map((i: { item: { image?: string } }) => i.item.image)).toEqual([undefined, 'https://cdn.example/logo.PNG?v=2', undefined]);
  const countryItems = ld(parse(countryPage(site, pt))).find((d) => d['@type'] === 'ItemList').itemListElement;
  expect(countryItems[0].item.address).toEqual({ '@type': 'PostalAddress', addressLocality: 'Lisbon', addressCountry: 'PT' });
});

test('inlined CSS cannot close the style element', () => {
  const { pt } = fixture();
  const doc = parse(countryPage({ ...site, css: '/* </style><script>x()</script> */ .a{}' }, pt));
  expect(doc.querySelector('head style')!.textContent).toContain('.a{}');
  expect(doc.querySelectorAll('script:not([type])')).toHaveLength(1);
});

function genres() {
  const { pt } = fixture();
  const pages = buildGenres([pt]);
  return { pt, pages, news: pages.find((p) => p.genre.id === 'news')! };
}

test('style index: all styles with a page, in three groups', () => {
  const { pages } = genres();
  const doc = commonChecks(genreIndexPage(site, pages));
  expect(doc.title).toBe('Radio Stations by Style — Listen Live Online | Globe Radio');
  expect(meta(doc, 'link[rel="canonical"]')).toBe('https://example.com/gr/radio/genre/');
  expect([...doc.querySelectorAll('h2')].map((h) => h.textContent)).toEqual(['Formats']);
  expect([...doc.querySelectorAll('.styles a')].map((a) => a.getAttribute('href'))).toEqual(['/gr/radio/genre/news/', '/gr/radio/genre/talk/']);
});

test('style page: stations worldwide and links to the style in each country', () => {
  const { news } = genres();
  const doc = commonChecks(genrePage(site, news));
  expect(doc.title).toBe('News Radio Stations — Listen Live Online | Globe Radio');
  expect(meta(doc, 'link[rel="canonical"]')).toBe('https://example.com/gr/radio/genre/news/');
  expect(doc.querySelector('h1')!.textContent).toBe('News Radio Stations');
  expect([...doc.querySelectorAll('.crumbs li')].map((li) => li.textContent)).toEqual(['Home', 'Styles', 'News']);
  expect(doc.querySelectorAll('a.listen')).toHaveLength(50);
  expect(doc.querySelector('.countries a[href="/gr/radio/genre/news/portugal/"]')).not.toBeNull();
  expect(ld(doc).find((d) => d['@type'] === 'ItemList').itemListElement).toHaveLength(50);
});

test('style in a country: title, crumbs, links to the country and to the style worldwide', () => {
  const { news } = genres();
  const doc = commonChecks(genreCountryPage(site, news, news.countries[0]));
  expect(doc.title).toBe('News Radio Stations in Portugal — Listen Live Online | Globe Radio');
  expect(meta(doc, 'link[rel="canonical"]')).toBe('https://example.com/gr/radio/genre/news/portugal/');
  expect([...doc.querySelectorAll('.crumbs li')].map((li) => li.textContent)).toEqual(['Home', 'Styles', 'News', 'Portugal']);
  expect(doc.querySelector('main a[href="/gr/radio/portugal/"]')).not.toBeNull();
  expect(doc.querySelector('main a[href="/gr/radio/genre/news/"]')).not.toBeNull();
  expect(doc.querySelector('.station__name')!.textContent).toBe(EVIL);
});

test('country and city pages: popular styles link to the style in that country; intro names styles, not raw tags', () => {
  const { pt, pages } = genres();
  const doc = parse(countryPage(site, pt, stylesOf(pt.stations, pages, pt)));
  expect([...doc.querySelectorAll('.styles a')].map((a) => a.getAttribute('href'))).toEqual(['/gr/radio/genre/news/portugal/', '/gr/radio/genre/talk/portugal/']);
  expect(doc.querySelector('.intro')!.textContent).toContain('Popular styles: News and Talk.');
  const city = parse(cityPage(site, { country: pt, city: pt.cities[0] }, [], stylesOf(pt.cities[0].stations, pages, pt)));
  expect(city.querySelector('.styles a[href="/gr/radio/genre/news/portugal/"]')).not.toBeNull();
});

test('the country index and the footer link to the styles', () => {
  const { pt } = genres();
  const doc = parse(indexPage(site, [pt]));
  expect(doc.querySelector('main a[href="/gr/radio/genre/"]')).not.toBeNull();
  expect(doc.querySelector('footer a[href="/gr/radio/genre/"]')).not.toBeNull();
});

test('sentences put "the" before such country names; one country reads in the singular', () => {
  const { pt } = fixture();
  const us: CountryPage = { ...pt, cc: 'US', name: 'United States', slug: 'united-states', cities: [] };
  const doc = parse(countryPage(site, us));
  expect(doc.querySelector('.intro')!.textContent).toMatch(/^The United States has /);
  expect(meta(doc, 'meta[name="description"]')).toContain('from the United States online');
  const news = buildGenres([us]).find((p) => p.genre.id === 'news')!;
  expect(parse(genrePage(site, news)).querySelector('.intro')!.textContent).toContain('The biggest country for News radio is the United States.');
  expect(parse(genreCountryPage(site, news, news.countries[0])).querySelector('.intro')!.textContent).toMatch(/^The United States has /);
});
