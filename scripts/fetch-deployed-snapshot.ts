import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PlacesFile } from '../src/data/places';

export async function fetchDeployedSnapshot(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<Map<string, string>> {
  const root = baseUrl.replace(/\/$/, '');
  const get = async (path: string) => {
    const r = await fetchFn(`${root}/data/${path}`);
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.text();
  };
  const files = new Map<string, string>();
  const places = await get('places.json');
  files.set('places.json', places);
  files.set('meta.json', await get('meta.json'));
  const countries = new Set((JSON.parse(places) as PlacesFile).places.map((p) => p[4]));
  for (const cc of countries) files.set(`stations/${cc}.json`, await get(`stations/${cc}.json`));
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await fetchDeployedSnapshot(process.argv[2]);
  for (const [path, body] of files) {
    mkdirSync(dirname(`public/data/${path}`), { recursive: true });
    writeFileSync(`public/data/${path}`, body);
  }
  console.log(`restored ${files.size} files from the deployed site`);
}
