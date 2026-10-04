import { expect, test, vi } from 'vitest';
import { showToast } from '../src/ui/toast';

test('toast shows text as status and disappears', () => {
  vi.useFakeTimers();
  const host = document.createElement('div');
  const t = showToast(host, '<b>x</b>', 1000);
  expect(t.getAttribute('role')).toBe('status');
  expect(t.textContent).toBe('<b>x</b>');
  expect(host.contains(t)).toBe(true);
  vi.advanceTimersByTime(1000);
  expect(host.contains(t)).toBe(false);
  vi.useRealTimers();
});
