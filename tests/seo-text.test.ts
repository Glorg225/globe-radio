import { expect, test } from 'vitest';
import type { StationLite } from '../src/data/shards';
import { countryInSentence, fitDescription, listPhrase, plural, topLanguages } from '../scripts/seo/text';

const st = (langs: string[], tags: string[]): StationLite => ({
  id: 'x', name: 'S', url: '', placeId: 'c:1', cc: 'PT', langs, tags, votes: 0, clicks: 0, favicon: '', hls: false,
});

test('topLanguages: most used first, as English names', () => {
  const stations = [st(['pt'], []), st(['pt', 'en'], []), st(['es'], []), st(['pt'], []), st(['en'], [])];
  expect(topLanguages(stations, 2)).toEqual(['Portuguese', 'English']);
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

test('countryInSentence adds "the" where English needs it', () => {
  expect(countryInSentence('United States')).toBe('the United States');
  expect(countryInSentence('United States', true)).toBe('The United States');
  for (const name of ['Netherlands', 'Philippines', 'Cayman Islands', 'Dominican Republic', 'United Arab Emirates', 'Bahamas', 'Gambia', 'Republic of the Congo', 'Isle of Man']) {
    expect(countryInSentence(name), name).toBe(`the ${name}`);
  }
  for (const name of ['Germany', 'Iceland', 'DR Congo', 'Czechia', 'Ireland', 'Netherlandish']) expect(countryInSentence(name), name).toBe(name);
});
