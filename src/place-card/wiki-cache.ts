export const WIKI_TTL_MS = 30 * 24 * 3600 * 1000;
const INDEX = 'wiki:index';

export interface WikiCache { get<T>(key: string): T | undefined; set(key: string, value: unknown): void }

export function createWikiCache(storage: Storage | null, now: () => number = Date.now, ttlMs = WIKI_TTL_MS, limit = 200): WikiCache {
  const read = (k: string): unknown => { try { const s = storage?.getItem(k); return s ? JSON.parse(s) : undefined; } catch { return undefined; } };
  const write = (k: string, v: unknown) => { try { storage?.setItem(k, JSON.stringify(v)); } catch { /* full or unavailable */ } };
  const remove = (k: string) => { try { storage?.removeItem(k); } catch { /* unavailable */ } };

  return {
    get<T>(key: string): T | undefined {
      const e = read(`wiki:${key}`) as { at: number; v: T } | undefined;
      if (!e || typeof e.at !== 'number') return undefined;
      if (now() - e.at > ttlMs) { remove(`wiki:${key}`); return undefined; }
      return e.v;
    },
    set(key, value) {
      const index = ((read(INDEX) as string[] | undefined) ?? []).filter((k) => k !== key);
      index.push(key);
      while (index.length > limit) remove(`wiki:${index.shift()!}`);
      write(`wiki:${key}`, { at: now(), v: value });
      write(INDEX, index);
    },
  };
}
