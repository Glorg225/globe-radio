import type { Place } from './places';

const cache = new Map<string, Intl.DisplayNames>();
function regions(locale: string): Intl.DisplayNames {
  let d = cache.get(locale);
  if (!d) { d = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }); cache.set(locale, d); }
  return d;
}

export function countryName(cc: string, locale: string): string {
  try { return regions(locale).of(cc) ?? cc; } catch { return cc; }
}

export function placeTitle(p: Place, locale: string): string {
  if (p.kind === 'country') return countryName(p.cc, locale);
  return (locale === 'ru' && p.nameRu) || p.name;
}
