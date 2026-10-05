import type { StationLite } from '../data/shards';
import type { I18n } from '../i18n/i18n';
import { isTalk } from '../learn/talk';
import type { SavedStation } from '../library/library';
import { icons } from './icons';

export interface StationListProps {
  title: string; subtitle: string; stations: StationLite[]; playingId: string | null; onPick(s: StationLite): void;
  learn?: { tip: string; talkLabel: string };
  favorites?: { isFavorite(id: string): boolean; onToggle(s: StationLite): void };
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function tile(s: Pick<StationLite, 'name' | 'favicon'>): HTMLElement {
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

export interface StationListHandle { setPlaying(id: string | null): void; refreshFavorites(): void }

function paintStar(star: HTMLButtonElement, i18n: I18n, on: boolean) {
  star.setAttribute('aria-pressed', String(on));
  star.classList.toggle('is-fav', on);
  star.setAttribute('aria-label', i18n.t(on ? 'station.unfavorite' : 'station.favorite'));
}

export function renderStationList(host: HTMLElement, i18n: I18n, p: StationListProps): StationListHandle {
  const head = el('div', 'list-head');
  head.append(el('h2', 'list-title', p.title), el('p', 'list-sub', p.subtitle));
  const list = el('ul', p.learn ? 'stations stations--learn' : 'stations');
  const rows = new Map<string, { row: HTMLLIElement; pick: HTMLButtonElement }>();
  const stars = new Map<string, HTMLButtonElement>();
  for (const s of p.stations) {
    const playing = s.id === p.playingId;
    const row = el('li', playing ? 'station is-playing' : 'station');
    const pick = el('button', 'station__pick');
    pick.type = 'button';
    if (playing) pick.setAttribute('aria-current', 'true');
    const text = el('span', 'station__text');
    const tags = el('span', 'station__tags');
    if (p.learn && isTalk(s)) {
      const chip = el('span', 'talk-chip');
      chip.innerHTML = icons.message;
      chip.append(p.learn.talkLabel);
      tags.append(chip);
    }
    tags.append(s.tags.slice(0, 3).join(' · '));
    text.append(el('span', 'station__name', s.name), tags);
    pick.append(tile(s), text);
    pick.addEventListener('click', () => p.onPick(s));
    const star = el('button', 'station__star');
    star.type = 'button';
    star.innerHTML = icons.star;
    if (p.favorites) {
      const fav = p.favorites;
      paintStar(star, i18n, fav.isFavorite(s.id));
      star.addEventListener('click', () => { fav.onToggle(s); paintStar(star, i18n, fav.isFavorite(s.id)); });
    } else {
      star.disabled = true;
      star.setAttribute('aria-label', i18n.t('station.favorite'));
      star.title = i18n.t('common.soon');
    }
    stars.set(s.id, star);
    row.append(pick, star);
    rows.set(s.id, { row, pick });
    list.append(row);
  }
  if (p.learn) host.replaceChildren(head, el('p', 'learn-tip', p.learn.tip), list);
  else host.replaceChildren(head, list);
  let current = p.playingId;
  return {
    refreshFavorites() { if (p.favorites) for (const [id, star] of stars) paintStar(star, i18n, p.favorites.isFavorite(id)); },
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

export interface SavedListProps {
  items: SavedStation[]; playingId: string | null; empty: string;
  sub(item: SavedStation): string; onPick(item: SavedStation): void;
  isFavorite(id: string): boolean; onToggleFavorite(item: SavedStation): void;
  focus?: { id: string; index: number };
}
export interface SavedListHandle { setPlaying(id: string | null): void }

export function renderSavedList(host: HTMLElement, i18n: I18n, p: SavedListProps): SavedListHandle {
  if (!p.items.length) { renderListMessage(host, p.empty); return { setPlaying() {} }; }
  const list = el('ul', 'stations');
  const rows: { id: string; row: HTMLLIElement; pick: HTMLButtonElement; star: HTMLButtonElement }[] = [];
  for (const item of p.items) {
    const row = el('li', item.id === p.playingId ? 'station is-playing' : 'station');
    const pick = el('button', 'station__pick');
    pick.type = 'button';
    if (item.id === p.playingId) pick.setAttribute('aria-current', 'true');
    const text = el('span', 'station__text');
    text.append(el('span', 'station__name', item.name), el('span', 'station__tags', p.sub(item)));
    pick.append(tile(item), text);
    pick.addEventListener('click', () => p.onPick(item));
    const star = el('button', 'station__star');
    star.type = 'button';
    star.innerHTML = icons.star;
    paintStar(star, i18n, p.isFavorite(item.id));
    star.addEventListener('click', () => p.onToggleFavorite(item));
    row.append(pick, star);
    list.append(row);
    rows.push({ id: item.id, row, pick, star });
  }
  host.replaceChildren(list);
  // Keep keyboard focus on the same row (or the same position when that row is gone) after a re-render.
  if (p.focus) (rows.find((r) => r.id === p.focus!.id) ?? rows[Math.min(p.focus.index, rows.length - 1)])?.star.focus();
  return {
    setPlaying(id) {
      for (const r of rows) {
        const on = r.id === id;
        r.row.classList.toggle('is-playing', on);
        if (on) r.pick.setAttribute('aria-current', 'true'); else r.pick.removeAttribute('aria-current');
      }
    },
  };
}
