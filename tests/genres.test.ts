import { expect, test } from 'vitest';
import { decadeOf, GENRES, genreById, stationGenres, tagKey } from '../src/data/genres';

test('tagKey ignores case, diacritics, spaces and punctuation, keeps other scripts', () => {
  expect(new Set(['Hip-Hop', 'hip hop', 'hiphop', 'HIP_HOP'].map(tagKey))).toEqual(new Set(['hiphop']));
  expect(tagKey('Música Clásica')).toBe('musicaclasica');
  expect(tagKey("80's")).toBe('80s');
  expect(tagKey('Поп-музыка')).toBe('попмузыка');
  expect(tagKey('R&B')).toBe('rb');
});

test('decades are recognised by a rule, not by a list', () => {
  for (const t of ['80s', "80's", '80er', '1980s', '80', 'Eighties']) expect(decadeOf(tagKey(t)), t).toBe('80s');
  for (const t of ['00s', '2000s', '2000er']) expect(decadeOf(tagKey(t)), t).toBe('2000s');
  expect(decadeOf(tagKey('2010s'))).toBe('2010s');
  expect(decadeOf(tagKey('50s'))).toBe('50s');
  for (const t of ['128kbps', '80s en español', '1980', '99.3 fm', '24/7']) expect(decadeOf(tagKey(t)), t).toBeUndefined();
});

test('stationGenres: several styles per station, in dictionary order, junk gives none', () => {
  expect(stationGenres(['Smooth Jazz', 'news', 'jazz', 'NOTICIAS'])).toEqual(['jazz', 'news']);
  expect(stationGenres(['hiphop', 'rap', "80's", 'deep house'])).toEqual(['house', 'hip-hop', '80s']);
  expect(stationGenres(['music', 'webradio', 'fm', 'nrj', 'américa', '128kbps'])).toEqual([]);
  expect(stationGenres([])).toEqual([]);
});

test('frequent spellings from the snapshot land in the expected style', () => {
  const cases: Record<string, string> = {
    'classic rock': 'classic-rock', 'top 40': 'hits', 'top40': 'hits', 'adult contemporary': 'easy-listening',
    'christian': 'religious', 'gospel': 'religious', 'islamic': 'religious', 'deportes': 'sports', 'public radio': 'public',
    'cumbia': 'latin', 'banda': 'regional-mexican', 'schlager': 'schlager', 'chillout': 'chillout', 'lounge': 'chillout',
    'eclectic': 'variety', 'cultural': 'culture', 'r&b': 'rnb', 'rnb': 'rnb', 'soul': 'rnb', 'indie': 'alternative', 'electro': 'electronic', 'edm': 'electronic',
    'talk & speech': 'talk', 'news talk': 'news', 'community radio': 'community', 'oldies': 'oldies', 'classical music': 'classical',
  };
  for (const [tag, id] of Object.entries(cases)) expect(stationGenres([tag]), tag).toEqual([id]);
});

test('every spelling belongs to exactly one style, ids are page slugs, groups are known', () => {
  const owner = new Map<string, string>();
  for (const g of GENRES) {
    expect(g.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(['genre', 'format', 'decade']).toContain(g.group);
    for (const a of g.aliases) {
      const key = tagKey(a);
      expect(owner.get(key), `${a} in ${g.id} and ${owner.get(key)}`).toBeUndefined();
      expect(decadeOf(key), `${a} is a decade`).toBeUndefined();
      owner.set(key, g.id);
    }
  }
  expect(new Set(GENRES.map((g) => g.id)).size).toBe(GENRES.length);
  expect(genreById('jazz')?.name).toBe('Jazz');
  expect(GENRES.filter((g) => g.group === 'decade').map((g) => g.id)).toEqual(['50s', '60s', '70s', '80s', '90s', '2000s', '2010s']);
});
