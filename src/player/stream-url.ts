import { MIRRORS } from '../data/mirrors';
import type { StationLite } from '../data/shards';

// The click endpoint returns the current stream URL and counts the play (Radio Browser API rule).
// Mirrors are asked in parallel within one short budget; a slow or unavailable API must not eat
// into the time the stream itself has to start, so the snapshot URL is used instead.
export async function resolveStreamUrl(
  s: Pick<StationLite, 'id' | 'url'>,
  fetchFn: typeof fetch = fetch,
  mirrors: readonly string[] = MIRRORS,
  budgetMs = 3000,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), budgetMs);
  const ask = async (host: string) => {
    const r = await fetchFn(`https://${host}/json/url/${encodeURIComponent(s.id)}`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = (await r.json()) as { url?: unknown };
    if (typeof body.url !== 'string') throw new Error('no url in response');
    return body.url;
  };
  try {
    const url = await Promise.any(mirrors.map(ask));
    if (url.startsWith('https://')) return url;
  } catch {
    /* every mirror failed or the budget ran out */
  } finally {
    clearTimeout(timer);
    ctrl.abort();
  }
  if (s.url.startsWith('https://')) return s.url;
  throw new Error('no https stream url');
}
