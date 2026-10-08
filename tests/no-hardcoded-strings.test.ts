import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

// Data dictionaries (native language names) are not UI strings.
const ALLOWED = new Set([join('src', 'data', 'languages.ts'), join('src', 'data', 'gazetteer.ts'), join('src', 'data', 'genres.ts'), join('src', 'i18n', 'ru-grammar.ts')]);

test('no Cyrillic UI strings in src/', () => {
  const offenders = files('src')
    .filter((f) => /\.(ts|css|html)$/.test(f) && !ALLOWED.has(f))
    .filter((f) => /[А-Яа-яЁё]/.test(readFileSync(f, 'utf8')));
  expect(offenders).toEqual([]);
});
