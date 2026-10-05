import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// jsdom does not apply author CSS, so guard the rule that makes `hidden` win over `display: flex` blocks.
test('a global [hidden] rule beats component display rules', () => {
  const css = readFileSync('src/ui/tokens.css', 'utf8');
  expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
});
