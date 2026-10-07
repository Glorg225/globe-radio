import { expect, test } from 'vitest';
import type { StationLite } from '../src/data/shards';
import { fitDescription, listPhrase, plural, topGenres, topLanguages } from '../scripts/seo/text';

const st = (langs: string[], tags: string[]): StationLite => ({
  id: 'x', name: 'S', url: '', placeId: 'c:1', cc: 'PT', langs, tags, votes: 0, clicks: 0, favicon: '', hls: false,
});

test('topLanguages: most used first, as English names', () => {
  const stations = [st(['pt'], []), st(['pt', 'en'], []), st(['es'], []), st(['pt'], []), st(['en'], [])];
  expect(topLanguages(stations, 2)).toEqual(['Portuguese', 'English']);
});

test('topGenres skips bitrates, place names and tags used by a single station', () => {
  const stations = [
    st([], ['Pop', '64kbps', 'portugal', 'news']), st([], ['pop', '128kbps', 'portugal', 'lisbon']),
    st([], ['news', 'lisbon', 'jazz']), st([], ['pop']),
  ];
  expect(topGenres(stations, ['Portugal', 'Lisbon'])).toEqual(['pop', 'news']);
});

test('listPhrase', () => {
  expect(listPhrase([])).toBe('');
  expect(listPhrase(['a'])).toBe('a');
  expect(listPhrase(['a', 'b'])).toBe('a and b');
  expect(listPhrase(['a', 'b', 'c'])).toBe('a, b and c');
});

test('plural', () => {
  expect(plural(1, 'station')).toBe('1 station');
  expect(plural(1234, 'station')).toBe('1,234 stations');
  expect(plural(2, 'city', 'cities')).toBe('2 cities');
});

test('fitDescription keeps to 160 characters, dropping station names first', () => {
  const lead = 'Listen to 35 live radio stations from Lisbon, Portugal online';
  expect(fitDescription(lead, ['RFM', 'Antena 1', 'TSF', 'Extra'], 'Free, no sign-up.')).toBe(`${lead}: RFM, Antena 1, TSF. Free, no sign-up.`);
  const long = ['A'.repeat(60), 'B'.repeat(60)];
  const d = fitDescription(lead, long, 'Free, no sign-up.');
  expect(d.length).toBeLessThanOrEqual(160);
  expect(d).toBe(`${lead}: ${long[0]}. Free, no sign-up.`);
  expect(fitDescription('X'.repeat(200), [], 'Free.')).toHaveLength(160);
});
