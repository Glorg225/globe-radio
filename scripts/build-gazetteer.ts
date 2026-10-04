import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { encodeGazetteer, normalizeName, type GzAdmin1, type GzCity } from '../src/data/gazetteer';

const ALIAS_MIN_POP = 100_000;
const SKIP_LANGS = new Set(['link', 'post', 'iata', 'icao', 'faac', 'wkdt', 'unlc', 'tcid', 'fr_1793', 'phon', 'piny']);
const preferredRu = new Set<number>();

function addAlias(list: string[], raw: string) {
  const n = normalizeName(raw);
  if (n && !list.includes(n)) list.push(n);
}

export function parseCities(text: string): GzCity[] {
  const out: GzCity[] = [];
  for (const line of text.split('\n')) {
    const f = line.split('\t');
    if (f.length < 15) continue;
    const pop = Number(f[14]) || 0;
    const city: GzCity = {
      id: Number(f[0]), nameRu: '', name: f[1], lat: Number(f[4]), lon: Number(f[5]),
      cc: f[8], admin1: f[10], pop, aliases: [], tz: f[17] ?? '', wikiRu: '', wikiEn: '',
    };
    addAlias(city.aliases, f[1]);
    addAlias(city.aliases, f[2]);
    if (pop >= ALIAS_MIN_POP) for (const a of f[3].split(',')) addAlias(city.aliases, a);
    out.push(city);
  }
  return out;
}

// Returned objects carry their GeoNames id so alternate names can be attached (see main).
export function parseAdmin1(text: string): (GzAdmin1 & { geonameId: number })[] {
  const out: (GzAdmin1 & { geonameId: number })[] = [];
  for (const line of text.split('\n')) {
    const f = line.split('\t');
    if (f.length < 4) continue;
    const [cc, code] = f[0].split('.');
    const a = { cc, code, nameRu: '', name: f[1], aliases: [] as string[], wikiRu: '', wikiEn: '', geonameId: Number(f[3]) };
    addAlias(a.aliases, f[1]);
    addAlias(a.aliases, f[2]);
    out.push(a);
  }
  return out;
}

const WIKI = /^https?:\/\/(en|ru)\.wikipedia\.org\/wiki\/(.+)$/;

// Row of alternateNamesV2.txt: id, geonameid, isolanguage, name, isPreferred, isShort, isColloquial, isHistoric, ...
export function applyAltName(row: string[], cities: Map<number, GzCity>, admins: Map<number, GzAdmin1>): void {
  const id = Number(row[1]);
  const lang = row[2];
  const name = row[3];
  const preferred = row[4] === '1';
  const target = cities.get(id) ?? admins.get(id);
  // 'link' rows carry Wikipedia URLs: keep the first en/ru article title.
  if (target && lang === 'link') {
    const m = WIKI.exec(name ?? '');
    if (m) {
      let title = m[2];
      try { title = decodeURIComponent(title); } catch { /* keep raw */ }
      title = title.replace(/_/g, ' ');
      if (m[1] === 'ru' && !target.wikiRu) target.wikiRu = title;
      if (m[1] === 'en' && !target.wikiEn) target.wikiEn = title;
    }
    return;
  }
  if (!target || !name || SKIP_LANGS.has(lang)) return;
  if (lang === 'ru' && (!target.nameRu || (preferred && !preferredRu.has(id)))) {
    target.nameRu = name;
    if (preferred) preferredRu.add(id);
  }
  if (admins.has(id) || lang === 'ru') addAlias(target.aliases, name);
}

const BASE = 'https://download.geonames.org/export/dump/';
const CACHE = '.cache/geonames';

async function download(file: string) {
  const path = `${CACHE}/${file}`;
  if (existsSync(path)) return path;
  console.log(`downloading ${file}…`);
  const r = await fetch(BASE + file);
  if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
  return path;
}

// bsdtar extracts zip archives: Windows 10+ ships it in System32 (Git Bash's GNU tar can't), macOS has it as tar.
const TAR = process.platform === 'win32' ? `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\tar.exe` : 'tar';

function unzip(path: string) {
  execFileSync(TAR, ['-xf', path, '-C', CACHE]);
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  unzip(await download('cities15000.zip'));
  await download('admin1CodesASCII.txt');
  unzip(await download('alternateNamesV2.zip'));

  const cities = parseCities(readFileSync(`${CACHE}/cities15000.txt`, 'utf8'));
  const adminRows = parseAdmin1(readFileSync(`${CACHE}/admin1CodesASCII.txt`, 'utf8'));
  const cityMap = new Map(cities.map((c) => [c.id, c]));
  const adminMap = new Map<number, GzAdmin1>(adminRows.map(({ geonameId, ...a }) => [geonameId, a]));

  const lines = createInterface({ input: createReadStream(`${CACHE}/alternateNamesV2.txt`, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) applyAltName(line.split('\t'), cityMap, adminMap);

  const file = encodeGazetteer({ cities, admin1: [...adminMap.values()] });
  mkdirSync('data', { recursive: true });
  writeFileSync('data/gazetteer.json', JSON.stringify(file));
  console.log(`cities: ${cities.length}, admin1: ${adminMap.size}, size: ${(JSON.stringify(file).length / 1e6).toFixed(1)} MB`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
