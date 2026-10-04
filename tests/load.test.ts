import { expect, test } from 'vitest';
import { loadStations } from '../src/data/load';

const row = ['u1', 'A', 'https://x', 1, 2, 0, 'PT', '', 'pt', 'pop', 3, 4, '', 0];

test('loads and decodes', async () => {
  const f = (async (url: string) => {
    expect(url).toBe('/base/data/stations.json');
    return new Response(JSON.stringify({ v: 1, generated: 'x', stations: [row] }));
  }) as unknown as typeof fetch;
  const list = await loadStations('/base/', f);
  expect(list[0]).toMatchObject({ id: 'u1', cc: 'PT', langs: ['pt'] });
});

test('rejects unknown format version', async () => {
  const f = (async () => new Response(JSON.stringify({ v: 2, stations: [] }))) as unknown as typeof fetch;
  await expect(loadStations('/', f)).rejects.toThrow(/format/);
});

test('rejects HTTP error', async () => {
  const f = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
  await expect(loadStations('/', f)).rejects.toThrow(/404/);
});
