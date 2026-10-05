import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import type { Place } from '../src/data/places';
import type { PlaceInfo, StationLite } from '../src/data/shards';
import { createI18n } from '../src/i18n/i18n';
import { COLLAPSE_KEY, createPlaceCard, type PlaceCardDeps } from '../src/place-card/place-card';
import type { WikiResult } from '../src/place-card/wiki';

const i18n = createI18n('ru', ru);
const lisbon: Place = { id: 'c:1', lat: 38.7, lon: -9.1, kind: 'exact', cc: 'PT', nameRu: 'Лиссабон', name: 'Lisbon', count: 12, pop: 1 };
const country: Place = { ...lisbon, id: 'k:PT', kind: 'country' };
const st = (langs: string[] = ['pt']): StationLite =>
  ({ id: 's', name: 'Fado', url: 'https://x', placeId: 'c:1', cc: 'PT', langs, tags: [], votes: 0, clicks: 0, favicon: '', hls: false });
const info: PlaceInfo = { tz: 'Europe/Lisbon', wikiRu: 'Лиссабон', wikiEn: 'Lisbon' };
const wiki = (text: string, lang: 'ru' | 'en' = 'ru'): WikiResult =>
  ({ summary: { lang, title: 'T', text, image: 'https://upload.wikimedia.org/p.jpg', url: 'https://ru.wikipedia.org/wiki/T' }, link: 'https://ru.wikipedia.org/wiki/T' });

class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } }

let panel: HTMLElement;
let stage: HTMLElement;
let deps: PlaceCardDeps;
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 0, 15, 14, 32, 30)));
  document.body.innerHTML = '<aside class="shell__place"></aside><main></main>';
  panel = document.querySelector('aside')!;
  stage = document.querySelector('main')!;
  deps = {
    i18n,
    storage: new Mem() as unknown as Storage,
    flagUrl: (cc) => (cc === 'PT' ? '/flags/pt.svg' : null),
    findArticle: vi.fn(async () => wiki('Лиссабон — столица Португалии.')),
    now: () => new Date(),
    userOffset: () => 180,
  };
});
afterEach(() => vi.useRealTimers());
const q = (s: string) => panel.querySelector(s) as HTMLElement;

test('empty state before anything plays', () => {
  createPlaceCard(panel, stage, deps).show(null);
  expect(panel.textContent).toContain('Карточка места появится');
  expect(q('.pc__content').hidden).toBe(true);
});

test('city card: flag, title, country, time, difference, language, disabled learn button, wiki', async () => {
  createPlaceCard(panel, stage, deps).show({ place: lisbon, station: st(['pt']), info });
  await flush();
  expect((q('.pc__flag') as HTMLImageElement).src).toContain('/flags/pt.svg');
  expect(q('.pc__name').textContent).toBe('Лиссабон');
  expect(q('.pc__country').textContent).toBe('Португалия');
  expect(q('.pc__clock').textContent).toBe('14:32');
  expect(q('.pc__diff').textContent).toBe('на 3 ч раньше вас');
  expect(q('.pc__langs').textContent).toBe('португальский');
  const learn = q('.pc__learn') as HTMLButtonElement;
  expect(learn.hidden).toBe(false);
  expect(learn.disabled).toBe(false);
  expect(q('.pc__text').textContent).toBe('Лиссабон — столица Португалии.');
  expect((q('.pc__link') as HTMLAnchorElement).href).toBe('https://ru.wikipedia.org/wiki/T');
  expect(q('.pc__link').textContent).toContain('Читать в Википедии');
  expect(q('.pc__note').hidden).toBe(true);
});

test('country card says the location is approximate', () => {
  createPlaceCard(panel, stage, deps).show({ place: country, station: st(), info });
  expect(q('.pc__name').textContent).toBe('Португалия');
  expect(q('.pc__country').textContent).toBe('Примерное расположение станций');
});

test('missing place info: no time tile, no wiki, flag/title/language still shown (review focus 5)', async () => {
  createPlaceCard(panel, stage, deps).show({ place: lisbon, station: st([]), info: null });
  await flush();
  expect(q('.pc__time').hidden).toBe(true);
  expect(q('.pc__wiki').hidden).toBe(true);
  expect(q('.pc__langs').textContent).toBe('Язык не указан');
  expect(deps.findArticle).not.toHaveBeenCalled();
});

test('unknown timezone hides the time tile; unknown flag hides the flag', () => {
  createPlaceCard(panel, stage, deps).show({ place: { ...lisbon, cc: 'QQ' }, station: st(), info: { ...info, tz: 'Mars/Olympus' } });
  expect(q('.pc__time').hidden).toBe(true);
  expect(q('.pc__flag').hidden).toBe(true);
});

test('English article gets a note; link-only result shows "Подробнее"; nothing hides the block', async () => {
  const card = createPlaceCard(panel, stage, deps);
  deps.findArticle = vi.fn(async () => wiki('A town.', 'en'));
  card.show({ place: lisbon, station: st(), info });
  await flush();
  expect(q('.pc__note').hidden).toBe(false);
  expect(q('.pc__note').textContent).toBe('Статья на английском');
  deps.findArticle = vi.fn(async () => ({ summary: null, link: 'https://ru.wikipedia.org/wiki/X' }));
  card.show({ place: { ...lisbon, id: 'c:2' }, station: st(), info });
  await flush();
  expect(q('.pc__text').hidden).toBe(true);
  expect(q('.pc__link').textContent).toContain('Подробнее в Википедии');
  deps.findArticle = vi.fn(async () => ({ summary: null, link: null }));
  card.show({ place: { ...lisbon, id: 'c:3' }, station: st(), info });
  await flush();
  expect(q('.pc__wiki').hidden).toBe(true);
});

test('Wikipedia text with markup is shown as text (review focus 2)', async () => {
  deps.findArticle = vi.fn(async () => wiki('<img src=x onerror=alert(1)> текст'));
  createPlaceCard(panel, stage, deps).show({ place: lisbon, station: st(), info });
  await flush();
  expect(panel.querySelector('.pc__text img')).toBeNull();
  expect(q('.pc__text').textContent).toBe('<img src=x onerror=alert(1)> текст');
});

test('a late answer for a previous place is dropped (review focus 1)', async () => {
  let releaseA!: (r: WikiResult) => void;
  deps.findArticle = vi.fn((i: PlaceInfo) => (i.wikiRu === 'A' ? new Promise<WikiResult>((r) => { releaseA = r; }) : Promise.resolve(wiki('B text'))));
  const card = createPlaceCard(panel, stage, deps);
  card.show({ place: lisbon, station: st(), info: { ...info, wikiRu: 'A' } });
  card.show({ place: { ...lisbon, id: 'c:2', nameRu: 'Порту' }, station: st(), info: { ...info, wikiRu: 'B' } });
  await flush();
  releaseA(wiki('A text'));
  await flush();
  expect(q('.pc__name').textContent).toBe('Порту');
  expect(q('.pc__text').textContent).toBe('B text');
});

test('same place again (pause/resume) does not refetch; new station updates language only', async () => {
  const card = createPlaceCard(panel, stage, deps);
  card.show({ place: lisbon, station: st(['pt']), info });
  await flush();
  card.show({ place: lisbon, station: { ...st(['en']), id: 's2' }, info });
  await flush();
  expect(deps.findArticle).toHaveBeenCalledTimes(1);
  expect(q('.pc__langs').textContent).toBe('английский');
});

test('clock ticks on the minute boundary', async () => {
  createPlaceCard(panel, stage, deps).show({ place: lisbon, station: st(), info });
  expect(q('.pc__clock').textContent).toBe('14:32');
  await vi.advanceTimersByTimeAsync(30_000);
  expect(q('.pc__clock').textContent).toBe('14:33');
  await vi.advanceTimersByTimeAsync(60_000);
  expect(q('.pc__clock').textContent).toBe('14:34');
});

test('collapse toggles the panel, swaps the label and is remembered', () => {
  createPlaceCard(panel, stage, deps).show(null);
  const btn = q('.pc__collapse') as HTMLButtonElement;
  expect(btn.getAttribute('aria-label')).toBe('Свернуть');
  btn.click();
  expect(panel.classList.contains('is-collapsed')).toBe(true);
  expect(btn.getAttribute('aria-label')).toBe('Развернуть карточку');
  expect(deps.storage!.getItem(COLLAPSE_KEY)).toBe('1');
  document.body.innerHTML = '<aside class="shell__place"></aside><main></main>';
  panel = document.querySelector('aside')!;
  createPlaceCard(panel, document.querySelector('main')!, deps);
  expect(panel.classList.contains('is-collapsed')).toBe(true);
});

test('phone sheet mirrors the card and hides when nothing plays', async () => {
  const card = createPlaceCard(panel, stage, deps);
  const sheet = stage.querySelector('.pc-sheet') as HTMLElement;
  card.show(null);
  expect(sheet.hidden).toBe(true);
  card.show({ place: lisbon, station: st(['pt']), info });
  await flush();
  expect(sheet.hidden).toBe(false);
  expect(sheet.querySelector('.pcs__name')!.textContent).toBe('Лиссабон');
  expect(sheet.querySelector('.pcs__meta')!.textContent).toBe('Португалия · португальский');
  expect(sheet.querySelector('.pcs__clock')!.textContent).toBe('14:32');
  expect(sheet.querySelector('.pcs__text')!.textContent).toBe('Лиссабон — столица Португалии.');
  expect(sheet.querySelector('.pcs__link')!.textContent).toContain('Подробнее в Википедии');
});

test('"Учить этот язык" turns the learn mode on with the station language', () => {
  const card = createPlaceCard(panel, stage, deps);
  const onLearn = vi.fn();
  card.setLearn(null, onLearn);
  card.show({ place: lisbon, station: st(['pt', 'en']), info });
  (q('.pc__learn') as HTMLButtonElement).click();
  expect(onLearn).toHaveBeenCalledWith('pt');
});

test('language tile turns teal and says "совпадает с выбранным" when it matches the learn mode', () => {
  const card = createPlaceCard(panel, stage, deps);
  card.show({ place: lisbon, station: st(['pt']), info });
  card.setLearn('pt', vi.fn());
  expect(q('.pc__langtile').classList.contains('is-match')).toBe(true);
  expect(q('.pc__match').hidden).toBe(false);
  expect(q('.pc__match').textContent).toBe('совпадает с выбранным');
  expect(q('.pc__learn').hidden).toBe(true);
  card.setLearn('es', vi.fn());
  expect(q('.pc__langtile').classList.contains('is-match')).toBe(false);
  expect(q('.pc__learn').hidden).toBe(false);
});

test('no recognised station language → no learn button (review focus 5)', () => {
  const card = createPlaceCard(panel, stage, deps);
  card.setLearn(null, vi.fn());
  card.show({ place: lisbon, station: st([]), info });
  expect(q('.pc__learn').hidden).toBe(true);
  card.show({ place: { ...lisbon, id: 'c:9' }, station: st(['zz']), info });
  expect(q('.pc__learn').hidden).toBe(true);
});

test('phone sheet: swipe down hides it; the next station shows it again', async () => {
  const card = createPlaceCard(panel, stage, deps);
  card.show({ place: lisbon, station: st(), info });
  await flush();
  const sheet = stage.querySelector('.pc-sheet') as HTMLElement;
  const handle = sheet.querySelector('.pcs__handle') as HTMLElement;
  expect(handle.getAttribute('role')).toBe('button');
  handle.dispatchEvent(new MouseEvent('pointerdown', { clientY: 300, bubbles: true }));
  document.dispatchEvent(new MouseEvent('pointerup', { clientY: 400, bubbles: true }));
  expect(sheet.hidden).toBe(true);
  card.show({ place: lisbon, station: { ...st(), id: 's2' }, info });
  expect(sheet.hidden).toBe(false);
});
