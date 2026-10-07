import type { I18n } from '../i18n/i18n';
import { SLEEP_OPTIONS } from '../player/sleep-timer';

let open: { anchor: HTMLElement; close(): void } | null = null;

// Pressing the sleep button again closes the menu (toggle).
export function openSleepMenu(anchor: HTMLElement, i18n: I18n, current: number | null, onPick: (minutes: number | null) => void): { close(): void } {
  const wasOpen = open;
  wasOpen?.close();
  if (wasOpen?.anchor === anchor) return { close() {} };
  const menu = document.createElement('div');
  menu.className = 'sleep-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', i18n.t('sleep.title'));
  const options: (number | null)[] = [...SLEEP_OPTIONS, null];
  for (const m of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitemradio');
    b.setAttribute('aria-checked', String(m === current));
    b.textContent = m === null ? i18n.t('sleep.off') : i18n.t('sleep.minutes', { m });
    b.addEventListener('click', () => { close(); onPick(m); });
    menu.append(b);
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { close(); anchor.focus(); return; }
    if (e.key === 'Tab') { close(); return; }
    const list = [...menu.querySelectorAll<HTMLButtonElement>('button')];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === 'ArrowDown' ? (i + 1) % list.length
      : e.key === 'ArrowUp' ? (i - 1 + list.length) % list.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? list.length - 1
      : -1;
    if (to >= 0) { e.preventDefault(); list[to].focus(); }
  };
  const onOutside = (e: MouseEvent) => { if (!menu.contains(e.target as Node) && !anchor.contains(e.target as Node)) close(); };
  function close() {
    if (open?.close === close) open = null;
    menu.remove();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('mousedown', onOutside);
  }
  open = { anchor, close };
  anchor.insertAdjacentElement('afterend', menu);
  document.addEventListener('keydown', onKey);
  document.addEventListener('mousedown', onOutside);
  (menu.querySelector('[aria-checked="true"]') as HTMLElement | null ?? menu.querySelector('button'))?.focus();
  return { close };
}
