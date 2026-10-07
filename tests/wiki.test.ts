import { expect, test, vi } from 'vitest';
import { createWikiCache, WIKI_TTL_MS } from '../src/place-card/wiki-cache';
import { articleUrl, findArticle, trimSentences } from '../src/place-card/wiki';

class Mem {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const summary = (title: string, extract: string, img = 'https://upload.wikimedia.org/x.jpg') =>
  ({ type: 'standard', title, extract, thumbnail: { source: img } });

function wikiFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (u: string) => {
    for (const [k, r] of Object.entries(routes)) if (u.includes(k)) return r();
    return json({}, 404);
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

test('Russian article first, url built from the title', async () => {
  const f = wikiFetch({ 'ru.wikipedia.org/api/rest_v1/page/summary/%D0%9B%D0%B8%D1%81%D1%81%D0%B0%D0%B1%D0%BE%D0%BD': () => json(summary('Лиссабон', 'Лиссабон — столица Португалии. Город на реке Тежу.')) });
  const r = await findArticle({ wikiRu: 'Лиссабон', wikiEn: 'Lisbon' }, f, createWikiCache(null));
  expect(r.summary).toMatchObject({ lang: 'ru', title: 'Лиссабон', text: 'Лиссабон — столица Португалии. Город на реке Тежу.', image: 'https://upload.wikimedia.org/x.jpg' });
  expect(r.link).toBe(articleUrl('ru', 'Лиссабон'));
  expect(r.link).toBe('https://ru.wikipedia.org/wiki/%D0%9B%D0%B8%D1%81%D1%81%D0%B0%D0%B1%D0%BE%D0%BD');
});

test('no Russian title → Russian article via langlinks of the English one', async () => {
  const f = wikiFetch({
    'en.wikipedia.org/w/api.php': () => json({ query: { pages: [{ title: 'Lisbon', langlinks: [{ lang: 'ru', title: 'Лиссабон' }] }] } }),
    'ru.wikipedia.org/api/rest_v1/page/summary/': () => json(summary('Лиссабон', 'Текст.')),
  });
  const r = await findArticle({ wikiRu: '', wikiEn: 'Lisbon' }, f, createWikiCache(null));
  expect(r.summary).toMatchObject({ lang: 'ru', title: 'Лиссабон' });
});

test('no Russian article at all → English with lang en', async () => {
  const f = wikiFetch({
    'en.wikipedia.org/w/api.php': () => json({ query: { pages: [{ title: 'Smallville' }] } }),
    'en.wikipedia.org/api/rest_v1/page/summary/Smallville': () => json(summary('Smallville', 'A town.')),
  });
  const r = await findArticle({ wikiRu: '', wikiEn: 'Smallville' }, f, createWikiCache(null));
  expect(r.summary).toMatchObject({ lang: 'en', text: 'A town.' });
  expect(r.link).toBe('https://en.wikipedia.org/wiki/Smallville');
});

test('network error → link only; nothing known → nothing', async () => {
  const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  expect(await findArticle({ wikiRu: 'Лиссабон', wikiEn: '' }, down, createWikiCache(null))).toEqual({ summary: null, link: articleUrl('ru', 'Лиссабон') });
  expect(await findArticle({ wikiRu: '', wikiEn: '' }, down, createWikiCache(null))).toEqual({ summary: null, link: null });
});

test('disambiguation pages and non-Wikimedia images are not shown', async () => {
  const f = wikiFetch({
    'summary/A': () => json({ type: 'disambiguation', title: 'A', extract: 'A may refer to:' }),
    'summary/B': () => json(summary('B', 'Bee.', 'https://evil.example/x.jpg')),
  });
  expect((await findArticle({ wikiRu: 'A', wikiEn: '' }, f, createWikiCache(null))).summary).toBeNull();
  expect((await findArticle({ wikiRu: 'B', wikiEn: '' }, f, createWikiCache(null))).summary!.image).toBe('');
});

test('long text is trimmed to 3 sentences / ~320 chars (review focus 2)', () => {
  expect(trimSentences('Один. Два! Три? Четыре.')).toBe('Один. Два! Три?');
  const long = `${'слово '.repeat(100)}конец.`;
  const t = trimSentences(long);
  expect(t.length).toBeLessThanOrEqual(321);
  expect(t.endsWith('…')).toBe(true);
  expect(trimSentences('')).toBe('');
});

test('successful answers are cached, errors are not', async () => {
  const cache = createWikiCache(new Mem() as unknown as Storage);
  const f = wikiFetch({ 'summary/X': () => json(summary('X', 'Икс.')) });
  await findArticle({ wikiRu: 'X', wikiEn: '' }, f, cache);
  await findArticle({ wikiRu: 'X', wikiEn: '' }, f, cache);
  expect(f).toHaveBeenCalledTimes(1);
  let n = 0;
  const flaky = (async () => { n++; throw new Error('net'); }) as unknown as typeof fetch;
  await findArticle({ wikiRu: 'Y', wikiEn: '' }, flaky, cache);
  await findArticle({ wikiRu: 'Y', wikiEn: '' }, flaky, cache);
  expect(n).toBe(2);
});

test('cache expires after 30 days and keeps at most the limit', () => {
  let t = 0;
  const s = new Mem() as unknown as Storage;
  const c = createWikiCache(s, () => t, WIKI_TTL_MS, 2);
  c.set('a', 1);
  c.set('b', 2);
  c.set('c', 3);
  expect(c.get('a')).toBeUndefined();
  expect(c.get('c')).toBe(3);
  t += WIKI_TTL_MS + 1;
  expect(c.get('c')).toBeUndefined();
});

test('storage that throws on write (quota) does not break anything (review focus 4)', () => {
  const quota = { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); }, removeItem: () => {} } as unknown as Storage;
  const c = createWikiCache(quota);
  expect(() => c.set('a', 1)).not.toThrow();
  expect(c.get('a')).toBeUndefined();
});

test('a Russian title that does not exist (e.g. country name spelled differently) falls back to langlinks, then English', async () => {
  const f = wikiFetch({
    'ru.wikipedia.org/api/rest_v1/page/summary/%D0%A1%D0%BE%D0%B5%D0%B4%D0%B8%D0%BD%D0%B5%D0%BD%D0%BD%D1%8B%D0%B5_%D0%A8%D1%82%D0%B0%D1%82%D1%8B': () => json({}, 404),
    'en.wikipedia.org/w/api.php': () => json({ query: { pages: [{ title: 'United States', langlinks: [{ lang: 'ru', title: 'Соединённые Штаты Америки' }] }] } }),
    'ru.wikipedia.org/api/rest_v1/page/summary/%D0%A1%D0%BE%D0%B5%D0%B4%D0%B8%D0%BD%D1%91%D0%BD%D0%BD%D1%8B%D0%B5': () => json(summary('Соединённые Штаты Америки', 'Государство.')),
  });
  const r = await findArticle({ wikiRu: 'Соединенные Штаты', wikiEn: 'United States' }, f, createWikiCache(null));
  expect(r.summary).toMatchObject({ lang: 'ru', title: 'Соединённые Штаты Америки' });
});

test('Wikimedia thumbnails from any wikimedia.org host are accepted (thumb.wikimedia.org)', async () => {
  const f = wikiFetch({ 'summary/T': () => json(summary('T', 'Текст.', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/b.jpg/330px-b.jpg')) });
  expect((await findArticle({ wikiRu: 'T', wikiEn: '' }, f, createWikiCache(null))).summary!.image).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/a/b.jpg/330px-b.jpg');
  const g = wikiFetch({ 'summary/U': () => json(summary('U', 'Текст.', 'https://wikimedia.org.evil.example/x.jpg')) });
  expect((await findArticle({ wikiRu: 'U', wikiEn: '' }, g, createWikiCache(null))).summary!.image).toBe('');
});

test('Russian stress marks are removed from the text', () => {
  expect(trimSentences('Лиссабо́н — столица. Герма́ния рядом.')).toBe('Лиссабон — столица. Германия рядом.');
});

test('English interface: the English article first, no Russian lookup', async () => {
  const f = wikiFetch({ 'en.wikipedia.org/api/rest_v1/page/summary/Lisbon': () => json(summary('Lisbon', 'Lisbon is the capital of Portugal.')) });
  const r = await findArticle({ wikiRu: 'Лиссабон', wikiEn: 'Lisbon' }, f, createWikiCache(null), 'en');
  expect(r.summary).toMatchObject({ lang: 'en', title: 'Lisbon' });
  expect(r.link).toBe(articleUrl('en', 'Lisbon'));
  expect((f.mock.calls as unknown[][]).some(([u]) => String(u).includes('ru.wikipedia.org'))).toBe(false);
});
