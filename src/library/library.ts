import type { StationLite } from '../data/shards';

export interface SavedStation { id: string; name: string; placeId: string; cc: string; favicon: string }
export interface Library {
  favorites(): SavedStation[];
  history(): SavedStation[];
  isFavorite(id: string): boolean;
  toggleFavorite(s: SavedStation): boolean;
  remember(s: SavedStation): void;
  subscribe(l: () => void): () => void;
}

export const FAVORITES_KEY = 'favorites';
export const HISTORY_KEY = 'history';
export const HISTORY_LIMIT = 20;

export const toSaved = (s: StationLite): SavedStation => ({ id: s.id, name: s.name, placeId: s.placeId, cc: s.cc, favicon: s.favicon });

const isSaved = (x: unknown): x is SavedStation => {
  const o = x as Record<string, unknown> | null;
  return !!o && ['id', 'name', 'placeId', 'cc', 'favicon'].every((k) => typeof o[k] === 'string');
};

export function createLibrary(storage: Storage | null): Library {
  const read = (key: string): SavedStation[] => {
    try {
      const v: unknown = JSON.parse(storage?.getItem(key) ?? '[]');
      return Array.isArray(v) ? v.filter(isSaved) : [];
    } catch { return []; }
  };
  const write = (key: string, list: SavedStation[]) => { try { storage?.setItem(key, JSON.stringify(list)); } catch { /* unavailable */ } };
  let favs = read(FAVORITES_KEY);
  let hist = read(HISTORY_KEY);
  const listeners = new Set<() => void>();
  const notify = () => { for (const l of listeners) l(); };

  return {
    favorites: () => favs,
    history: () => hist,
    isFavorite: (id) => favs.some((x) => x.id === id),
    toggleFavorite(s) {
      const on = !favs.some((x) => x.id === s.id);
      favs = on ? [s, ...favs] : favs.filter((x) => x.id !== s.id);
      write(FAVORITES_KEY, favs);
      notify();
      return on;
    },
    remember(s) {
      hist = [s, ...hist.filter((x) => x.id !== s.id)].slice(0, HISTORY_LIMIT);
      write(HISTORY_KEY, hist);
      notify();
    },
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
