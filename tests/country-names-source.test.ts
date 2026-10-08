import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

// Country names have one source: countryName() in src/data/place-name.ts (everyday English names).
// A second Intl.DisplayNames({ type: 'region' }) brought back "Hong Kong SAR China" in the snapshot (#36).
test('only src/data/place-name.ts builds country names with Intl.DisplayNames', () => {
  const offenders = [...files('src'), ...files('scripts')]
    .filter((f) => /\.ts$/.test(f) && f !== join('src', 'data', 'place-name.ts'))
    .filter((f) => /type:\s*['"`]region['"`]/.test(readFileSync(f, 'utf8')));
  expect(offenders).toEqual([]);
});
