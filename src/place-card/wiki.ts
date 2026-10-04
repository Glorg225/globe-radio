import type { PlaceInfo } from '../data/shards';
import type { WikiCache } from './wiki-cache';

export interface WikiSummary { lang: 'ru' | 'en'; title: string; text: string; image: string; url: string }
export interface WikiResult { summary: WikiSummary | null; link: string | null }
type Lang = 'ru' | 'en';

const path = (title: string) => encodeURIComponent(title.replace(/ /g, '_'));
export const articleUrl = (lang: Lang, title: string) => `https://${lang}.wikipedia.org/wiki/${path(title)}`;

export function trimSentences(text: string, max = 3, maxChars = 320): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentences = clean.split(/(?<=[.!?…])\s+/);
  let out = '';
  for (const s of sentences.slice(0, max)) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > maxChars) break;
    out = next;
  }
  if (out) return out;
  const cut = clean.slice(0, maxChars);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 1)).trimEnd()}…`;
}

class NetworkError extends Error {}

// Returns undefined when the article does not exist; throws NetworkError on connectivity problems.
async function summary(lang: Lang, title: string, fetchFn: typeof fetch, cache: WikiCache): Promise<WikiSummary | undefined> {
  const key = `${lang}:${title}`;
  const hit = cache.get<WikiSummary | null>(key);
  if (hit !== undefined) return hit ?? undefined;
  let r: Response;
  try { r = await fetchFn(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${path(title)}`); } catch { throw new NetworkError(); }
  if (r.status === 404) { cache.set(key, null); return undefined; }
  if (!r.ok) throw new NetworkError();
  const b = (await r.json()) as { type?: string; extract?: string; thumbnail?: { source?: string } };
  if (b.type === 'disambiguation' || !b.extract) { cache.set(key, null); return undefined; }
  const img = b.thumbnail?.source ?? '';
  const s: WikiSummary = { lang, title, text: trimSentences(b.extract), image: img.startsWith('https://upload.wikimedia.org/') ? img : '', url: articleUrl(lang, title) };
  cache.set(key, s);
  return s;
}

async function ruTitleFor(enTitle: string, fetchFn: typeof fetch, cache: WikiCache): Promise<string | null> {
  const key = `ll:${enTitle}`;
  const hit = cache.get<string | null>(key);
  if (hit !== undefined) return hit;
  let r: Response;
  try {
    r = await fetchFn(`https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=ru&redirects=1&format=json&formatversion=2&origin=*&titles=${encodeURIComponent(enTitle)}`);
  } catch { throw new NetworkError(); }
  if (!r.ok) throw new NetworkError();
  const b = (await r.json()) as { query?: { pages?: { langlinks?: { title?: string }[] }[] } };
  const ru = b.query?.pages?.[0]?.langlinks?.[0]?.title ?? null;
  cache.set(key, ru);
  return ru;
}

export async function findArticle(info: Pick<PlaceInfo, 'wikiRu' | 'wikiEn'>, fetchFn: typeof fetch, cache: WikiCache): Promise<WikiResult> {
  let fallback: string | null = info.wikiRu ? articleUrl('ru', info.wikiRu) : info.wikiEn ? articleUrl('en', info.wikiEn) : null;
  const tried = new Set<string>();
  const tryRu = async (title: string) => {
    if (tried.has(title)) return undefined;
    tried.add(title);
    fallback = articleUrl('ru', title);
    return summary('ru', title, fetchFn, cache);
  };
  try {
    if (info.wikiRu) {
      const s = await tryRu(info.wikiRu);
      if (s) return { summary: s, link: s.url };
    }
    // The given Russian title may not exist (e.g. a country name spelled with "e" instead of "yo"):
    // ask the English article for its Russian counterpart before falling back to English.
    if (info.wikiEn) {
      const ruTitle = await ruTitleFor(info.wikiEn, fetchFn, cache);
      if (ruTitle) {
        const s = await tryRu(ruTitle);
        if (s) return { summary: s, link: s.url };
      }
      const s = await summary('en', info.wikiEn, fetchFn, cache);
      if (s) return { summary: s, link: s.url };
    }
    return { summary: null, link: null };
  } catch {
    return { summary: null, link: fallback };
  }
}
