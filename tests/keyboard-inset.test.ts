import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { bindKeyboardInset } from '../src/ui/keyboard-inset';

test('the on-screen keyboard height becomes --kb so the search results stay above it', () => {
  const vv = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
  const win = { innerHeight: 800, visualViewport: vv };
  const el = document.createElement('div');
  bindKeyboardInset(win, el);
  expect(el.style.getPropertyValue('--kb')).toBe('0px');
  vv.height = 500;
  vv.dispatchEvent(new Event('resize'));
  expect(el.style.getPropertyValue('--kb')).toBe('300px');
});

test('viewport meta lets Android resize the content for the keyboard', () => {
  expect(readFileSync('index.html', 'utf8')).toContain('interactive-widget=resizes-content');
});
