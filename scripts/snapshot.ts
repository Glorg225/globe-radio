import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { decodeGazetteer, type GazetteerFile } from '../src/data/gazetteer';
import { countryName } from '../src/data/place-name';
import { createPlaceMatcher } from '../src/data/place-match';
import { encodePlace, type PlacesFile } from '../src/data/places';
import { encodeStation, type ShardFile } from '../src/data/shards';
import type { Centroids, RawStation } from '../src/data/types';
import { buildSnapshot, placeInfoRows, searchRows } from './build-snapshot';
import { fetchWithMirrors } from './radio-browser';

const require = createRequire(import.meta.url);
const countries = require('world-countries/countries.json') as { cca2: string; latlng: [number, number] }[];
const centroids: Centroids = Object.fromEntries(countries.map((c) => [c.cca2, c.latlng]));
const gz = decodeGazetteer(JSON.parse(readFileSync('data/gazetteer.json', 'utf8')) as GazetteerFile);
// Same country names as the app and the SEO pages ("Hong Kong", not "Hong Kong SAR China").
const matcher = createPlaceMatcher(gz, centroids, countryName);

const raw = await fetchWithMirrors<RawStation[]>('/json/stations/search?hidebroken=true&is_https=true&limit=200000&order=clickcount&reverse=true');
const { places, shards, report } = buildSnapshot(raw, centroids, matcher);
if (report.stations < 1000) throw new Error(`suspiciously few stations: ${report.stations}`);

const generated = new Date().toISOString();
rmSync('public/data', { recursive: true, force: true });
mkdirSync('public/data/stations', { recursive: true });
const placesFile: PlacesFile = { v: 2, generated, places: places.map(encodePlace) };
writeFileSync('public/data/places.json', JSON.stringify(placesFile));
writeFileSync('public/data/search.json', JSON.stringify({ v: 1, stations: searchRows(shards) }));
for (const [cc, list] of shards) {
  const file: ShardFile = { v: 2, cc, stations: list.map(encodeStation), places: placeInfoRows(places, cc) };
  writeFileSync(`public/data/stations/${cc}.json`, JSON.stringify(file));
}
writeFileSync('public/data/meta.json', JSON.stringify({ generated, ...report }, null, 2));
console.log(JSON.stringify({ generated, ...report, unknownLanguages: report.unknownLanguages.slice(0, 10) }, null, 2));
