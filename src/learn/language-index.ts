import type { Place } from '../data/places';

export interface LanguageEntry { code: string; name: string; stations: number; countries: number }

const names = new Map<string, Intl.DisplayNames>();
function languageName(code: string, locale: string): string | undefined {
  let d = names.get(locale);
  if (!d) { d = new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' }); names.set(locale, d); }
  try { return d.of(code); } catch { return undefined; }
}

export const upperFirst = (s: string, locale: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
// Language names are common nouns (lower case) in Russian and many other languages, but capitalised in English and German.
const CAPITALISED_LANGUAGE_NAMES = new Set(['en', 'de']);
export const lowerFirst = (s: string, locale: string) =>
  CAPITALISED_LANGUAGE_NAMES.has(locale.slice(0, 2)) ? s : s.charAt(0).toLocaleLowerCase(locale) + s.slice(1);

export function buildLanguageIndex(places: Place[], locale: string): LanguageEntry[] {
  const stations = new Map<string, number>();
  const countries = new Map<string, Set<string>>();
  for (const p of places) {
    for (const [code, n] of Object.entries(p.langs ?? {})) {
      stations.set(code, (stations.get(code) ?? 0) + n);
      (countries.get(code) ?? countries.set(code, new Set()).get(code)!).add(p.cc);
    }
  }
  const out: LanguageEntry[] = [];
  for (const [code, n] of stations) {
    const name = languageName(code, locale);
    if (name) out.push({ code, name: upperFirst(name, locale), stations: n, countries: countries.get(code)!.size });
  }
  return out.sort((a, b) => b.stations - a.stations || a.name.localeCompare(b.name, locale));
}

export function searchLanguages(list: LanguageEntry[], query: string): LanguageEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((e) => e.code === q || e.name.toLowerCase().includes(q));
}
