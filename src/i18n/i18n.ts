export type Messages = Record<string, string | Partial<Record<Intl.LDMLPluralRule, string>>>;

export interface I18n {
  locale: string;
  t(key: string, params?: Record<string, string | number>): string;
  formatNumber(n: number): string;
}

export const LOCALE_STORAGE_KEY = 'locale';
const RTL = new Set(['ar', 'he', 'fa', 'ur']);

export function createI18n(locale: string, messages: Messages): I18n {
  const plural = new Intl.PluralRules(locale);
  const num = new Intl.NumberFormat(locale);
  const formatNumber = (n: number) => num.format(n);

  function t(key: string, params: Record<string, string | number> = {}): string {
    const entry = messages[key];
    if (entry === undefined) return key;
    let template: string | undefined;
    if (typeof entry === 'string') {
      template = entry;
    } else {
      const count = Number(params.count ?? 0);
      template = entry[plural.select(count)] ?? entry.other;
    }
    if (template === undefined) return key;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => {
      const v = params[name];
      if (v === undefined) return `{${name}}`;
      return typeof v === 'number' ? formatNumber(v) : v;
    });
  }

  return { locale, t, formatNumber };
}

export function resolveLocale(
  search: string,
  storage: Storage | null,
  navLangs: readonly string[],
  supported: readonly string[],
  fallback: string,
): string {
  const pick = (tag: string | null | undefined) => {
    if (!tag) return undefined;
    const base = tag.toLowerCase().split('-')[0];
    return supported.includes(base) ? base : undefined;
  };
  const fromQuery = pick(new URLSearchParams(search).get('lang'));
  if (fromQuery) return fromQuery;
  let stored: string | null = null;
  try { stored = storage?.getItem(LOCALE_STORAGE_KEY) ?? null; } catch { stored = null; }
  const fromStore = pick(stored);
  if (fromStore) return fromStore;
  for (const l of navLangs) {
    const p = pick(l);
    if (p) return p;
  }
  return fallback;
}

export function applyDirection(doc: Document, locale: string): void {
  doc.documentElement.lang = locale;
  doc.documentElement.dir = RTL.has(locale.split('-')[0]) ? 'rtl' : 'ltr';
}
