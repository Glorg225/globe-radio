import { MIRRORS } from '../data/mirrors';
import type { StationLite } from '../data/shards';

// The click endpoint returns the current stream URL and counts the play (Radio Browser API rule).
export async function resolveStreamUrl(
  s: Pick<StationLite, 'id' | 'url'>,
  fetchFn: typeof fetch = fetch,
  mirrors: readonly string[] = MIRRORS,
  timeoutMs = 5000,
): Promise<string> {
  for (const host of mirrors) {
    try {
      const r = await fetchFn(`https://${host}/json/url/${encodeURIComponent(s.id)}`, { signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) continue;
      const body = (await r.json()) as { url?: unknown };
      if (typeof body.url === 'string' && body.url.startsWith('https://')) return body.url;
      break;
    } catch { /* next mirror */ }
  }
  if (s.url.startsWith('https://')) return s.url;
  throw new Error('no https stream url');
}
