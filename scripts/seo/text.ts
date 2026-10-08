// Text helpers for the static SEO pages (English only, like the production site).
import type { StationLite } from '../../src/data/shards';

const LANGUAGES = new Intl.DisplayNames('en', { type: 'language' });

export function languageName(code: string): string {
  try {
    return LANGUAGES.of(code) ?? code;
  } catch {
    return code;
  }
}

function top(counts: Map<string, number>, n: number, min = 1): string[] {
  return [...counts]
    .filter(([, count]) => count >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([key]) => key);
}

export function topLanguages(stations: StationLite[], n = 3): string[] {
  const counts = new Map<string, number>();
  for (const s of stations) for (const l of s.langs) counts.set(l, (counts.get(l) ?? 0) + 1);
  return top(counts, n).map(languageName);
}

// Station tags that describe the programme; skips bitrates ("64kbps"), place names and one-off tags.
export function genreTags(tags: string[], exclude: string[] = []): string[] {
  const skip = new Set(exclude.map((e) => e.toLowerCase()));
  return tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2 && t.length <= 24 && !/\d/.test(t) && !skip.has(t));
}

export function listPhrase(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

// Meta description: "<lead>: <up to 3 names>. <tail>", as many names as fit into max characters.
export function fitDescription(lead: string, names: string[], tail: string, max = 160): string {
  for (let k = Math.min(3, names.length); k >= 1; k--) {
    const text = `${lead}: ${names.slice(0, k).join(', ')}. ${tail}`;
    if (text.length <= max) return text;
  }
  const text = `${lead}. ${tail}`;
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
