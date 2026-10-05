import { expect, test } from 'vitest';
import { BLACKLIST_TTL_MS, createBlacklist } from '../src/player/blacklist';

class Mem {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const mem = () => new Mem() as unknown as Storage;

test('ttl is 12 hours (customer decision 04.10.2026)', () => expect(BLACKLIST_TTL_MS).toBe(12 * 3600 * 1000));

test('station stays blocked until the ttl passes', () => {
  let t = 1000;
  const b = createBlacklist(mem(), () => t);
  b.add('x');
  t += BLACKLIST_TTL_MS - 1;
  expect(b.has('x')).toBe(true);
  t += 1;
  expect(b.has('x')).toBe(false);
  expect(b.has('never')).toBe(false);
});

test('persists across instances', () => {
  const s = mem();
  createBlacklist(s, () => 0).add('x');
  expect(createBlacklist(s, () => 1).has('x')).toBe(true);
});

test('works without storage and with storage that throws (review focus 4)', () => {
  const none = createBlacklist(null, () => 0);
  none.add('x');
  expect(none.has('x')).toBe(true);
  const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
  const b = createBlacklist(bad, () => 0);
  expect(() => b.add('y')).not.toThrow();
  expect(b.has('y')).toBe(true);
});

test('corrupt stored value is ignored', () => {
  const s = mem();
  s.setItem('blacklist', '{not json');
  expect(createBlacklist(s, () => 0).has('x')).toBe(false);
});
