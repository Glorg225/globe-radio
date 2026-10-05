import type { StationLite } from '../data/shards';
import type { I18n } from '../i18n/i18n';
import { icons } from './icons';

export interface StationListProps {
  title: string; subtitle: string; stations: StationLite[]; playingId: string | null; onPick(s: StationLite): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function tile(s: StationLite): HTMLElement {
  const box = el('div', 'station__tile', (s.name.trim()[0] ?? '?').toUpperCase());
  if (s.favicon) {
    const img = new Image();
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => box.classList.add('has-img');
    img.onerror = () => img.remove();
    img.src = s.favicon;
    box.append(img);
  }
  return box;
}

export interface StationListHandle { setPlaying(id: string | null): void }

export function renderStationList(host: HTMLElement, i18n: I18n, p: StationListProps): StationListHandle {
  const head = el('div', 'list-head');
  head.append(el('h2', 'list-title', p.title), el('p', 'list-sub', p.subtitle));
  const list = el('ul', 'stations');
  const rows = new Map<string, { row: HTMLLIElement; pick: HTMLButtonElement }>();
  for (const s of p.stations) {
    const playing = s.id === p.playingId;
    const row = el('li', playing ? 'station is-playing' : 'station');
    const pick = el('button', 'station__pick');
    pick.type = 'button';
    if (playing) pick.setAttribute('aria-current', 'true');
    const text = el('span', 'station__text');
    text.append(el('span', 'station__name', s.name), el('span', 'station__tags', s.tags.slice(0, 3).join(' · ')));
    pick.append(tile(s), text);
    pick.addEventListener('click', () => p.onPick(s));
    const star = el('button', 'station__star');
    star.type = 'button';
    star.disabled = true;
    star.setAttribute('aria-label', i18n.t('station.favorite'));
    star.title = i18n.t('common.soon');
    star.innerHTML = icons.star;
    row.append(pick, star);
    rows.set(s.id, { row, pick });
    list.append(row);
  }
  host.replaceChildren(head, list);
  let current = p.playingId;
  return {
    // Only moves the highlight, so a focused row keeps keyboard focus.
    setPlaying(id) {
      if (id === current) return;
      const prev = current ? rows.get(current) : undefined;
      prev?.row.classList.remove('is-playing');
      prev?.pick.removeAttribute('aria-current');
      const next = id ? rows.get(id) : undefined;
      next?.row.classList.add('is-playing');
      next?.pick.setAttribute('aria-current', 'true');
      current = id;
    },
  };
}

export function renderListMessage(host: HTMLElement, text: string, action?: { label: string; onClick(): void }): void {
  const msg = el('p', 'panel-empty', text);
  if (!action) { host.replaceChildren(msg); return; }
  const btn = el('button', 'btn btn--outline panel-action', action.label);
  btn.type = 'button';
  btn.addEventListener('click', action.onClick);
  host.replaceChildren(msg, btn);
}
