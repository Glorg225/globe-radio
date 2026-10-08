import type { Place } from './places';

const cache = new Map<string, Intl.DisplayNames>();
function regions(locale: string): Intl.DisplayNames {
  let d = cache.get(locale);
  if (!d) { d = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }); cache.set(locale, d); }
  return d;
}

// Intl's name as is ("Hong Kong SAR China"); kept for redirects from addresses built on it.
export function officialCountryName(cc: string, locale = 'en'): string {
  try { return regions(locale).of(cc) ?? cc; } catch { return cc; }
}

// Intl names some countries the way a passport office would ("Hong Kong SAR China", "Congo - Kinshasa",
// "Myanmar (Burma)", "Bosnia & Herzegovina", "St. Lucia"): in English the app and the pages use the everyday name.
const EVERYDAY_EN: Record<string, string> = {
  CD: 'DR Congo', CG: 'Republic of the Congo', PS: 'Palestine', VC: 'Saint Vincent and the Grenadines',
};
function everydayEn(name: string): string {
  return name.replace(/ SAR China$/, '').replace(/\s*\([^)]*\)/g, '').replace(/ & /g, ' and ').replace(/^St\. /, 'Saint ').trim();
}

export function countryName(cc: string, locale: string): string {
  const name = officialCountryName(cc, locale);
  if (!locale.startsWith('en') || name === cc) return name;
  return EVERYDAY_EN[cc] ?? everydayEn(name);
}

export function placeTitle(p: Place, locale: string): string {
  if (p.kind === 'country') return countryName(p.cc, locale);
  return (locale === 'ru' && p.nameRu) || p.name;
}
