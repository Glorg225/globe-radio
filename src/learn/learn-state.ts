export const LEARN_KEY = 'learnLang';

export interface LearnState {
  get(): string | null;
  set(code: string | null): void;
  subscribe(l: (code: string | null) => void): () => void;
}

export function createLearnState(storage: Storage | null, isKnown: (code: string) => boolean): LearnState {
  let current: string | null = null;
  try { current = storage?.getItem(LEARN_KEY) ?? null; } catch { current = null; }
  if (current && !isKnown(current)) {
    current = null;
    try { storage?.removeItem(LEARN_KEY); } catch { /* unavailable */ }
  }
  const listeners = new Set<(code: string | null) => void>();
  return {
    get: () => current,
    set(code) {
      if (code === current) return;
      current = code;
      try {
        if (code) storage?.setItem(LEARN_KEY, code);
        else storage?.removeItem(LEARN_KEY);
      } catch { /* unavailable */ }
      for (const l of listeners) l(code);
    },
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
