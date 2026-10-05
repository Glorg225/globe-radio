import { beforeEach, expect, test, vi } from 'vitest';
import { openMoreMenu } from '../src/ui/more-menu';

let anchor: HTMLButtonElement;
beforeEach(() => { document.body.innerHTML = '<footer><button class="more"></button></footer>'; anchor = document.querySelector('.more')!; });

test('lists items as a menu, runs the picked one and closes', () => {
  const a = vi.fn();
  openMoreMenu(anchor, 'Ещё', [{ label: 'Таймер сна', onClick: a }, { label: 'Поделиться', onClick: vi.fn() }]);
  const menu = document.querySelector('.more-menu') as HTMLElement;
  expect(menu.getAttribute('role')).toBe('menu');
  expect([...menu.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent)).toEqual(['Таймер сна', 'Поделиться']);
  expect(document.activeElement).toBe(menu.querySelector('button'));
  (menu.querySelector('button') as HTMLButtonElement).click();
  expect(a).toHaveBeenCalled();
  expect(document.querySelector('.more-menu')).toBeNull();
});

test('arrows move focus, Escape closes and returns focus, same anchor toggles', () => {
  openMoreMenu(anchor, 'Ещё', [{ label: 'A', onClick() {} }, { label: 'B', onClick() {} }]);
  const items = [...document.querySelectorAll('.more-menu button')] as HTMLButtonElement[];
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  expect(document.activeElement).toBe(items[1]);
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(document.querySelector('.more-menu')).toBeNull();
  expect(document.activeElement).toBe(anchor);
  openMoreMenu(anchor, 'Ещё', [{ label: 'A', onClick() {} }]);
  openMoreMenu(anchor, 'Ещё', [{ label: 'A', onClick() {} }]);
  expect(document.querySelector('.more-menu')).toBeNull();
});
