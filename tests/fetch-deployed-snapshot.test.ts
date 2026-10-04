import { expect, test } from 'vitest';
import { fetchDeployedSnapshot } from '../scripts/fetch-deployed-snapshot';

test('downloads places, meta and one stations file per country', async () => {
  const served: Record<string, string> = {
    'https://x.io/r/data/places.json': JSON.stringify({ v: 2, generated: 'g', places: [['c:1', 0, 0, 0, 'DE', '', 'A', 1, 1], ['c:2', 0, 0, 0, 'DE', '', 'B', 1, 1], ['k:FR', 0, 0, 2, 'FR', '', 'F', 1, 1]] }),
    'https://x.io/r/data/meta.json': '{}',
    'https://x.io/r/data/stations/DE.json': 'de',
    'https://x.io/r/data/stations/FR.json': 'fr',
  };
  const f = (async (u: string) => (u in served ? new Response(served[u]) : new Response('', { status: 404 }))) as unknown as typeof fetch;
  const files = await fetchDeployedSnapshot('https://x.io/r', f);
  expect([...files.keys()].sort()).toEqual(['meta.json', 'places.json', 'stations/DE.json', 'stations/FR.json']);
  expect(files.get('stations/FR.json')).toBe('fr');
});

test('fails loudly when the deployed snapshot is missing', async () => {
  const f = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
  await expect(fetchDeployedSnapshot('https://x.io/r', f)).rejects.toThrow(/404/);
});
