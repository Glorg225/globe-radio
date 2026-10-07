import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('index.html carries Open Graph and Twitter preview tags', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:type', 'twitter:card']) expect(html).toContain(tag);
  expect(html).toContain('%VITE_SITE_URL%/og.png');
});

test('the preview image exists and is a 1200×630 PNG', () => {
  expect(existsSync('public/og.png')).toBe(true);
  const b = readFileSync('public/og.png');
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([1200, 630]);
});

test('index.html carries the Google Search Console verification tag', () => {
  expect(readFileSync('index.html', 'utf8')).toContain('<meta name="google-site-verification" content="koz8gY8zAL6HrfheDI7TlQw0owSM11vRuoMCq31SH0Q">');
});

test('home page SEO: canonical, og:url, short description, valid WebSite JSON-LD', () => {
  const html = readFileSync('index.html', 'utf8');
  expect(html).toContain('<link rel="canonical" href="%VITE_SITE_URL%/">');
  expect(html).toContain('<meta property="og:url" content="%VITE_SITE_URL%/">');
  const desc = /<meta name="description" content="([^"]+)">/.exec(html)![1];
  expect(desc.length).toBeLessThanOrEqual(160);
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]);
  expect(ld).toMatchObject({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Globe Radio', url: '%VITE_SITE_URL%/', inLanguage: 'en' });
});
