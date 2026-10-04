import { beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import type { StationLite } from '../src/data/shards';
import { createI18n } from '../src/i18n/i18n';
import { createPlayerBar } from '../src/ui/player-bar';

const i18n = createI18n('ru', ru);
const station: StationLite = { id: 'a', name: 'Fado <b>Lisboa</b>', url: 'https://x', placeId: 'p', cc: 'PT', langs: [], tags: [], votes: 0, clicks: 0, favicon: '', hls: false };
const h = { onToggle: vi.fn(), onNext: vi.fn(), onVolume: vi.fn(), onMute: vi.fn() };
let el: HTMLElement;
beforeEach(() => { document.body.innerHTML = '<footer></footer>'; el = document.querySelector('footer')!; vi.clearAllMocks(); });
const q = (s: string) => el.querySelector(s) as HTMLElement;

test('idle: placeholder text, controls disabled', () => {
  createPlayerBar(el, i18n, h).render({ state: { kind: 'idle' }, place: '', volume: 0.8, muted: false });
  expect(q('.pb__name').textContent).toBe('Ничего не играет');
  expect((q('.pb__play') as HTMLButtonElement).disabled).toBe(true);
  expect((q('.pb__next') as HTMLButtonElement).disabled).toBe(true);
  expect((q('.pb__range') as HTMLInputElement).value).toBe('80');
});

test('playing: live line with place, pause label, name as text', () => {
  createPlayerBar(el, i18n, h).render({ state: { kind: 'playing', station }, place: 'Лиссабон, Португалия', volume: 1, muted: false });
  expect(q('.pb__name').textContent).toBe('Fado <b>Lisboa</b>');
  expect(el.querySelector('b')).toBeNull();
  expect(q('.pb__status').textContent).toBe('В эфире · Лиссабон, Португалия');
  expect(q('.pb__live').hidden).toBe(false);
  expect(q('.pb__play').getAttribute('aria-label')).toBe('Пауза');
  expect(q('.pb__next').textContent).toBe('Следующая рядом');
});

test('error: message and "try next nearby" button', () => {
  createPlayerBar(el, i18n, h).render({ state: { kind: 'error', station }, place: 'X', volume: 1, muted: false });
  expect(q('.pb__status').textContent).toBe('Станция не отвечает');
  expect(q('.pb__live').hidden).toBe(true);
  expect(q('.pb__next').textContent).toBe('Попробовать следующую рядом');
  expect(q('.pb__play').getAttribute('aria-label')).toBe('Слушать');
});

test('controls call handlers', () => {
  createPlayerBar(el, i18n, h).render({ state: { kind: 'paused', station }, place: 'X', volume: 1, muted: true });
  (q('.pb__play') as HTMLButtonElement).click();
  (q('.pb__next') as HTMLButtonElement).click();
  (q('.pb__mute') as HTMLButtonElement).click();
  const range = q('.pb__range') as HTMLInputElement;
  range.value = '40';
  range.dispatchEvent(new Event('input'));
  expect(h.onToggle).toHaveBeenCalled();
  expect(h.onNext).toHaveBeenCalled();
  expect(h.onMute).toHaveBeenCalled();
  expect(h.onVolume).toHaveBeenCalledWith(0.4);
  expect(q('.pb__mute').getAttribute('aria-label')).toBe('Включить звук');
});

test('sleep and share are visible but disabled until Plan 5', () => {
  createPlayerBar(el, i18n, h).render({ state: { kind: 'idle' }, place: '', volume: 1, muted: false });
  expect((q('.pb__sleep') as HTMLButtonElement).disabled).toBe(true);
  expect((q('.pb__share') as HTMLButtonElement).disabled).toBe(true);
});
