import { APP_ID } from '../src/app/config';
import { MIRRORS as FALLBACK } from '../src/data/mirrors';

const DISCOVERY = 'https://all.api.radio-browser.info/json/servers';
const ATTEMPTS_PER_HOST = 2;
const DISCOVERY_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 90_000;
const headers = { 'User-Agent': `${APP_ID}/1.0` };

async function discovered(fetchFn: typeof fetch): Promise<string[]> {
  try {
    const r = await fetchFn(DISCOVERY, { headers, signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS) });
    const list = (await r.json()) as { name: string }[];
    return list.map((s) => s.name);
  } catch {
    return [];
  }
}

export async function fetchWithMirrors<T>(path: string, fetchFn: typeof fetch = fetch, random: () => number = Math.random,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const found = [...new Set(await discovered(fetchFn))];
  const start = found.length ? Math.floor(random() * found.length) : 0;
  const rotated = [...found.slice(start), ...found.slice(0, start)];
  const ordered = [...new Set([...rotated, ...FALLBACK])];
  const errors: string[] = [];
  for (const host of ordered) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_HOST; attempt++) {
      try {
        const r = await fetchFn(`https://${host}${path}`, { headers, signal: AbortSignal.timeout(timeoutMs) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as T;
      } catch (e) {
        errors.push(`${host}#${attempt}: ${(e as Error).message}`);
      }
    }
  }
  throw new Error(`all mirrors failed: ${errors.join('; ')}`);
}
