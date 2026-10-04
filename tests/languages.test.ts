import { expect, test } from 'vitest';
import { normalizeLanguages } from '../src/data/languages';

test('uses languagecodes when present', () =>
  expect(normalizeLanguages('es,ca', 'spanish,catalan')).toEqual(['es', 'ca']));
test('codes are trimmed, lowercased, deduped', () =>
  expect(normalizeLanguages(' EN , en,es', '')).toEqual(['en', 'es']));
test('falls back to names in english and native forms', () =>
  expect(normalizeLanguages('', 'Spanish, español,  ENGLISH ,русский')).toEqual(['es', 'en', 'ru']));
test('accepts names separated by / ; and "and"', () =>
  expect(normalizeLanguages('', 'french/german;italian and portuguese')).toEqual(['fr', 'de', 'it', 'pt']));
test('drops unknown codes and names', () =>
  expect(normalizeLanguages('zz,xx1', 'klingon, music')).toEqual([]));
test('3-letter ISO 639-2 codes map to 639-1 when known', () =>
  expect(normalizeLanguages('spa,eng', '')).toEqual(['es', 'en']));
test('empty input', () => expect(normalizeLanguages('', '')).toEqual([]));
