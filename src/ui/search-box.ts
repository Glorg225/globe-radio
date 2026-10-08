import type { Place } from '../data/places';
import type { I18n } from '../i18n/i18n';
import type { SearchHit, SearchResult } from '../search/search-index';

export const SEARCH_DEBOUNCE_MS = 150;
// browse: optional block (links to country pages) shown while the field is empty.
export interface SearchBoxDeps { search(q: string): Promise<SearchResult>; placeLabel(p: Place): string; onPlace(p: Place): void; onStation(h: SearchHit): void; prefetch?(): void; browse?(): HTMLElement | null }

export function createSearchBox(input: HTMLInputElement, i18n: I18n, d: SearchBoxDeps): { close(): void } {
  const anchor = input.closest('label') ?? input;
  let pop: HTMLElement | null = null;
  let token = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let actions: (() => void)[] = [];
  let active = -1;
  const POP_ID = 'search-pop';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', POP_ID);

  const onOutside = (e: MouseEvent) => { if (pop && !pop.contains(e.target as Node) && !anchor.contains(e.target as Node)) close(); };
  // Keyboard users tab from the field into the browse links: close once focus leaves both.
  const onFocusIn = (e: FocusEvent) => { if (pop && !pop.contains(e.target as Node) && e.target !== input) close(); };
  let reopen = true;
  function close() {
    token++;
    pop?.remove();
    pop = null;
    actions = [];
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    document.removeEventListener('mousedown', onOutside);
    document.removeEventListener('focusin', onFocusIn);
  }
  function ensurePop(): HTMLElement {
    if (!pop) {
      pop = document.createElement('div');
      pop.className = 'search-pop';
      pop.id = POP_ID;
      input.setAttribute('aria-expanded', 'true');
      anchor.insertAdjacentElement('afterend', pop);
      pop.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        close();
        reopen = false;
        input.focus();
        reopen = true;
      });
      document.addEventListener('mousedown', onOutside);
      document.addEventListener('focusin', onFocusIn);
    }
    pop.setAttribute('role', 'listbox');
    return pop;
  }
  // Links, not options: the popover is not a listbox while it shows them.
  function showBrowse(): boolean {
    const block = d.browse?.();
    if (!block) return false;
    token++;
    const p = ensurePop();
    p.removeAttribute('role');
    p.replaceChildren(block);
    actions = [];
    active = -1;
    input.removeAttribute('aria-activedescendant');
    return true;
  }
  function message(text: string) {
    const p = document.createElement('p');
    p.className = 'search-pop__msg';
    p.textContent = text;
    ensurePop().replaceChildren(p);
    actions = [];
  }
  function item(title: string, sub: string, run: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'search-pop__item';
    b.setAttribute('role', 'option');
    b.id = `search-opt-${actions.length}`;
    const t = document.createElement('span');
    t.className = 'search-pop__name';
    t.textContent = title;
    const s = document.createElement('span');
    s.className = 'search-pop__sub';
    s.textContent = sub;
    b.append(t, s);
    const go = () => { close(); input.value = ''; run(); };
    b.addEventListener('click', go);
    actions.push(go);
    return b;
  }
  function render(r: SearchResult) {
    if (!r.places.length && !r.stations.length) { message(i18n.t('search.empty')); return; }
    const host = ensurePop();
    host.replaceChildren();
    actions = [];
    active = -1;
    const section = (title: string) => { const h = document.createElement('p'); h.className = 'search-pop__title'; h.textContent = title; host.append(h); };
    if (r.places.length) {
      section(i18n.t('search.places'));
      for (const p of r.places) {
        const count = i18n.t('stations.count', { count: p.count });
        const sub = p.kind === 'region' ? i18n.t('search.region', { stations: count }) : count;
        host.append(item(d.placeLabel(p), sub, () => d.onPlace(p)));
      }
    }
    if (r.stations.length) {
      section(i18n.t('search.stations'));
      for (const h of r.stations) host.append(item(h.name, d.placeLabel(h.place), () => d.onStation(h)));
    }
  }
  function highlight() {
    const items = pop ? [...pop.querySelectorAll<HTMLElement>('.search-pop__item')] : [];
    items.forEach((el, i) => { el.classList.toggle('is-active', i === active); el.setAttribute('aria-selected', String(i === active)); });
    if (active >= 0 && items[active]) input.setAttribute('aria-activedescendant', items[active].id);
    else input.removeAttribute('aria-activedescendant');
  }

  input.addEventListener('focus', () => {
    d.prefetch?.();
    if (reopen && !input.value.trim()) showBrowse();
  });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    actions = [];
    active = -1;
    highlight();
    const q = input.value.trim();
    if (!q && showBrowse()) return;
    if (q.length < 2) { close(); return; }
    const my = ++token;
    timer = setTimeout(() => {
      if (my !== token) return;
      let done = false;
      void Promise.resolve().then(() => { if (!done && my === token) message(i18n.t('search.loading')); });
      d.search(q).then(
        (r) => { done = true; if (my === token) render(r); },
        () => { done = true; if (my === token) message(i18n.t('search.error')); },
      );
    }, SEARCH_DEBOUNCE_MS);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    // Tab walks into the browse links; it closes only the result list.
    if (e.key === 'Tab') { if (!pop?.hasAttribute('role')) return; close(); return; }
    if (!actions.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + actions.length) % actions.length;
      highlight();
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      actions[active]();
    }
  });
  return { close };
}
