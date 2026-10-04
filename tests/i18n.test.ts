import { describe, expect, test } from 'vitest';
import { applyDirection, createI18n, resolveLocale } from '../src/i18n/i18n';
import { safeStorage } from '../src/i18n/storage';

const messages = {
  hello: 'Привет, {name}!',
  'stations.count': { one: '{count} станция', few: '{count} станции', many: '{count} станций', other: '{count} станции' },
  'only.other': { other: '{count} шт.' },
};

describe('t', () => {
  const i18n = createI18n('ru', messages);
  test('interpolates params', () => expect(i18n.t('hello', { name: 'Мир' })).toBe('Привет, Мир!'));
  test('russian plurals', () => {
    expect(i18n.t('stations.count', { count: 1 })).toBe('1 станция');
    expect(i18n.t('stations.count', { count: 3 })).toBe('3 станции');
    expect(i18n.t('stations.count', { count: 5 })).toBe('5 станций');
    expect(i18n.t('stations.count', { count: 21 })).toBe('21 станция');
  });
  test('formats count with locale separators', () =>
    expect(i18n.t('stations.count', { count: 12000 })).toBe('12 000 станций'));
  test('missing plural form falls back to other', () =>
    expect(i18n.t('only.other', { count: 2 })).toBe('2 шт.'));
  test('missing key returns key', () => expect(i18n.t('nope')).toBe('nope'));
});

describe('resolveLocale', () => {
  const sup = ['ru', 'en'];
  const store = (v: string | null) => ({ getItem: () => v } as unknown as Storage);
  test('query param wins', () => expect(resolveLocale('?lang=en', store('ru'), ['ru'], sup, 'ru')).toBe('en'));
  test('stored next', () => expect(resolveLocale('', store('en'), ['ru'], sup, 'ru')).toBe('en'));
  test('browser language by prefix', () => expect(resolveLocale('', null, ['en-GB'], sup, 'ru')).toBe('en'));
  test('unsupported → fallback', () => expect(resolveLocale('?lang=xx', null, ['de'], sup, 'ru')).toBe('ru'));
  test('storage that throws is ignored', () => {
    const bad = { getItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(resolveLocale('', bad, [], sup, 'ru')).toBe('ru');
  });
});

test('applyDirection sets rtl for arabic', () => {
  applyDirection(document, 'ar');
  expect(document.documentElement.dir).toBe('rtl');
  applyDirection(document, 'ru');
  expect(document.documentElement.dir).toBe('ltr');
  expect(document.documentElement.lang).toBe('ru');
});

test('safeStorage never throws', () => {
  expect(() => safeStorage()).not.toThrow();
});
