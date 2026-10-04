import { expect, test, vi } from 'vitest';
import { fetchWithMirrors } from '../scripts/radio-browser';

test('tries next mirror when one fails', async () => {
  const calls: string[] = [];
  const fake = vi.fn(async (url: string) => {
    calls.push(url);
    if (url.endsWith('/json/servers')) return new Response(JSON.stringify([{ name: 'a.example' }, { name: 'b.example' }]));
    if (url.includes('a.example')) throw new Error('down');
    return new Response(JSON.stringify({ ok: true }));
  }) as unknown as typeof fetch;
  const res = await fetchWithMirrors<{ ok: boolean }>('/json/stats', fake, () => 0);
  expect(res).toEqual({ ok: true });
  expect(calls.some((u) => u.includes('b.example/json/stats'))).toBe(true);
});

test('also tries known fallback mirrors when discovery lists only failing hosts', async () => {
  const fake = (async (url: string) => {
    if (url.endsWith('/json/servers')) return new Response(JSON.stringify([{ name: 'de1.api.radio-browser.info' }]));
    if (url.includes('de2.api.radio-browser.info')) return new Response(JSON.stringify({ ok: true }));
    return new Response('bad gateway', { status: 502 });
  }) as unknown as typeof fetch;
  await expect(fetchWithMirrors('/json/stats', fake, () => 0)).resolves.toEqual({ ok: true });
});

test('retries a flaky mirror once before moving on', async () => {
  let n = 0;
  const fake = (async (url: string) => {
    if (url.endsWith('/json/servers')) return new Response(JSON.stringify([{ name: 'only.example' }]));
    if (url.includes('only.example') && n++ === 0) return new Response('', { status: 502 });
    if (url.includes('only.example')) return new Response(JSON.stringify({ ok: true }));
    return new Response('', { status: 502 });
  }) as unknown as typeof fetch;
  await expect(fetchWithMirrors('/json/stats', fake, () => 0)).resolves.toEqual({ ok: true });
});

test('throws after all mirrors fail', async () => {
  const fake = (async (url: string) => {
    if (url.endsWith('/json/servers')) return new Response(JSON.stringify([{ name: 'a.example' }]));
    return new Response('err', { status: 503 });
  }) as unknown as typeof fetch;
  await expect(fetchWithMirrors('/json/stats', fake, () => 0)).rejects.toThrow(/all mirrors failed/);
});
