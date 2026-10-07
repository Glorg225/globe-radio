import { expect, test } from 'vitest';
import { assignSlugs, slugify } from '../src/seo/slug';

test('slugify keeps Latin letters and digits, strips diacritics and punctuation', () => {
  expect(slugify('São Paulo')).toBe('sao-paulo');
  expect(slugify('Köln')).toBe('koln');
  expect(slugify("Côte d'Ivoire")).toBe('cote-d-ivoire');
  expect(slugify('Łódź')).toBe('lodz');
  expect(slugify('Straße')).toBe('strasse');
  expect(slugify('  Viana do Castelo ')).toBe('viana-do-castelo');
  expect(slugify('İstanbul')).toBe('istanbul');
  expect(slugify('東京')).toBe('');
});

test('assignSlugs: first item keeps the plain slug, collisions get an id suffix, empty slug falls back to the id', () => {
  const items = [{ id: 'c:1', name: 'São Paulo' }, { id: 'c:2', name: 'Sao Paulo' }, { id: 'c:3', name: '東京' }];
  const slugs = assignSlugs(items, (i) => i.name, (i) => i.id);
  expect(items.map((i) => slugs.get(i))).toEqual(['sao-paulo', 'sao-paulo-2', 'c-3']);
});

test('assignSlugs never hands out the same slug twice', () => {
  const items = [{ id: 'c:2', name: 'Sao Paulo 2' }, { id: 'c:1', name: 'Sao Paulo' }, { id: 'c:2', name: 'São Paulo' }];
  const slugs = [...assignSlugs(items, (i) => i.name, (i) => i.id).values()];
  expect(new Set(slugs).size).toBe(3);
});
