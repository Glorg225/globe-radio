// Country pages of the static SEO site (/radio/<country>/). The app links to them and
// scripts/build-seo-pages.ts generates them: both take names and addresses from here.
import { countryName } from '../data/place-name';
import type { Place } from '../data/places';
import { assignSlugs } from './slug';

// A country or city gets its own page only with at least this many stations.
export const MIN_STATIONS = 3;

// Intl names some countries the way a passport office would ("Hong Kong SAR China", "Congo - Kinshasa",
// "Myanmar (Burma)", "Bosnia & Herzegovina", "St. Lucia"): pages and links use the everyday name.
const NAMES: Record<string, string> = {
  CD: 'DR Congo', CG: 'Republic of the Congo', PS: 'Palestine', VC: 'Saint Vincent and the Grenadines',
};
function everydayName(name: string): string {
  return name.replace(/ SAR China$/, '').replace(/\s*\([^)]*\)/g, '').replace(/ & /g, ' and ').replace(/^St\. /, 'Saint ').trim();
}

// ZZ is CLDR's "Unknown Region": Intl names it, but it is not a country name.
export function seoCountryName(cc: string, fallback = ''): string {
  if (NAMES[cc]) return NAMES[cc];
  const name = cc === 'ZZ' ? cc : countryName(cc, 'en');
  return name !== cc ? everydayName(name) : fallback || cc;
}

// Page slugs of all countries, shared by the app links and the page generator. Biggest first keeps the plain
// slug on a collision, the next one gets its code ("atlantis-aa").
export function countrySlugs(list: { cc: string; name: string; count: number }[]): Map<string, string> {
  const ordered = [...list].sort((a, b) => b.count - a.count || a.cc.localeCompare(b.cc));
  const slugs = assignSlugs(ordered, (c) => c.name, (c) => c.cc);
  return new Map(ordered.map((c) => [c.cc, slugs.get(c)!]));
}

export interface CountryLink { cc: string; name: string; path: string; count: number }

// Countries of the snapshot that get a page (at least MIN_STATIONS stations), by the place counts.
export function eligibleCountries(places: Place[], name: (cc: string) => string): { cc: string; name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of places) counts.set(p.cc, (counts.get(p.cc) ?? 0) + p.count);
  return [...counts].filter(([, count]) => count >= MIN_STATIONS).map(([cc, count]) => ({ cc, count, name: name(cc) }));
}

// The biggest countries by number of stations, each with its page path (relative to the site base).
export function topCountries(places: Place[], n = 8): CountryLink[] {
  const snapshotNames = new Map(places.filter((p) => p.kind === 'country').map((p) => [p.cc, p.name]));
  const eligible = eligibleCountries(places, (cc) => seoCountryName(cc, snapshotNames.get(cc)));
  const slugs = countrySlugs(eligible);
  return eligible
    .sort((a, b) => b.count - a.count || a.cc.localeCompare(b.cc))
    .slice(0, n)
    .map((c) => ({ cc: c.cc, name: c.name, path: `radio/${slugs.get(c.cc)}/`, count: c.count }));
}
