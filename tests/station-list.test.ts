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
  expect(rows[0].querySelector('.station__tags')!.textContent).toBe('fado · jazz · pop');
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
