import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, test, vi } from 'vitest';
import { consentSnippet } from '../src/analytics/consent-snippet';
import { track } from '../src/analytics/track';
import { injectAnalytics } from '../scripts/inject-analytics';

type G = typeof globalThis & { dataLayer?: unknown[][]; gtag?: (...a: unknown[]) => void; globeConsent?: { open(): void } };
const g = globalThis as G;
const run = (id: string) => {
  const html = consentSnippet(id);
  const code = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
  new Function(code)();
};
const gaScript = () => document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
const calls = () => (g.dataLayer ?? []).map((a) => [...a]);

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  localStorage.clear();
  delete g.dataLayer;
  delete g.gtag;
  delete g.globeConsent;
});

test('no measurement id → nothing at all', () => expect(consentSnippet('')).toBe(''));

test('default: everything denied, no Google script, banner shown (review focus 1)', () => {
  run('G-TEST');
  expect(calls()[0]).toEqual(['consent', 'default', expect.objectContaining({ analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })]);
  expect(gaScript()).toBeNull();
  expect(document.querySelector('.consent-bar')!.textContent).toContain('Accept');
});

test('Accept: consent granted, Google script loaded once, choice saved, banner gone', () => {
  run('G-TEST');
  (document.querySelector('.consent-bar__accept') as HTMLButtonElement).click();
  expect(calls()).toContainEqual(['consent', 'update', { analytics_storage: 'granted' }]);
  expect(gaScript()!.getAttribute('src')).toContain('id=G-TEST');
  expect(localStorage.getItem('globe-radio:consent')).toBe('granted');
  expect(document.querySelector('.consent-bar')).toBeNull();
});

test('Reject: saved, no Google script; next visit shows no banner; settings reopen it (review focus 2)', () => {
  run('G-TEST');
  (document.querySelector('.consent-bar__reject') as HTMLButtonElement).click();
  expect(localStorage.getItem('globe-radio:consent')).toBe('denied');
  expect(gaScript()).toBeNull();
  document.body.innerHTML = '';
  run('G-TEST');
  expect(document.querySelector('.consent-bar')).toBeNull();
  g.globeConsent!.open();
  expect(document.querySelector('.consent-bar')).not.toBeNull();
});

test('a returning visitor who accepted gets analytics without a banner', () => {
  localStorage.setItem('globe-radio:consent', 'granted');
  run('G-TEST');
  expect(document.querySelector('.consent-bar')).toBeNull();
  expect(gaScript()).not.toBeNull();
});

test('track sends a GA event when gtag exists and stays silent otherwise', () => {
  expect(() => track('surprise')).not.toThrow();
  g.gtag = vi.fn();
  track('play_station', { country: 'PT' });
  expect(g.gtag).toHaveBeenCalledWith('event', 'play_station', { country: 'PT' });
});

test('inject-analytics replaces the marker in every built HTML page', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dist-'));
  mkdirSync(join(dir, 'radio', 'portugal'), { recursive: true });
  writeFileSync(join(dir, 'radio', 'portugal', 'index.html'), '<head><!-- analytics --></head>');
  writeFileSync(join(dir, 'index.html'), '<head></head>');
  expect(injectAnalytics(dir, 'G-TEST')).toBe(1);
  expect(readFileSync(join(dir, 'radio', 'portugal', 'index.html'), 'utf8')).toContain('G-TEST');
  expect(readFileSync(join(dir, 'radio', 'portugal', 'index.html'), 'utf8')).not.toContain('<!-- analytics -->');
});

test('the build puts the snippet right after <title> on the home page, only with an id', async () => {
  const { withAnalytics } = await import('../src/analytics/consent-snippet');
  const html = '<head><title>Globe Radio</title><link></head>';
  expect(withAnalytics(html, '')).toBe(html);
  const out = withAnalytics(html, 'G-TEST');
  expect(out.indexOf('G-TEST')).toBeGreaterThan(out.indexOf('</title>'));
  expect(out.indexOf('G-TEST')).toBeLessThan(out.indexOf('<link>'));
});

test('review: Accept then Reject stops Google at once and removes its cookies', () => {
  run('G-TEST');
  (document.querySelector('.consent-bar__accept') as HTMLButtonElement).click();
  document.cookie = '_ga=GA1.1.1; path=/';
  document.cookie = '_ga_TEST=GS1.1; path=/';
  g.globeConsent!.open();
  (document.querySelector('.consent-bar__reject') as HTMLButtonElement).click();
  expect((g as unknown as Record<string, unknown>)['ga-disable-G-TEST']).toBe(true);
  expect(document.cookie).not.toContain('_ga');
  expect(localStorage.getItem('globe-radio:consent')).toBe('denied');
});

test('the choice key is namespaced for this site; an old shared key is migrated', () => {
  localStorage.setItem('consent', 'denied');
  run('G-TEST');
  expect(localStorage.getItem('globe-radio:consent')).toBe('denied');
  expect(localStorage.getItem('consent')).toBeNull();
  expect(document.querySelector('.consent-bar')).toBeNull();
});

test('an id that is not a GA4 measurement id is ignored', () => {
  expect(consentSnippet('G-ABC123')).not.toBe('');
  expect(consentSnippet('G-1</script><script>alert(1)')).toBe('');
  expect(consentSnippet('UA-123')).toBe('');
});
