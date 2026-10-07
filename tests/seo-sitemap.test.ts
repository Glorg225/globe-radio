import { expect, test } from 'vitest';
import { robotsTxt, sitemapXml } from '../scripts/seo/sitemap';

test('sitemap.xml: valid XML, one <url> per address, lastmod is the snapshot date', () => {
  const xml = sitemapXml(['https://example.com/gr/', 'https://example.com/gr/radio/a&b/'], '2026-10-07T16:21:04.852Z');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  expect([...doc.querySelectorAll('url > loc')].map((l) => l.textContent)).toEqual(['https://example.com/gr/', 'https://example.com/gr/radio/a&b/']);
  expect([...doc.querySelectorAll('url > lastmod')].map((l) => l.textContent)).toEqual(['2026-10-07', '2026-10-07']);
  expect(doc.documentElement.namespaceURI).toBe('http://www.sitemaps.org/schemas/sitemap/0.9');
});

test('sitemap.xml without a snapshot date has no lastmod', () => {
  expect(sitemapXml(['https://example.com/'], '')).not.toContain('lastmod');
});

test('robots.txt allows everything and points to the sitemap', () => {
  expect(robotsTxt('https://example.com/gr')).toBe('User-agent: *\nAllow: /\nSitemap: https://example.com/gr/sitemap.xml\n');
});
