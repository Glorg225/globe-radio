import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import en from '../locales/en.json';
import ru from '../locales/ru.json';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../src/app/config';
import { createI18n } from '../src/i18n/i18n';

const CYRILLIC = /[Ѐ-ӿ]/;

test('production is English only', () => {
  expect([...SUPPORTED_LOCALES]).toEqual(['en']);
  expect(DEFAULT_LOCALE).toBe('en');
});

test('en.json has every key of ru.json and no Cyrillic', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  expect(CYRILLIC.test(JSON.stringify(en))).toBe(false);
  expect(en['app.name']).toBe('Globe Radio');
});

test('English plurals', () => {
  const i18n = createI18n('en', en);
  expect(i18n.t('stations.count', { count: 1 })).toBe('1 station');
  expect(i18n.t('stations.count', { count: 2 })).toBe('2 stations');
  expect(i18n.t('learn.countries', { count: 21 })).toBe('21 countries');
});

test('index.html is English: lang, no Cyrillic', () => {
  const html = readFileSync('index.html', 'utf8');
  expect(html).toContain('<html lang="en"');
  expect(CYRILLIC.test(html)).toBe(false);
});
