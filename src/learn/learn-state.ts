export const LEARN_KEY = 'learnLang';
// The style mode (#40) keeps its choice the same way under its own key.
export const STYLE_KEY = 'styleId';

// A remembered choice (a language to learn, a style): kept in storage, dropped when no longer known.
export interface ChoiceState {
  get(): string | null;
  set(code: string | null): void;
  subscribe(l: (code: string | null) => void): () => void;
}

export type LearnState = ChoiceState;

export function createChoiceState(storage: Storage | null, isKnown: (code: string) => boolean, key: string): ChoiceState {
  let current: string | null = null;
  try { current = storage?.getItem(key) ?? null; } catch { current = null; }
  if (current && !isKnown(current)) {
    current = null;
    try { storage?.removeItem(key); } catch { /* unavailable */ }
  }
  const listeners = new Set<(code: string | null) => void>();
  return {
    get: () => current,
    set(code) {
      if (code === current) return;
      current = code;
      try {
        if (code) storage?.setItem(key, code);
        else storage?.removeItem(key);
      } catch { /* unavailable */ }
      for (const l of listeners) l(code);
    },
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

export const createLearnState = (storage: Storage | null, isKnown: (code: string) => boolean): LearnState =>
  createChoiceState(storage, isKnown, LEARN_KEY);

