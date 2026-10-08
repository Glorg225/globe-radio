import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { buildSeoPages, DEFAULT_SITE_URL, siteFromEnv } from '../scripts/build-seo-pages';
import { encodePlace, type Place } from '../src/data/places';
import { encodeStation, type StationLite } from '../src/data/shards';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'seo-'));
  dirs.push(d);
  return d;
}

const place = (o: Partial<Place>): Place => ({ id: 'c:1', lat: 0, lon: 0, kind: 'exact', cc: 'PT', nameRu: '', name: 'X', count: 0, pop: 0, langs: {}, ...o });
const st = (id: string, placeId: string): StationLite => ({
  id, name: `S${id}`, url: 'https://a', placeId, cc: 'PT', langs: ['pt'], tags: ['pop'], votes: 0, clicks: 0, favicon: '', hls: false,
});

function snapshot(dir: string) {
  const places = [place({ id: 'k:PT', kind: 'country', name: 'Portugal', count: 1 }), place({ id: 'c:10', name: 'Lisbon', count: 3 }), place({ id: 'c:20', name: 'Porto', count: 1 })];
  const stations = [st('1', 'c:10'), st('2', 'c:10'), st('3', 'c:10'), st('4', 'c:20'), st('5', 'k:PT')];
  mkdirSync(join(dir, 'stations'), { recursive: true });
  writeFileSync(join(dir, 'places.json'), JSON.stringify({ v: 2, generated: '2026-10-07T16:21:04.852Z', places: places.map(encodePlace) }));
  writeFileSync(join(dir, 'stations', 'PT.json'), JSON.stringify({ v: 2, cc: 'PT', stations: stations.map(encodeStation), places: [['c:10', 'Europe/Lisbon', '', '']] }));
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({ generated: '2026-10-08T03:17:00.000Z' }));
}

const site = { url: 'https://example.com/gr', base: '/gr/' };
const css = ':root { --bg: #000; }';

test('writes country, city, index and 404 pages, sitemap, robots and the stylesheet', () => {
  const data = tmp();
  const out = tmp();
  snapshot(data);
  expect(buildSeoPages({ dataDir: data, outDir: out, site, css })).toEqual({ countries: 1, cities: 1 });
  for (const f of ['radio/index.html', 'radio/portugal/index.html', 'radio/portugal/lisbon/index.html', '404.html', 'robots.txt']) {
    expect(existsSync(join(out, f)), f).toBe(true);
  }
  expect(existsSync(join(out, 'radio/portugal/porto/index.html'))).toBe(false);
  expect(readFileSync(join(out, 'radio/portugal/lisbon/index.html'), 'utf8')).toContain('Local time zone: Europe/Lisbon.');
  expect(readFileSync(join(out, 'radio/seo.css'), 'utf8')).toBe(css);
  const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8');
  expect([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])).toEqual([
    'https://example.com/gr/', 'https://example.com/gr/radio/', 'https://example.com/gr/radio/portugal/', 'https://example.com/gr/radio/portugal/lisbon/',
  ]);
  expect(sitemap).toContain('<lastmod>2026-10-08</lastmod>');
});

test('without a snapshot it builds nothing and returns null', () => {
  const out = tmp();
  expect(buildSeoPages({ dataDir: join(tmp(), 'missing'), outDir: out, site, css })).toBeNull();
  expect(existsSync(join(out, 'radio'))).toBe(false);
});

test('siteFromEnv: defaults and slashes', () => {
  expect(siteFromEnv({})).toEqual({ url: DEFAULT_SITE_URL, base: '/' });
  expect(DEFAULT_SITE_URL).toBe('https://glorg225.github.io/globe-radio');
  expect(siteFromEnv({ VITE_SITE_URL: 'https://x.org/r/', BASE_PATH: '/r' })).toEqual({ url: 'https://x.org/r', base: '/r/' });
  expect(siteFromEnv({ VITE_SITE_URL: '', BASE_PATH: 'r/' })).toEqual({ url: DEFAULT_SITE_URL, base: '/r/' });
});

test('country links in the app point to generated pages', async () => {
  const { topCountries } = await import('../src/seo/country');
  const { decodePlace } = await import('../src/data/places');
  const data = tmp();
  const out = tmp();
  snapshot(data);
  buildSeoPages({ dataDir: data, outDir: out, site, css });
  const places = JSON.parse(readFileSync(join(data, 'places.json'), 'utf8')).places.map(decodePlace);
  const links = topCountries(places);
  expect(links.map((c) => c.path)).toEqual(['radio/portugal/']);
  for (const c of links) expect(existsSync(join(out, c.path, 'index.html')), c.path).toBe(true);
});

test('app country links match generated pages even when country slugs collide', async () => {
  const { topCountries } = await import('../src/seo/country');
  const { decodePlace } = await import('../src/data/places');
  const data = tmp();
  const out = tmp();
  const p = (id: string, cc: string, count: number) => place({ id, cc, kind: 'country', name: 'Atlantis', count });
  const places = [p('k:AA', 'AA', 3), p('k:AB', 'AB', 4)];
  mkdirSync(join(data, 'stations'), { recursive: true });
  writeFileSync(join(data, 'places.json'), JSON.stringify({ v: 2, generated: '', places: places.map(encodePlace) }));
  for (const pl of places) {
    const stations = Array.from({ length: pl.count }, (_, i) => ({ ...st(`${pl.cc}${i}`, pl.id), cc: pl.cc }));
    writeFileSync(join(data, 'stations', `${pl.cc}.json`), JSON.stringify({ v: 2, cc: pl.cc, stations: stations.map(encodeStation) }));
  }
  buildSeoPages({ dataDir: data, outDir: out, site, css });
  const links = topCountries(JSON.parse(readFileSync(join(data, 'places.json'), 'utf8')).places.map(decodePlace));
  expect(links.map((c) => c.path)).toEqual(['radio/atlantis/', 'radio/atlantis-aa/']);
  for (const c of links) expect(existsSync(join(out, c.path, 'index.html')), c.path).toBe(true);
});
