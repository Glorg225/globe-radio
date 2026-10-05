import { beforeEach, expect, test, vi } from 'vitest';
import { attachSheetDrag } from '../src/ui/sheet';

let sheet: HTMLElement;
let handle: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<section><div class="h" tabindex="0"></div></section>';
  sheet = document.querySelector('section')!;
  handle = document.querySelector('.h')!;
});
const drag = (from: number, to: number) => {
  handle.dispatchEvent(new MouseEvent('pointerdown', { clientY: from, bubbles: true }));
  document.dispatchEvent(new MouseEvent('pointerup', { clientY: to, bubbles: true }));
};

test('expandable: up → full, down → half, down from half → close', () => {
  const onClose = vi.fn();
  attachSheetDrag(sheet, handle, { expandable: true, onClose });
  drag(400, 300);
  expect(sheet.classList.contains('is-full')).toBe(true);
  expect(handle.getAttribute('aria-expanded')).toBe('true');
  drag(300, 400);
  expect(sheet.classList.contains('is-full')).toBe(false);
  expect(onClose).not.toHaveBeenCalled();
  drag(300, 400);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('a short tap toggles size and never closes (review focus 5)', () => {
  const onClose = vi.fn();
  attachSheetDrag(sheet, handle, { expandable: true, onClose });
  drag(400, 395);
  expect(sheet.classList.contains('is-full')).toBe(true);
  drag(400, 410);
  expect(sheet.classList.contains('is-full')).toBe(false);
  expect(onClose).not.toHaveBeenCalled();
});

test('keyboard: Enter toggles, Escape closes', () => {
  const onClose = vi.fn();
  attachSheetDrag(sheet, handle, { expandable: true, onClose });
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(sheet.classList.contains('is-full')).toBe(true);
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(onClose).toHaveBeenCalled();
});

test('not expandable: swipe down closes, tap does nothing; detach removes listeners', () => {
  const onClose = vi.fn();
  const off = attachSheetDrag(sheet, handle, { expandable: false, onClose });
  drag(400, 398);
  expect(onClose).not.toHaveBeenCalled();
  expect(sheet.classList.contains('is-full')).toBe(false);
  drag(300, 400);
  expect(onClose).toHaveBeenCalledTimes(1);
  off();
  drag(300, 400);
  expect(onClose).toHaveBeenCalledTimes(1);
});
