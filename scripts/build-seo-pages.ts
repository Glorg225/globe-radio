// Static SEO pages, run after `vite build`: /radio/, /radio/<country>/, /radio/<country>/<city>/,
// plus sitemap.xml, robots.txt and 404.html in the site root. Reads the station snapshot in public/data/.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePlace, type PlacesFile } from '../src/data/places';
import { decodeStation, type PlaceInfo, type ShardFile } from '../src/data/shards';
import { seoCountryName } from '../src/seo/country';
import { cityPage, cityPath, countryPage, countryPath, indexPage, notFoundPage, radioPath, type Site } from './seo/html';
import { allCities, buildModel, nearbyCities, type CountryData } from './seo/model';
import { robotsTxt, sitemapXml } from './seo/sitemap';

export const DEFAULT_SITE_URL = 'https://glorg225.github.io/globe-radio';

export function siteFromEnv(env: Record<string, string | undefined>): Site {
  const url = (env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const base = `/${(env.BASE_PATH || '/').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
  return { url, base };
}

export interface BuildOptions { dataDir: string; outDir: string; site: Site; css: string }

function readJson<T>(file: string): T | null {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null;
}

function write(outDir: string, file: string, content: string): void {
  const path = join(outDir, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

// Returns null (and writes nothing) when there is no snapshot, so local builds and tests still pass.
export function buildSeoPages({ dataDir, outDir, site: siteBase, css }: BuildOptions): { countries: number; cities: number } | null {
  const file = readJson<PlacesFile>(join(dataDir, 'places.json'));
  if (!file || file.v !== 2 || !Array.isArray(file.places)) return null;
  const places = file.places.map(decodePlace);
  const site: Site = { ...siteBase, css };

  const data = new Map<string, CountryData>();
  for (const cc of new Set(places.map((p) => p.cc))) {
    const shard = readJson<ShardFile>(join(dataDir, 'stations', `${cc}.json`));
    if (!shard || !Array.isArray(shard.stations)) continue;
    const info = new Map<string, PlaceInfo>((shard.places ?? []).map(([id, tz, wikiRu, wikiEn]) => [id, { tz, wikiRu, wikiEn }]));
    data.set(cc, { stations: shard.stations.map((c) => decodeStation(c, cc)), info });
  }
  const snapshotNames = new Map(places.filter((p) => p.kind === 'country').map((p) => [p.cc, p.name]));
  const countries = buildModel(places, data, (cc) => seoCountryName(cc, snapshotNames.get(cc)));
  const cities = allCities(countries);

  write(outDir, `${radioPath()}index.html`, indexPage(site, countries));
  for (const c of countries) write(outDir, `${countryPath(c)}index.html`, countryPage(site, c));
  for (const ref of cities) write(outDir, `${cityPath(ref)}index.html`, cityPage(site, ref, nearbyCities(ref, cities)));
  write(outDir, '404.html', notFoundPage(site));

  const lastmod = readJson<{ generated?: string }>(join(dataDir, 'meta.json'))?.generated ?? file.generated ?? '';
  const urls = ['', radioPath(), ...countries.map(countryPath), ...cities.map(cityPath)].map((p) => `${site.url}/${p}`);
  write(outDir, 'sitemap.xml', sitemapXml(urls, lastmod));
  write(outDir, 'robots.txt', robotsTxt(site.url));
  return { countries: countries.length, cities: cities.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const css = `${readFileSync('src/ui/tokens.css', 'utf8')}\n${readFileSync('scripts/seo/seo.css', 'utf8')}`;
  const result = buildSeoPages({ dataDir: 'public/data', outDir: 'dist', site: siteFromEnv(process.env), css });
  if (result) console.log(`build-seo-pages: ${result.countries} countries, ${result.cities} cities`);
  else console.warn('build-seo-pages: no snapshot in public/data/ (run `npm run snapshot`), SEO pages skipped');
}
