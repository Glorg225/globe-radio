import { beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import type { StationLite } from '../src/data/shards';
import { createI18n } from '../src/i18n/i18n';
import { createPlayerBar } from '../src/ui/player-bar';
import { showShareCard } from '../src/ui/share-card';
import { openSleepMenu } from '../src/ui/sleep-menu';

const i18n = createI18n('ru', ru);
const station: StationLite = { id: 'a', name: 'Fado', url: 'https://x', placeId: 'p', cc: 'PT', langs: [], tags: [], votes: 0, clicks: 0, favicon: '', hls: false };
let el: HTMLElement;
beforeEach(() => { document.body.innerHTML = '<footer></footer><main></main>'; el = document.querySelector('footer')!; });
const q = (s: string) => el.querySelector(s) as HTMLButtonElement;

test('player star, share and sleep become active with handlers and a station', () => {
  const h = { onToggle: vi.fn(), onNext: vi.fn(), onVolume: vi.fn(), onMute: vi.fn(), onFavorite: vi.fn(), onShare: vi.fn(), onSleep: vi.fn() };
  const bar = createPlayerBar(el, i18n, h);
  bar.render({ state: { kind: 'idle' }, place: '', volume: 1, muted: false });
  expect(q('.pb__star').disabled).toBe(true);
  expect(q('.pb__share').disabled).toBe(true);
  bar.render({ state: { kind: 'playing', station }, place: 'X', volume: 1, muted: false, favorite: true, sleepLabel: 'Сон · 23 мин' });
  expect(q('.pb__star').disabled).toBe(false);
  expect(q('.pb__star').getAttribute('aria-pressed')).toBe('true');
  expect(q('.pb__sleep').disabled).toBe(false);
  expect(q('.pb__sleep').textContent).toContain('Сон · 23 мин');
  q('.pb__star').click();
  q('.pb__share').click();
  q('.pb__sleep').click();
  expect(h.onFavorite).toHaveBeenCalled();
  expect(h.onShare).toHaveBeenCalled();
  expect(h.onSleep).toHaveBeenCalledWith(q('.pb__sleep'));
  bar.render({ state: { kind: 'playing', station }, place: 'X', volume: 1, muted: false, favorite: false });
  expect(q('.pb__sleep').textContent).toContain('Сон');
  expect(q('.pb__sleep').textContent).not.toContain('мин');
});

test('sleep menu lists options, marks the current one, picks and closes', () => {
  const anchor = document.createElement('button');
  el.append(anchor);
  const onPick = vi.fn();
  openSleepMenu(anchor, i18n, 30, onPick);
  const items = [...document.querySelectorAll('.sleep-menu button')];
  expect(items.map((b) => b.textContent)).toEqual(['15 мин', '30 мин', '60 мин', '90 мин', 'Выкл']);
  expect(items[1].getAttribute('aria-checked')).toBe('true');
  (items[0] as HTMLButtonElement).click();
  expect(onPick).toHaveBeenCalledWith(15);
  expect(document.querySelector('.sleep-menu')).toBeNull();
  openSleepMenu(anchor, i18n, null, onPick);
  ([...document.querySelectorAll('.sleep-menu button')].at(-1) as HTMLButtonElement).click();
  expect(onPick).toHaveBeenLastCalledWith(null);
  openSleepMenu(anchor, i18n, null, onPick);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(document.querySelector('.sleep-menu')).toBeNull();
});

test('share card per mockup: title, name, line, listen and open-globe', () => {
  const host = document.querySelector('main')!;
  const h = { onListen: vi.fn(), onClose: vi.fn() };
  showShareCard(host, i18n, { name: 'Fado <b>Lisboa</b>', flag: '/pt.svg', line: 'Лиссабон, Португалия · 14:32' }, h);
  const card = host.querySelector('.share-card') as HTMLElement;
  expect(card.getAttribute('role')).toBe('dialog');
  expect(card.textContent).toContain('Вам прислали станцию');
  expect(card.querySelector('b')).toBeNull();
  expect(card.textContent).toContain('Fado <b>Lisboa</b>');
  expect(card.textContent).toContain('Лиссабон, Португалия · 14:32');
  expect(card.textContent).toContain('Браузер включает звук только после нажатия');
  expect(document.activeElement).toBe(card.querySelector('.share-card__listen'));
  expect(host.classList.contains('is-dimmed')).toBe(true);
  (card.querySelector('.share-card__listen') as HTMLButtonElement).click();
  expect(h.onListen).toHaveBeenCalled();
  expect(host.querySelector('.share-card')).toBeNull();
  expect(host.classList.contains('is-dimmed')).toBe(false);
  showShareCard(host, i18n, { name: 'X', flag: null, line: '' }, h);
  (host.querySelector('.share-card__globe') as HTMLButtonElement).click();
  expect(h.onClose).toHaveBeenCalled();
  expect(host.querySelector('.share-card')).toBeNull();
});

test('sleep button toggles the menu; mousedown on the button icon does not close it first; old listeners go away', () => {
  const anchor = document.createElement('button');
  const icon = document.createElement('span');
  anchor.append(icon);
  el.append(anchor);
  const onPick = vi.fn();
  openSleepMenu(anchor, i18n, null, onPick);
  icon.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  expect(document.querySelector('.sleep-menu')).not.toBeNull();
  openSleepMenu(anchor, i18n, null, onPick);
  expect(document.querySelector('.sleep-menu')).toBeNull();
  const focus = vi.spyOn(anchor, 'focus');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(focus).not.toHaveBeenCalled();
});

test('mini-player: "more" button opens with a station; sleep line replaces the place line', () => {
  const onMore = vi.fn();
  const bar = createPlayerBar(el, i18n, { onToggle() {}, onNext() {}, onVolume() {}, onMute() {}, onMore });
  bar.render({ state: { kind: 'idle' }, place: '', volume: 1, muted: false });
  expect(q('.pb__more').disabled).toBe(true);
  expect(q('.pb__more').getAttribute('aria-label')).toBe('Ещё: таймер сна, поделиться');
  bar.render({ state: { kind: 'playing', station }, place: 'Лиссабон, Португалия', volume: 1, muted: false, sleepMinutes: 30 });
  q('.pb__more').click();
  expect(onMore).toHaveBeenCalledWith(q('.pb__more'));
  expect(el.classList.contains('has-sleep')).toBe(true);
  expect(el.querySelector('.pb__sleepin')!.textContent).toBe('В эфире · сон через 30 мин');
  bar.render({ state: { kind: 'paused', station }, place: 'X', volume: 1, muted: false, sleepMinutes: 30 });
  expect(el.classList.contains('has-sleep')).toBe(false);
});
