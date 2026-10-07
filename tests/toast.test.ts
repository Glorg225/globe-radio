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

test('action toast stays until the action or close is pressed', async () => {
  const { showActionToast } = await import('../src/ui/toast');
  document.body.innerHTML = '<main></main>';
  const host = document.querySelector('main')!;
  const onClick = vi.fn();
  const box = showActionToast(host, 'Доступна новая версия', { label: 'Обновить', onClick });
  expect(box.textContent).toContain('Доступна новая версия');
  (box.querySelector('button') as HTMLButtonElement).click();
  expect(onClick).toHaveBeenCalled();
  expect(host.contains(box)).toBe(false);
});
