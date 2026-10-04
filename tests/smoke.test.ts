import { expect, test } from 'vitest';
import { APP_ID, DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../src/app/config';

test('config is consistent', () => {
  expect(APP_ID).toBe('globe-radio');
  expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
});
