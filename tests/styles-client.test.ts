import { expect, test } from 'vitest';
import { loadStyles } from '../src/data/styles';

const ok = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

test('loadStyles: style -> place -> number of stations', async () => {
  const idx = await loadStyles('/r/', ok({ v: 1, styles: { jazz: [['c:1', 2], ['k:FR', 1]] } }));
  expect(idx.get('jazz')).toEqual(new Map([['c:1', 2], ['k:FR', 1]]));
  expect(idx.get('news')).toBeUndefined();
});

test('loadStyles fails on HTTP errors and unknown formats', async () => {
  await expect(loadStyles('/r/', (async () => new Response('', { status: 404 })) as unknown as typeof fetch)).rejects.toThrow(/404/);
  await expect(loadStyles('/r/', ok({ v: 9 }))).rejects.toThrow(/format/);
});
