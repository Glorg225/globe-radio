import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dedupe, encode, toStation } from '../src/data/stations';
import type { Centroids, RawStation, Station } from '../src/data/types';
import { fetchWithMirrors } from './radio-browser';

const require = createRequire(import.meta.url);
const countries = require('world-countries/countries.json') as { cca2: string; latlng: [number, number] }[];
const centroids: Centroids = Object.fromEntries(countries.map((c) => [c.cca2, c.latlng]));

const raw = await fetchWithMirrors<RawStation[]>('/json/stations/search?hidebroken=true&is_https=true&limit=200000&order=clickcount&reverse=true');
const stations = dedupe(raw.map((r) => toStation(r, centroids)).filter((s): s is Station => s !== null));

if (stations.length < 1000) throw new Error(`suspiciously few stations: ${stations.length}`);

const unknown = new Map<string, number>();
for (const r of raw) {
  if (r.language && toStation(r, centroids)?.langs.length === 0) {
    for (const n of r.language.split(',')) {
      const k = n.trim().toLowerCase();
      if (k) unknown.set(k, (unknown.get(k) ?? 0) + 1);
    }
  }
}

const generated = new Date().toISOString();
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/stations.json', JSON.stringify({ v: 1, generated, stations: stations.map(encode) }));
const meta = {
  generated,
  stations: stations.length,
  countries: new Set(stations.map((s) => s.cc)).size,
  languages: new Set(stations.flatMap((s) => s.langs)).size,
  approx: stations.filter((s) => s.approx).length,
  httpInOutput: stations.filter((s) => !s.url.startsWith('https://')).length,
  unknownLanguages: [...unknown].sort((a, b) => b[1] - a[1]).slice(0, 30),
};
writeFileSync('public/data/meta.json', JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 2));
