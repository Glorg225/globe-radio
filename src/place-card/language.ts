import { lowerFirst } from '../learn/language-index';

const cache = new Map<string, Intl.DisplayNames>();

export function languageNames(codes: string[], locale: string): string {
  let d = cache.get(locale);
  if (!d) { d = new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' }); cache.set(locale, d); }
  const names = codes.map((c) => { try { return d!.of(c); } catch { return undefined; } }).filter((n): n is string => !!n);
  return names.map((n) => lowerFirst(n, locale)).join(', ');
}
