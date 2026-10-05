import type { I18n } from '../i18n/i18n';
import { lowerFirst, searchLanguages, type LanguageEntry } from '../learn/language-index';
import { escapeHtml } from './html';
import { icons } from './icons';

export interface LearnPickerProps { languages(): LanguageEntry[]; current(): string | null; onPick(code: string): void }

export function createLearnPicker(i18n: I18n, button: HTMLButtonElement, p: LearnPickerProps): { update(): void; close(): void } {
  let pop: HTMLElement | null = null;
  let active = 0;
  let shown: LanguageEntry[] = [];
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');

  const onOutside = (e: MouseEvent) => {
    if (pop && !pop.contains(e.target as Node) && !button.contains(e.target as Node)) close();
  };

  function close(returnFocus = false) {
    if (!pop) return;
    pop.remove();
    pop = null;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside);
    if (returnFocus) button.focus();
  }

  function renderItems(list: HTMLElement, query: string) {
    shown = searchLanguages(p.languages(), query);
    active = Math.min(active, Math.max(0, shown.length - 1));
    list.replaceChildren();
    if (!shown.length) {
      const empty = document.createElement('p');
      empty.className = 'learn-pop__empty';
      empty.textContent = i18n.t('learn.notFound');
      list.append(empty);
      return;
    }
    shown.forEach((e, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'learn-pop__item';
      item.setAttribute('role', 'option');
      item.classList.toggle('is-selected', e.code === p.current());
      item.classList.toggle('is-active', i === active);
      const name = document.createElement('span');
      name.textContent = e.name;
      const count = document.createElement('span');
      count.className = 'learn-pop__count';
      count.textContent = i18n.t('stations.count', { count: e.stations });
      item.append(name, count);
      item.addEventListener('click', () => pick(e.code));
      list.append(item);
    });
  }

  function pick(code: string, returnFocus = false) {
    close(returnFocus);
    p.onPick(code);
  }

  function open() {
    pop = document.createElement('div');
    pop.className = 'learn-pop';
    pop.innerHTML = `<label class="learn-pop__search">${icons.search}<input type="search" placeholder="${escapeHtml(i18n.t('learn.search'))}" aria-label="${escapeHtml(i18n.t('learn.search'))}"></label><div class="learn-pop__list" role="listbox"></div>`;
    const input = pop.querySelector('input')!;
    const list = pop.querySelector<HTMLElement>('.learn-pop__list')!;
    active = Math.max(0, p.languages().findIndex((e) => e.code === p.current()));
    renderItems(list, '');
    input.addEventListener('input', () => { active = 0; renderItems(list, input.value); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = Math.min(shown.length - 1, Math.max(0, active + (e.key === 'ArrowDown' ? 1 : -1)));
        renderItems(list, input.value);
        list.querySelector('.is-active')?.scrollIntoView?.({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter' && shown[active]) { e.preventDefault(); pick(shown[active].code, true); }
    });
    button.insertAdjacentElement('afterend', pop);
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onOutside);
    input.focus();
  }

  button.addEventListener('click', () => (pop ? close() : open()));

  return {
    update() {
      const code = p.current();
      const entry = code ? p.languages().find((e) => e.code === code) : undefined;
      button.classList.toggle('is-learning', !!entry);
      const label = entry ? i18n.t('learn.buttonActive', { lang: lowerFirst(entry.name, i18n.locale) }) : i18n.t('learn.button');
      button.setAttribute('aria-label', label);
      const span = button.querySelector('span');
      if (span) span.textContent = label;
    },
    close: () => close(),
  };
}
