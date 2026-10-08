import { beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import type { StationLite } from '../src/data/shards';
import { createI18n } from '../src/i18n/i18n';
import { renderListMessage, renderStationList } from '../src/ui/station-list';

const i18n = createI18n('ru', ru);
const st = (id: string, name: string, tags: string[] = []): StationLite =>
  ({ id, name, url: 'https://x', placeId: 'p', cc: 'PT', langs: [], tags, votes: 0, clicks: 0, favicon: '', hls: false });
let el: HTMLElement;
beforeEach(() => { document.body.innerHTML = '<div></div>'; el = document.body.firstElementChild as HTMLElement; });

test('renders title, subtitle, names, tags and letter tiles', () => {
  renderStationList(el, i18n, { title: 'Лиссабон', subtitle: 'Португалия · 2 станции · по популярности', stations: [st('a', 'fado Lisboa', ['fado', 'jazz', 'pop', 'rock']), st('b', 'Antena 1')], playingId: null, onPick() {} });
  expect(el.querySelector('.list-title')!.textContent).toBe('Лиссабон');
  expect(el.querySelector('.list-sub')!.textContent).toContain('2 станции');
  const rows = el.querySelectorAll('.station');
  expect(rows).toHaveLength(2);
  // Styles from the dictionary when a station has any; raw tags otherwise.
  expect(rows[0].querySelector('.station__tags')!.textContent).toBe('Pop · Rock · Jazz');
  expect(rows[0].querySelector('.station__tile')!.textContent).toBe('F');
});

test('station data is never parsed as HTML', () => {
  renderStationList(el, i18n, { title: '<i>t</i>', subtitle: '', stations: [st('a', '<img src=x onerror=alert(1)>')], playingId: null, onPick() {} });
  expect(el.querySelector('img')).toBeNull();
  expect(el.querySelector('i')).toBeNull();
  expect(el.querySelector('.station__name')!.textContent).toBe('<img src=x onerror=alert(1)>');
});

test('marks the playing station and reports picks', () => {
  const onPick = vi.fn();
  renderStationList(el, i18n, { title: 'X', subtitle: '', stations: [st('a', 'A'), st('b', 'B')], playingId: 'b', onPick });
  const rows = el.querySelectorAll('.station');
  expect(rows[1].classList.contains('is-playing')).toBe(true);
  expect(rows[1].querySelector('.station__pick')!.getAttribute('aria-current')).toBe('true');
  (rows[0].querySelector('.station__pick') as HTMLButtonElement).click();
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
});

test('favorite star is visible but disabled until Plan 5', () => {
  renderStationList(el, i18n, { title: 'X', subtitle: '', stations: [st('a', 'A')], playingId: null, onPick() {} });
  const star = el.querySelector('.station__star') as HTMLButtonElement;
  expect(star.disabled).toBe(true);
  expect(star.getAttribute('aria-label')).toBe('В избранное');
});

test('message with an action button', () => {
  const onClick = vi.fn();
  renderListMessage(el, 'Не удалось', { label: 'Повторить', onClick });
  expect(el.textContent).toContain('Не удалось');
  (el.querySelector('button') as HTMLButtonElement).click();
  expect(onClick).toHaveBeenCalled();
});

test('setPlaying updates the highlight without rebuilding rows (keeps keyboard focus)', () => {
  const list = renderStationList(el, i18n, { title: 'X', subtitle: '', stations: [st('a', 'A'), st('b', 'B')], playingId: null, onPick() {} });
  const pickA = el.querySelector('.station__pick') as HTMLButtonElement;
  pickA.focus();
  list.setPlaying('a');
  expect(document.activeElement).toBe(pickA);
  expect(el.querySelector('.station.is-playing .station__name')!.textContent).toBe('A');
  list.setPlaying('b');
  expect(pickA.getAttribute('aria-current')).toBeNull();
  expect(el.querySelectorAll('.station.is-playing')).toHaveLength(1);
});

test('learn variant: tip on top, teal list, "речь" chip only on talk/news stations', () => {
  renderStationList(el, i18n, {
    title: 'Мадрид', subtitle: 'Испания · 2 станции на испанском',
    stations: [st('a', 'Charla Madrid', ['talk', 'spanish']), st('b', 'Radio Gran Vía', ['pop'])],
    playingId: null, onPick() {},
    learn: { tip: 'Совет: выбирайте разговорные…', talkLabel: 'речь' },
  });
  expect(el.querySelector('.learn-tip')!.textContent).toBe('Совет: выбирайте разговорные…');
  expect(el.querySelector('.stations')!.classList.contains('stations--learn')).toBe(true);
  const rows = el.querySelectorAll('.station');
  expect(rows[0].querySelector('.talk-chip')!.textContent).toBe('речь');
  expect(rows[1].querySelector('.talk-chip')).toBeNull();
  expect(rows[0].querySelector('.station__tags')!.textContent).toContain('Talk');
});

test('active stars when favorites are wired: pressed state, toggle, refresh', () => {
  const favs = new Set(['b']);
  const onToggle = vi.fn((s: StationLite) => { if (favs.has(s.id)) favs.delete(s.id); else favs.add(s.id); });
  const list = renderStationList(el, i18n, {
    title: 'X', subtitle: '', stations: [st('a', 'A'), st('b', 'B')], playingId: null, onPick() {},
    favorites: { isFavorite: (id) => favs.has(id), onToggle },
  });
  const stars = [...el.querySelectorAll('.station__star')] as HTMLButtonElement[];
  expect(stars[0].disabled).toBe(false);
  expect(stars[1].getAttribute('aria-pressed')).toBe('true');
  expect(stars[1].getAttribute('aria-label')).toBe('Убрать из избранного');
  stars[0].click();
  expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  list.refreshFavorites();
  expect(stars[0].getAttribute('aria-pressed')).toBe('true');
});

test('saved list: rows with place subtitle, empty message, pick and unstar', async () => {
  const { renderSavedList } = await import('../src/ui/station-list');
  const onPick = vi.fn();
  const onToggleFavorite = vi.fn();
  const item = { id: 'a', name: 'Fado', placeId: 'c:1', cc: 'PT', favicon: '' };
  renderSavedList(el, i18n, { items: [item], playingId: 'a', empty: 'Пусто', sub: () => 'Лиссабон, Португалия', onPick, isFavorite: () => true, onToggleFavorite });
  expect(el.querySelector('.station__name')!.textContent).toBe('Fado');
  expect(el.querySelector('.station__tags')!.textContent).toBe('Лиссабон, Португалия');
  expect(el.querySelector('.station.is-playing')).not.toBeNull();
  (el.querySelector('.station__pick') as HTMLButtonElement).click();
  (el.querySelector('.station__star') as HTMLButtonElement).click();
  expect(onPick).toHaveBeenCalledWith(item);
  expect(onToggleFavorite).toHaveBeenCalledWith(item);
  renderSavedList(el, i18n, { items: [], playingId: null, empty: 'Пусто', sub: () => '', onPick, isFavorite: () => false, onToggleFavorite });
  expect(el.textContent).toBe('Пусто');
});

test('saved list keeps focus on the starred row, or the same position when the row is gone; highlight moves', async () => {
  const { renderSavedList } = await import('../src/ui/station-list');
  const item = (id: string) => ({ id, name: id, placeId: 'c:1', cc: 'PT', favicon: '' });
  const base = { playingId: 'a', empty: 'Пусто', sub: () => '', onPick() {}, isFavorite: () => true, onToggleFavorite() {} };
  renderSavedList(el, i18n, { ...base, items: [item('a'), item('b')], focus: { id: 'b', index: 1 } });
  expect(document.activeElement).toBe(el.querySelectorAll('.station__star')[1]);
  const h = renderSavedList(el, i18n, { ...base, items: [item('a'), item('c')], focus: { id: 'b', index: 1 } });
  expect(document.activeElement).toBe(el.querySelectorAll('.station__star')[1]);
  h.setPlaying('c');
  expect(el.querySelectorAll('.station')[1].classList.contains('is-playing')).toBe(true);
  expect(el.querySelectorAll('.station')[0].classList.contains('is-playing')).toBe(false);
});

test('a close button in the header clears the selection; none without onClose', () => {
  const onClose = vi.fn();
  renderStationList(el, i18n, { title: 'X', subtitle: '', stations: [st('a', 'A')], playingId: null, onPick() {}, onClose });
  const btn = el.querySelector<HTMLButtonElement>('.list-head .list-close')!;
  expect(btn.getAttribute('aria-label')).toBe('Сбросить выбор');
  btn.click();
  expect(onClose).toHaveBeenCalledOnce();
  renderStationList(el, i18n, { title: 'X', subtitle: '', stations: [], playingId: null, onPick() {} });
  expect(el.querySelector('.list-close')).toBeNull();
});

test('a message for a selected place can carry the close button too', () => {
  const onClose = vi.fn();
  renderListMessage(el, 'Нет станций', { label: 'Показать все', onClick() {} }, { label: 'Сбросить выбор', onClick: onClose });
  el.querySelector<HTMLButtonElement>('.list-close')!.click();
  expect(onClose).toHaveBeenCalledOnce();
  expect(el.querySelector('.panel-empty')!.textContent).toBe('Нет станций');
  renderListMessage(el, 'Пусто');
  expect(el.querySelector('.list-close')).toBeNull();
});
