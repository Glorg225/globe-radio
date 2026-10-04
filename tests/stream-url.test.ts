import { expect, test, vi } from 'vitest';
import { resolveStreamUrl } from '../src/player/stream-url';

const json = (b: unknown) => new Response(JSON.stringify(b));
const station = { id: 'a b', url: 'https://snapshot/stream' };

test('uses the fresh https url from the click endpoint', async () => {
  const f = vi.fn(async () => json({ ok: true, url: 'https://fresh/stream' }));
  await expect(resolveStreamUrl(station, f as unknown as typeof fetch, ['m1'])).resolves.toBe('https://fresh/stream');
  expect((f.mock.calls[0] as unknown[])[0]).toBe('https://m1/json/url/a%20b');
});

test('tries the next mirror when one fails', async () => {
  const f = (async (u: string) => (u.includes('m1') ? new Response('', { status: 502 }) : json({ ok: true, url: 'https://fresh' }))) as unknown as typeof fetch;
  await expect(resolveStreamUrl(station, f, ['m1', 'm2'])).resolves.toBe('https://fresh');
});

test('non-https fresh url or API outage falls back to the snapshot url (review focus 3)', async () => {
  const http = (async () => json({ ok: true, url: 'http://insecure' })) as unknown as typeof fetch;
  await expect(resolveStreamUrl(station, http, ['m1'])).resolves.toBe('https://snapshot/stream');
  const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  await expect(resolveStreamUrl(station, down, ['m1', 'm2'])).resolves.toBe('https://snapshot/stream');
});

test('no https url at all → rejects', async () => {
  const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  await expect(resolveStreamUrl({ id: 'x', url: 'http://old' }, down, ['m1'])).rejects.toThrow(/https/);
});
