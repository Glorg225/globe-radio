export const BLACKLIST_TTL_MS = 12 * 60 * 60 * 1000;
const KEY = 'blacklist';

export interface Blacklist { add(id: string): void; has(id: string): boolean }

export function createBlacklist(storage: Storage | null, now: () => number = Date.now, ttlMs = BLACKLIST_TTL_MS): Blacklist {
  let map: Record<string, number> = {};
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? '{}');
    if (parsed && typeof parsed === 'object') map = parsed as Record<string, number>;
  } catch { map = {}; }

  const save = () => { try { storage?.setItem(KEY, JSON.stringify(map)); } catch { /* storage unavailable */ } };

  return {
    add(id) {
      map[id] = now() + ttlMs;
      save();
    },
    has(id) {
      const until = map[id];
      if (until === undefined) return false;
      if (until <= now()) { delete map[id]; save(); return false; }
      return true;
    },
  };
}
