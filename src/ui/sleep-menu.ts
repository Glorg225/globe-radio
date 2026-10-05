import type { I18n } from '../i18n/i18n';
import { SLEEP_OPTIONS } from '../player/sleep-timer';

export function openSleepMenu(anchor: HTMLElement, i18n: I18n, current: number | null, onPick: (minutes: number | null) => void): { close(): void } {
  document.querySelector('.sleep-menu')?.remove();
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
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); anchor.focus(); } };
  const onOutside = (e: MouseEvent) => { if (!menu.contains(e.target as Node) && e.target !== anchor) close(); };
  function close() {
    menu.remove();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('mousedown', onOutside);
  }
  anchor.insertAdjacentElement('afterend', menu);
  document.addEventListener('keydown', onKey);
  document.addEventListener('mousedown', onOutside);
  (menu.querySelector('[aria-checked="true"]') as HTMLElement | null ?? menu.querySelector('button'))?.focus();
  return { close };
}
