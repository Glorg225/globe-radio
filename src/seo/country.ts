// Country pages of the static SEO site (/radio/<country>/). The app links to them and
// scripts/build-seo-pages.ts generates them: both take names and addresses from here.
import { countryName } from '../data/place-name';
import type { Place } from '../data/places';
import { slugify } from './slug';

// A country or city gets its own page only with at least this many stations.
export const MIN_STATIONS = 3;

export function seoCountryName(cc: string, fallback = ''): string {
  const name = countryName(cc, 'en');
  return name !== cc ? name : fallback || cc;
}

export interface CountryLink { cc: string; name: string; path: string; count: number }

// The biggest countries by number of stations, each with its page path (relative to the site base).
export function topCountries(places: Place[], n = 8): CountryLink[] {
  const counts = new Map<string, number>();
  const snapshotNames = new Map<string, string>();
  for (const p of places) {
    counts.set(p.cc, (counts.get(p.cc) ?? 0) + p.count);
    if (p.kind === 'country') snapshotNames.set(p.cc, p.name);
  }
  return [...counts]
    .filter(([, count]) => count >= MIN_STATIONS)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([cc, count]) => {
      const name = seoCountryName(cc, snapshotNames.get(cc));
      return { cc, name, path: `radio/${slugify(name) || slugify(cc)}/`, count };
    });
}
