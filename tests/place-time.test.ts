import { expect, test } from 'vitest';
import ru from '../locales/ru.json';
import { createI18n } from '../src/i18n/i18n';
import { flagUrl } from '../src/place-card/flag';
import { languageNames } from '../src/place-card/language';
import { diffLabel, formatClock, isValidTimeZone, msUntilNextMinute, offsetMinutes } from '../src/place-card/time';

const i18n = createI18n('ru', ru);
const jan = new Date(Date.UTC(2026, 0, 15, 12, 0));
const jul = new Date(Date.UTC(2026, 6, 15, 12, 0));

test('offsets incl. DST and half/quarter hours (review focus 3)', () => {
  expect(offsetMinutes('Europe/Berlin', jan)).toBe(60);
  expect(offsetMinutes('Europe/Berlin', jul)).toBe(120);
  expect(offsetMinutes('Asia/Kolkata', jan)).toBe(330);
  expect(offsetMinutes('Asia/Kathmandu', jan)).toBe(345);
  expect(offsetMinutes('America/New_York', jan)).toBe(-300);
  expect(offsetMinutes('UTC', jan)).toBe(0);
});

test('clock in the place timezone', () => {
  expect(formatClock('Europe/Lisbon', new Date(Date.UTC(2026, 0, 15, 14, 32)), 'ru')).toBe('14:32');
  expect(formatClock('Asia/Tokyo', new Date(Date.UTC(2026, 0, 15, 23, 5)), 'ru')).toBe('08:05');
});

test('difference label', () => {
  expect(diffLabel(i18n, 60, 180)).toBe('на 2 ч раньше вас');
  expect(diffLabel(i18n, 330, 180)).toBe('на 2 ч 30 мин позже вас');
  expect(diffLabel(i18n, 225, 180)).toBe('на 45 мин позже вас');
  expect(diffLabel(i18n, 180, 180)).toBe('как у вас');
});

test('timezone validation', () => {
  expect(isValidTimeZone('Europe/Lisbon')).toBe(true);
  expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  expect(isValidTimeZone('')).toBe(false);
});

test('next minute boundary', () => {
  expect(msUntilNextMinute(Date.UTC(2026, 0, 1, 0, 0, 59, 500))).toBe(500);
  expect(msUntilNextMinute(Date.UTC(2026, 0, 1, 0, 1, 0, 0))).toBe(60000);
});

test('language names in the UI language, lower-case, comma-separated', () => {
  expect(languageNames(['pt'], 'ru')).toBe('португальский');
  expect(languageNames(['es', 'ca'], 'ru')).toBe('испанский, каталанский');
  expect(languageNames([], 'ru')).toBe('');
});

test('flag url for known countries only', () => {
  expect(flagUrl('PT')).toMatch(/pt.*\.svg/);
  expect(flagUrl('pt')).toBe(flagUrl('PT'));
  expect(flagUrl('QQ')).toBeNull();
});
