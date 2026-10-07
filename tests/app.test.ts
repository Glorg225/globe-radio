import { beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import { startApp, type AppDeps } from '../src/app/app';
import type { Place } from '../src/data/places';
import type { PlaceInfo, ShardStore, StationLite } from '../src/data/shards';
import { createI18n } from '../src/i18n/i18n';
import type { MapCallbacks, MapFactory, MapView } from '../src/map/map-view';
import type { Player, PlayerState } from '../src/player/player';
import { renderShell } from '../src/ui/shell';
import { createLibrary } from '../src/library/library';
import type { SearchResult } from '../src/search/search-index';

const i18n = createI18n('ru', ru);
const lisbon: Place = { id: 'c:1', lat: 38.7, lon: -9.1, kind: 'exact', cc: 'PT', nameRu: 'Лиссабон', name: 'Lisbon', count: 2, pop: 10, langs: { pt: 1, en: 1 } };
const porto: Place = { id: 'c:2', lat: 41.1, lon: -8.6, kind: 'exact', cc: 'PT', nameRu: 'Порту', name: 'Porto', count: 1, pop: 5, langs: { pt: 1 } };
const st = (id: string, placeId: string, clicks = 1, langs: string[] = ['pt']): StationLite =>
  ({ id, name: `Radio ${id}`, url: 'https://x', placeId, cc: 'PT', langs, tags: [], votes: 0, clicks, favicon: '', hls: false });
const pt = [st('a', 'c:1', 9, ['pt']), st('b', 'c:1', 3, ['en']), st('p', 'c:2', 1, ['pt'])];

class Mem {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

function fakeFactory() {
  const views: (MapView & { setPlaying: ReturnType<typeof vi.fn>; flyTo: ReturnType<typeof vi.fn>; refresh: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> })[] = [];
  let cb!: MapCallbacks;
  const factory: MapFactory = async (_el, _c, callbacks) => {
    cb = callbacks;
    const v = { setPlaying: vi.fn(), flyTo: vi.fn(), zoomBy: vi.fn(), refresh: vi.fn(), destroy: vi.fn() };
    views.push(v);
    return v;
  };
  return { factory, views, cb: () => cb };
}

function fakePlayer() {
  let state: PlayerState = { kind: 'idle' };
  const ls = new Set<(s: PlayerState) => void>();
  const set = (s: PlayerState) => { state = s; ls.forEach((l) => l(s)); };
  const p: Player & { set: typeof set } = {
    set,
    play: vi.fn(async (s: StationLite) => set({ kind: 'loading', station: s })),
    pause: vi.fn(), toggle: vi.fn(), setVolume: vi.fn(), setMuted: vi.fn(), setGain: vi.fn(),
    getState: () => state,
    subscribe: (l) => { ls.add(l); return () => { ls.delete(l); }; },
  };
  return p;
}

let deps: AppDeps;
let globe: ReturnType<typeof fakeFactory>;
let map: ReturnType<typeof fakeFactory>;
let player: ReturnType<typeof fakePlayer>;
let shards: ShardStore & { get: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  globe = fakeFactory();
  map = fakeFactory();
  player = fakePlayer();
  shards = { get: vi.fn(async () => pt), info: vi.fn(async () => new Map([['c:1', { tz: 'Europe/Lisbon', wikiRu: 'Лиссабон', wikiEn: 'Lisbon' }]])) };
  deps = {
    refs: renderShell(document.getElementById('app')!, i18n),
    i18n,
    storage: new Mem() as unknown as Storage,
    loadPlaces: async () => [lisbon, porto],
    shards,
    factories: { globe: globe.factory, map: map.factory },
    player,
    blacklist: { add: vi.fn(), has: () => false },
    hasWebGL: true,
    narrowTouch: false,
    measureFps: async () => 60,
    card: { show: vi.fn(), setLearn: vi.fn() },
    library: createLibrary(null),
    sleep: { start: vi.fn(), cancel: vi.fn(), minutesLeft: () => null, subscribe: () => () => {} },
    share: vi.fn(async () => 'copied' as const),
    createSearch: () => ({ search: vi.fn(async (): Promise<SearchResult> => ({ places: [porto], stations: [{ name: 'Radio a', place: lisbon }] })) }),
    location: { href: 'https://u.github.io/globe-radio/', search: '' },
    replaceUrl: vi.fn(),
    flagUrl: () => null,
    now: () => new Date(Date.UTC(2026, 0, 15, 14, 32)),
  };
});

const flush = () => new Promise((r) => setTimeout(r, 0));

test('loads places and mounts the globe by default', async () => {
  const app = await startApp(deps);
  expect(app.mode()).toBe('globe');
  expect(globe.views).toHaveLength(1);
  expect(deps.refs.status.textContent).toBe('');
  expect(deps.refs.viewButtons[0].getAttribute('aria-pressed')).toBe('true');
});

test('no WebGL → flat map', async () => {
  const app = await startApp({ ...deps, hasWebGL: false });
  expect(app.mode()).toBe('map');
  expect(globe.views).toHaveLength(0);
});

test('view toggle switches, destroys the old view and remembers the choice', async () => {
  const app = await startApp(deps);
  deps.refs.viewButtons[1].click();
  await flush();
  expect(app.mode()).toBe('map');
  expect(globe.views[0].destroy).toHaveBeenCalled();
  expect(deps.storage!.getItem('mapMode')).toBe('map');
  expect(deps.refs.viewButtons[1].getAttribute('aria-pressed')).toBe('true');
});

test('selecting a place lists its stations; picking one plays it and marks the place', async () => {
  await startApp(deps);
  await globe.cb().onSelect(lisbon);
  await flush();
  const body = deps.refs.panelBody;
  expect(body.querySelector('.list-title')!.textContent).toBe('Лиссабон');
  expect(body.querySelector('.list-sub')!.textContent).toBe('Португалия · 2 станции · по популярности');
  const names = [...body.querySelectorAll('.station__name')].map((n) => n.textContent);
  expect(names).toEqual(['Radio a', 'Radio b']);
  (body.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(player.play).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  expect(globe.views[0].setPlaying).toHaveBeenLastCalledWith(lisbon);
  expect(deps.refs.player.querySelector('.pb__name')!.textContent).toBe('Radio a');
  expect(body.querySelector('.station.is-playing .station__name')!.textContent).toBe('Radio a');
});

test('country place uses the approximate subtitle', async () => {
  const country: Place = { ...lisbon, id: 'k:PT', kind: 'country' };
  shards.get.mockResolvedValueOnce([st('z', 'k:PT')]);
  const app = await startApp(deps);
  await app.selectPlace(country);
  expect(deps.refs.panelBody.querySelector('.list-title')!.textContent).toBe('Португалия');
  expect(deps.refs.panelBody.querySelector('.list-sub')!.textContent).toBe('Примерное расположение · 1 станция · по популярности');
});

test('shard failure shows retry that reloads', async () => {
  shards.get.mockRejectedValueOnce(new Error('net'));
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  const body = deps.refs.panelBody;
  expect(body.textContent).toContain('Не удалось загрузить станции этого места');
  (body.querySelector('button') as HTMLButtonElement).click();
  await flush();
  expect(body.querySelectorAll('.station')).toHaveLength(2);
});

test('low FPS on the globe switches to the flat map with a notice', async () => {
  const app = await startApp({ ...deps, measureFps: async () => 12 });
  await flush();
  expect(app.mode()).toBe('map');
  expect(deps.refs.stage.textContent).toContain('Включена плоская карта');
  expect(deps.storage!.getItem('mapMode')).toBeNull();
});

test('globe that fails to start falls back to the flat map', async () => {
  const app = await startApp({ ...deps, factories: { globe: async () => { throw new Error('webgl'); }, map: map.factory } });
  expect(app.mode()).toBe('map');
  expect(deps.refs.stage.textContent).toContain('Включена плоская карта');
});

test('places load failure shows an error status', async () => {
  await startApp({ ...deps, loadPlaces: async () => { throw new Error('net'); } });
  expect(deps.refs.status.textContent).toContain('Не удалось загрузить станции');
});

test('storage that throws does not break startup (review focus 4)', async () => {
  const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
  const app = await startApp({ ...deps, storage: bad });
  deps.refs.viewButtons[1].click();
  await flush();
  expect(app.mode()).toBe('map');
});

test('next nearby plays the next station; with none left a notice appears', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  await app.next();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }));
  deps.blacklist.has = () => true;
  await app.next();
  expect(deps.refs.stage.textContent).toContain('Рядом больше нет рабочих станций');
});

test('next nearby in another place flies there', async () => {
  const app = await startApp({ ...deps, blacklist: { add: vi.fn(), has: (id) => id === 'b' } });
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  await app.next();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'p' }));
  expect(globe.views[0].flyTo).toHaveBeenCalledWith(porto.lat, porto.lon);
});

test('Space toggles playback unless typing in a field', async () => {
  await startApp(deps);
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  expect(player.toggle).toHaveBeenCalledTimes(1);
  const input = deps.refs.header.querySelector('input')!;
  input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  expect(player.toggle).toHaveBeenCalledTimes(1);
});

test('volume is restored from storage and saved on change', async () => {
  deps.storage!.setItem('volume', '0.3');
  await startApp(deps);
  expect(player.setVolume).toHaveBeenCalledWith(0.3);
  const range = deps.refs.player.querySelector('.pb__range') as HTMLInputElement;
  range.value = '55';
  range.dispatchEvent(new Event('input'));
  expect(deps.storage!.getItem('volume')).toBe('0.55');
});

test('tooltip label for places and clusters', async () => {
  await startApp(deps);
  const label = globe.cb().label;
  expect(label({ type: 'place', key: 'c:1', place: lisbon, lat: 0, lon: 0, count: 12, pop: 1 })).toBe('Лиссабон · 12 станций');
  expect(label({ type: 'cluster', key: 'cl:1', lat: 0, lon: 0, count: 2427, pop: 1, zoomTo: 3 })).toBe('2 427 станций');
});

test('rapid view toggles keep only the last view mounted', async () => {
  const pending: ((v: MapView) => void)[] = [];
  const made: (MapView & { destroy: ReturnType<typeof vi.fn> })[] = [];
  const slow: MapFactory = () => new Promise((resolve) => {
    const v = { setPlaying: vi.fn(), flyTo: vi.fn(), zoomBy: vi.fn(), refresh: vi.fn(), destroy: vi.fn() };
    made.push(v);
    pending.push(resolve);
  });
  const app = startApp({ ...deps, factories: { globe: slow, map: slow } });
  await flush();
  pending.shift()!(made[0]);
  await app;
  deps.refs.viewButtons[1].click();
  deps.refs.viewButtons[0].click();
  deps.refs.viewButtons[1].click();
  await flush();
  while (pending.length) pending.shift()!(made[made.length - pending.length - 1]);
  await flush();
  const alive = made.filter((v) => !v.destroy.mock.calls.length);
  expect(alive).toHaveLength(1);
  expect(alive[0]).toBe(made[made.length - 1]);
  expect((await app).mode()).toBe('map');
});

test('keyboard focus stays on the picked row while the player changes state', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  const pick = deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement;
  pick.focus();
  pick.click();
  await flush();
  player.set({ kind: 'playing', station: pt[0] });
  await flush();
  expect(document.activeElement).toBe(pick);
  expect(deps.refs.panelBody.querySelector('.station.is-playing .station__name')!.textContent).toBe('Radio a');
});

test('the place card follows the playing station, not the browsed list', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.card.show).toHaveBeenLastCalledWith({ place: lisbon, station: expect.objectContaining({ id: 'a' }), info: { tz: 'Europe/Lisbon', wikiRu: 'Лиссабон', wikiEn: 'Lisbon' } });
  const calls = (deps.card.show as ReturnType<typeof vi.fn>).mock.calls.length;
  await app.selectPlace(porto);
  await flush();
  expect((deps.card.show as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
});

test('card shows nothing while idle and gets null info when the country file has none (review focus 5)', async () => {
  shards.info.mockResolvedValue(new Map());
  const app = await startApp(deps);
  expect(deps.card.show).toHaveBeenLastCalledWith(null);
  await app.selectPlace(porto);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.card.show).toHaveBeenLastCalledWith(expect.objectContaining({ place: porto, info: null }));
});

test('a slow place-info answer for a previous station never overwrites the current card (review focus 1)', async () => {
  let releaseFirst!: (m: Map<string, PlaceInfo>) => void;
  shards.info.mockImplementationOnce(() => new Promise((r) => { releaseFirst = r; }));
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  await app.selectPlace(porto);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  releaseFirst(new Map());
  await flush();
  expect(deps.card.show).toHaveBeenLastCalledWith(expect.objectContaining({ place: porto }));
});

test('learn mode filters the list, shows the tip and the language subtitle', async () => {
  const app = await startApp(deps);
  app.learn('pt');
  await app.selectPlace(lisbon);
  const body = deps.refs.panelBody;
  expect([...body.querySelectorAll('.station__name')].map((n) => n.textContent)).toEqual(['Radio a']);
  expect(body.querySelector('.list-sub')!.textContent).toBe('Португалия · 1 станция на португальском');
  expect(body.querySelector('.learn-tip')).not.toBeNull();
  expect(deps.refs.banner.hidden).toBe(false);
  expect(deps.refs.learnButton.textContent).toContain('Учу язык: португальский');
});

test('switching the language with an open list and a playing station re-filters without stopping (review focus 1)', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  const plays = (player.play as ReturnType<typeof vi.fn>).mock.calls.length;
  app.learn('en');
  await flush();
  expect([...deps.refs.panelBody.querySelectorAll('.station__name')].map((n) => n.textContent)).toEqual(['Radio b']);
  expect((player.play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(plays);
  expect(player.pause).not.toHaveBeenCalled();
  expect(deps.refs.player.querySelector('.pb__next')!.textContent).toBe('Следующая на английском');
  expect(globe.views[0].refresh).toHaveBeenCalled();
  expect(deps.card.setLearn).toHaveBeenLastCalledWith('en', expect.any(Function));
});

test('a place without stations in the language offers to show all of them', async () => {
  const app = await startApp(deps);
  app.learn('en');
  await app.selectPlace(porto);
  const body = deps.refs.panelBody;
  expect(body.textContent).toContain('Здесь нет станций на английском');
  (body.querySelector('button') as HTMLButtonElement).click();
  await flush();
  expect([...body.querySelectorAll('.station__name')].map((n) => n.textContent)).toEqual(['Radio p']);
});

test('"Следующая на …" only picks stations in the language (review focus 3)', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  app.learn('pt');
  await app.next();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'p' }));
});

test('no next station in the language → language-specific notice', async () => {
  const app = await startApp({ ...deps, blacklist: { add: vi.fn(), has: (id) => id === 'p' } });
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  app.learn('pt');
  await app.next();
  expect(deps.refs.stage.textContent).toContain('Рядом больше нет станций на португальском');
});

test('the card can switch the learn mode on; turning off restores the normal view', async () => {
  const app = await startApp(deps);
  const onLearn = (deps.card.setLearn as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1] as (c: string) => void;
  onLearn('pt');
  expect(deps.refs.banner.hidden).toBe(false);
  (deps.refs.banner.querySelector('button') as HTMLButtonElement).click();
  expect(deps.refs.banner.hidden).toBe(true);
  expect(deps.refs.learnButton.classList.contains('is-learning')).toBe(false);
  app.learn(null);
});

test('learn language is restored from storage at start; unknown one is dropped', async () => {
  deps.storage!.setItem('learnLang', 'pt');
  await startApp(deps);
  expect(deps.refs.banner.hidden).toBe(false);
  deps.storage!.setItem('learnLang', 'tlh');
  document.body.innerHTML = '<div id="app"></div>';
  const refs = renderShell(document.getElementById('app')!, i18n);
  await startApp({ ...deps, refs });
  expect(refs.banner.hidden).toBe(true);
});

test('teal map items get language tooltips', async () => {
  const app = await startApp(deps);
  app.learn('pt');
  const label = globe.cb().label;
  expect(label({ type: 'place', key: 'c:1', place: lisbon, lat: 0, lon: 0, count: 1, pop: 1, tone: 'teal' })).toBe('Лиссабон · 1 станция на португальском');
  expect(label({ type: 'cluster', key: 'cl:1', lat: 0, lon: 0, count: 12, pop: 1, zoomTo: 3, tone: 'teal' })).toBe('12 станций на португальском');
  expect(label({ type: 'place', key: 'c:1', place: lisbon, lat: 0, lon: 0, count: 2, pop: 1, tone: 'muted' })).toBe('Лиссабон · 2 станции');
});

test('"Следующая" moves on instead of bouncing between the two most popular stations', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  await app.next();
  await app.next();
  const ids = (player.play as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as StationLite).id);
  expect(ids).toEqual(['a', 'b', 'p']);
  await app.next();
  expect((player.play as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0]).toMatchObject({ id: 'a' });
});

test('"Следующая на …" finds the language far away, beyond the 60 nearest places (review)', async () => {
  const filler: Place[] = Array.from({ length: 70 }, (_, i) =>
    ({ id: `f:${i}`, lat: 38 + i * 0.05, lon: -9, kind: 'exact', cc: 'PT', nameRu: '', name: `F${i}`, count: 1, pop: 1, langs: { pt: 1 } }));
  const tokyo: Place = { id: 'c:jp', lat: 35.7, lon: 139.7, kind: 'exact', cc: 'JP', nameRu: 'Токио', name: 'Tokyo', count: 1, pop: 1, langs: { ja: 1 } };
  shards.get.mockImplementation(async (cc: string) => (cc === 'JP' ? [{ ...st('j', 'c:jp', 1, ['ja']), cc: 'JP' }] : pt));
  const app = await startApp({ ...deps, loadPlaces: async () => [lisbon, porto, ...filler, tokyo] });
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  app.learn('ja');
  await app.next();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'j' }));
});

test('a station in two languages shows up in both modes and is found by "next" (review focus 3)', async () => {
  const both = [st('a', 'c:1', 9, ['pt']), st('m', 'c:1', 5, ['es', 'ca']), st('p', 'c:2', 1, ['pt'])];
  shards.get.mockResolvedValue(both);
  const app = await startApp({ ...deps, loadPlaces: async () => [{ ...lisbon, langs: { pt: 1, es: 1, ca: 1 } }, porto] });
  const names = () => [...deps.refs.panelBody.querySelectorAll('.station__name')].map((n) => n.textContent);
  app.learn('es');
  await app.selectPlace(lisbon);
  expect(names()).toEqual(['Radio m']);
  app.learn('ca');
  await flush();
  expect(names()).toEqual(['Radio m']);
  app.learn(null);
  await flush();
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  app.learn('ca');
  await app.next();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'm' }));
});

test('history and favorites tabs list saved stations; picking plays them', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  (deps.refs.panelBody.querySelector('.station__star') as HTMLButtonElement).click();
  app.tab('history');
  expect([...deps.refs.panelBody.querySelectorAll('.station__name')].map((n) => n.textContent)).toEqual(['Radio a']);
  app.tab('favorites');
  expect(deps.refs.panelBody.querySelector('.station__tags')!.textContent).toBe('Лиссабон, Португалия');
  expect(deps.refs.tabs[1].classList.contains('is-active')).toBe(true);
  player.set({ kind: 'idle' });
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a' }));
});

test('a favorite that left the data says so and can be unstarred (review focus 5)', async () => {
  deps.library.toggleFavorite({ id: 'gone', name: 'Old FM', placeId: 'c:1', cc: 'PT', favicon: '' });
  const app = await startApp(deps);
  app.tab('favorites');
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.stage.textContent).toContain('Станция больше не вещает');
  (deps.refs.panelBody.querySelector('.station__star') as HTMLButtonElement).click();
  expect(deps.refs.panelBody.textContent).toContain('Здесь будут станции, отмеченные звёздочкой');
});

test('player star follows the playing station', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  (deps.refs.player.querySelector('.pb__star') as HTMLButtonElement).click();
  expect(deps.library.isFavorite('a')).toBe(true);
  expect(deps.refs.player.querySelector('.pb__star')!.getAttribute('aria-pressed')).toBe('true');
  expect(deps.refs.panelBody.querySelector('.station__star')!.getAttribute('aria-pressed')).toBe('true');
});

test('surprise flies to a place, opens it and plays; in learn mode only the language', async () => {
  const app = await startApp(deps);
  app.learn('en');
  await app.surprise();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }));
  expect(globe.views[0].flyTo).toHaveBeenCalledWith(lisbon.lat, lisbon.lon);
  expect(deps.refs.panelBody.querySelector('.list-title')!.textContent).toBe('Лиссабон');
});

test('surprise with nothing to pick shows a notice', async () => {
  const app = await startApp({ ...deps, blacklist: { add: vi.fn(), has: () => true } });
  await app.surprise();
  expect(deps.refs.stage.textContent).toContain('Не удалось найти станцию');
});

test('search: a place opens it, a station plays it', async () => {
  await startApp(deps);
  deps.refs.searchInput.value = 'ра';
  deps.refs.searchInput.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  const items = [...document.querySelectorAll('.search-pop__item')] as HTMLButtonElement[];
  items[0].click();
  await flush();
  expect(deps.refs.panelBody.querySelector('.list-title')!.textContent).toBe('Порту');
  deps.refs.searchInput.value = 'ра';
  deps.refs.searchInput.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  ([...document.querySelectorAll('.search-pop__item')][1] as HTMLButtonElement).click();
  await flush();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a' }));
});

test('share button: link with station and country, copied notice', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  (deps.refs.player.querySelector('.pb__share') as HTMLButtonElement).click();
  await flush();
  expect(deps.share).toHaveBeenCalledWith({ url: 'https://u.github.io/globe-radio/?station=a&c=PT', title: 'Radio a', text: 'Слушаю «Radio a» — Лиссабон, Португалия' });
  expect(deps.refs.stage.textContent).toContain('Ссылка скопирована');
});

test('opening a shared link shows the card; "Слушать" plays the station', async () => {
  const ID = '96062a7b-0601-11e8-ae97-52543be04c81';
  shards.get.mockResolvedValue([{ ...st('x', 'c:1', 1, ['pt']), id: ID }]);
  await startApp({ ...deps, location: { href: `https://u.github.io/globe-radio/?station=${ID}&c=PT`, search: `?station=${ID}&c=PT` } });
  await flush();
  expect(deps.replaceUrl).toHaveBeenCalledWith('https://u.github.io/globe-radio/');
  const card = deps.refs.stage.querySelector('.share-card')!;
  expect(card.textContent).toContain('Radio x');
  expect(card.textContent).toContain('Лиссабон, Португалия · 14:32');
  (card.querySelector('.share-card__listen') as HTMLButtonElement).click();
  await flush();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: ID }));
});

test('a shared link to a missing station shows a notice (review focus 1)', async () => {
  const ID = '96062a7b-0601-11e8-ae97-52543be04c81';
  await startApp({ ...deps, location: { href: `https://u/?station=${ID}&c=PT`, search: `?station=${ID}&c=PT` } });
  await flush();
  expect(deps.refs.stage.querySelector('.share-card')).toBeNull();
  expect(deps.refs.stage.textContent).toContain('Станция из ссылки больше не вещает');
});

test('sleep menu starts the timer and the button shows the minutes left', async () => {
  let left: number | null = null;
  const listeners: (() => void)[] = [];
  const sleep = { start: vi.fn((m: number) => { left = m; listeners.forEach((l) => l()); }), cancel: vi.fn(), minutesLeft: () => left, subscribe: (l: () => void) => { listeners.push(l); return () => {}; } };
  await startApp({ ...deps, sleep });
  (deps.refs.player.querySelector('.pb__sleep') as HTMLButtonElement).click();
  (document.querySelector('.sleep-menu button') as HTMLButtonElement).click();
  expect(sleep.start).toHaveBeenCalledWith(15);
  expect(deps.refs.player.querySelector('.pb__sleep')!.textContent).toContain('Сон · 15 мин');
});

test('a malformed shared link is removed from the address and reported (review focus 1)', async () => {
  await startApp({ ...deps, location: { href: 'https://u/globe-radio/?station=abc&c=PT&lang=ru', search: '?station=abc&c=PT&lang=ru' } });
  await flush();
  expect(deps.replaceUrl).toHaveBeenCalledWith('https://u/globe-radio/?lang=ru');
  expect(deps.refs.stage.textContent).toContain('Станция из ссылки больше не вещает');
});

function fakeNet(on: boolean) {
  const ls = new Set<(o: boolean) => void>();
  return { on, online() { return this.on; }, subscribe(l: (o: boolean) => void) { ls.add(l); return () => { ls.delete(l); }; }, set(o: boolean) { this.on = o; ls.forEach((l) => l(o)); } };
}

test('offline: picking a station says the stream is unavailable at once, nothing connects (review focus 2)', async () => {
  const net = fakeNet(false);
  const app = await startApp({ ...deps, network: net });
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(player.play).not.toHaveBeenCalled();
  expect(deps.refs.stage.textContent).toContain('Нет подключения — эфир недоступен');
  net.set(true);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(player.play).toHaveBeenCalled();
});

test('offline start with no cached places: error status, no endless loading (review focus 2)', async () => {
  await startApp({ ...deps, network: fakeNet(false), loadPlaces: async () => { throw new Error('offline'); } });
  expect(deps.refs.status.textContent).not.toBe('Загружаем станции…');
  expect(deps.refs.status.textContent).not.toBe('');
});

test('shared link switches the install banner to the share context and back', async () => {
  const ID = '96062a7b-0601-11e8-ae97-52543be04c81';
  shards.get.mockResolvedValue([{ ...st('x', 'c:1', 1, ['pt']), id: ID }]);
  const installUi = { setContext: vi.fn() };
  await startApp({ ...deps, installUi, narrow: () => true, location: { href: `https://u/?station=${ID}&c=PT`, search: `?station=${ID}&c=PT` } });
  await flush();
  expect(installUi.setContext).toHaveBeenLastCalledWith('share');
  expect(deps.refs.left.classList.contains('is-open')).toBe(false);
  (deps.refs.stage.querySelector('.share-card__globe') as HTMLButtonElement).click();
  expect(installUi.setContext).toHaveBeenLastCalledWith('normal');
});

const navBtn = (n: string) => deps.refs.navButtons.find((b) => b.dataset.nav === n)!;

test('phone nav: search opens the search screen; a picked place returns to the globe', async () => {
  await startApp(deps);
  navBtn('search').click();
  expect(deps.refs.root.classList.contains('is-searching')).toBe(true);
  expect(document.activeElement).toBe(deps.refs.searchInput);
  expect(navBtn('search').getAttribute('aria-current')).toBe('page');
  deps.refs.searchInput.value = 'ра';
  deps.refs.searchInput.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  (document.querySelector('.search-pop__item') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.root.classList.contains('is-searching')).toBe(false);
  expect(navBtn('globe').getAttribute('aria-current')).toBe('page');
});

test('phone nav: favorites opens the saved list, globe closes it, learn opens the picker and marks learning', async () => {
  const app = await startApp(deps);
  navBtn('favorites').click();
  expect(deps.refs.left.classList.contains('is-open')).toBe(true);
  expect(deps.refs.tabs[1].classList.contains('is-active')).toBe(true);
  navBtn('globe').click();
  expect(deps.refs.left.classList.contains('is-open')).toBe(false);
  navBtn('learn').click();
  expect(document.querySelector('.learn-pop')).not.toBeNull();
  app.learn('en');
  expect(navBtn('learn').classList.contains('is-learning')).toBe(true);
});

test('phone: picking a station closes the list sheet so the place card shows; the handle can close it', async () => {
  const app = await startApp({ ...deps, narrow: () => true });
  await app.selectPlace(lisbon);
  expect(deps.refs.left.classList.contains('is-open')).toBe(true);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.left.classList.contains('is-open')).toBe(false);
  expect(player.play).toHaveBeenCalled();
  await app.selectPlace(lisbon);
  deps.refs.sheetHandle.dispatchEvent(new MouseEvent('pointerdown', { clientY: 300, bubbles: true }));
  document.dispatchEvent(new MouseEvent('pointerup', { clientY: 400, bubbles: true }));
  expect(deps.refs.left.classList.contains('is-open')).toBe(false);
});

test('desktop: picking a station keeps the list open', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.left.classList.contains('is-open')).toBe(true);
});

test('mini-player "more" menu: sleep, share and favorite', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  const more = deps.refs.player.querySelector('.pb__more') as HTMLButtonElement;
  more.click();
  const labels = [...document.querySelectorAll('.more-menu button')].map((b) => b.textContent);
  expect(labels).toEqual(['Сон', 'Поделиться', 'В избранное']);
  ([...document.querySelectorAll('.more-menu button')][2] as HTMLButtonElement).click();
  expect(deps.library.isFavorite('a')).toBe(true);
  more.click();
  ([...document.querySelectorAll('.more-menu button')][0] as HTMLButtonElement).click();
  expect(document.querySelector('.sleep-menu')).not.toBeNull();
});

test('tablet: the toggle opens and closes the place-card drawer; Escape closes it', async () => {
  await startApp(deps);
  deps.refs.placeToggle.click();
  expect(deps.refs.placeCard.classList.contains('is-open')).toBe(true);
  expect(deps.refs.placeToggle.getAttribute('aria-expanded')).toBe('true');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(deps.refs.placeCard.classList.contains('is-open')).toBe(false);
  expect(deps.refs.placeToggle.getAttribute('aria-expanded')).toBe('false');
});

test('saved tab: the star keeps keyboard focus; the highlight follows the playing station', async () => {
  deps.library.toggleFavorite({ id: 'a', name: 'Radio a', placeId: 'c:1', cc: 'PT', favicon: '' });
  deps.library.toggleFavorite({ id: 'b', name: 'Radio b', placeId: 'c:1', cc: 'PT', favicon: '' });
  const app = await startApp(deps);
  app.tab('history');
  deps.library.remember({ id: 'a', name: 'Radio a', placeId: 'c:1', cc: 'PT', favicon: '' });
  (deps.refs.panelBody.querySelector('.station__star') as HTMLButtonElement).click();
  expect(document.activeElement).toBe(deps.refs.panelBody.querySelector('.station__star'));
  app.tab('favorites');
  player.set({ kind: 'playing', station: st('b', 'c:1') });
  expect(deps.refs.panelBody.querySelector('.station.is-playing .station__name')!.textContent).toBe('Radio b');
});

test('back to "Here" shows loading at once instead of the old saved list', async () => {
  const app = await startApp(deps);
  await app.selectPlace(lisbon);
  app.tab('favorites');
  shards.get.mockImplementationOnce(() => new Promise(() => {}));
  app.tab('here');
  expect(deps.refs.panelBody.textContent).toBe('Загружаем станции…');
});

test('the last pick wins over a slower earlier one', async () => {
  deps.library.toggleFavorite({ id: 'a', name: 'Radio a', placeId: 'c:1', cc: 'PT', favicon: '' });
  deps.library.toggleFavorite({ id: 'p', name: 'Radio p', placeId: 'c:2', cc: 'PT', favicon: '' });
  let releaseSlow!: (v: StationLite[]) => void;
  shards.get.mockImplementationOnce(() => new Promise((r) => { releaseSlow = r; }));
  const app = await startApp(deps);
  app.tab('favorites');
  const picks = () => [...deps.refs.panelBody.querySelectorAll('.station__pick')] as HTMLButtonElement[];
  picks()[1].click();
  picks()[0].click();
  await flush();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'p' }));
  releaseSlow(pt);
  await flush();
  expect(player.play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'p' }));
  expect(player.play).toHaveBeenCalledTimes(1);
});

test('honest messages: search hit missing from the data; country file failed to load', async () => {
  const app = await startApp({ ...deps, createSearch: () => ({ search: async () => ({ places: [], stations: [{ name: 'Ghost FM', place: lisbon }] }) }) });
  deps.refs.searchInput.value = 'gh';
  deps.refs.searchInput.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  (document.querySelector('.search-pop__item') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.stage.textContent).toContain('Станция больше не вещает');
  deps.library.toggleFavorite({ id: 'a', name: 'Radio a', placeId: 'c:1', cc: 'PT', favicon: '' });
  app.tab('favorites');
  shards.get.mockRejectedValueOnce(new Error('offline'));
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.stage.textContent).toContain('Не удалось загрузить станции этого места');
});

test('phone: «Удиви меня» and a station from search close the list so the place card shows', async () => {
  const app = await startApp({ ...deps, narrow: () => true });
  await app.surprise();
  expect(deps.refs.left.classList.contains('is-open')).toBe(false);
  expect(player.play).toHaveBeenCalled();
  deps.refs.searchInput.value = 'ра';
  deps.refs.searchInput.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  ([...document.querySelectorAll('.search-pop__item')][1] as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.left.classList.contains('is-open')).toBe(false);
});

test('shared link works with a live location that changes when the address is cleaned (regression)', async () => {
  const ID = '96062a7b-0601-11e8-ae97-52543be04c81';
  shards.get.mockResolvedValue([{ ...st('x', 'c:1', 1, ['pt']), id: ID }]);
  const loc = { href: `https://u/?station=${ID}&c=PT`, search: `?station=${ID}&c=PT` };
  const replaceUrl = vi.fn((url: string) => { loc.href = url; loc.search = new URL(url).search; });
  await startApp({ ...deps, location: loc, replaceUrl });
  await flush();
  expect(replaceUrl).toHaveBeenCalledWith('https://u/');
  expect(deps.refs.stage.querySelector('.share-card')).not.toBeNull();
});

test('review: offline, Play on a paused station does not start an 8-second connect', async () => {
  const net = fakeNet(true);
  const app = await startApp({ ...deps, network: net });
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  player.set({ kind: 'paused', station: st('a', 'c:1') });
  net.set(false);
  (deps.refs.player.querySelector('.pb__play') as HTMLButtonElement).click();
  expect(player.toggle).not.toHaveBeenCalled();
  expect(deps.refs.stage.textContent).toContain('Нет подключения — эфир недоступен');
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  expect(player.toggle).not.toHaveBeenCalled();
});

test('review: offline with no places, tapping a favorite says there is no connection', async () => {
  deps.library.toggleFavorite({ id: 'a', name: 'Radio a', placeId: 'c:1', cc: 'PT', favicon: '' });
  const app = await startApp({ ...deps, network: fakeNet(false), loadPlaces: async () => { throw new Error('offline'); } });
  app.tab('favorites');
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.stage.textContent).toContain('Нет подключения — эфир недоступен');
  expect(deps.refs.stage.textContent).not.toContain('Станция больше не вещает');
});

test('review: a searched station whose country file fails says so', async () => {
  await startApp({ ...deps, narrow: () => true });
  shards.get.mockRejectedValue(new Error('net'));
  deps.refs.searchInput.value = 'ра';
  deps.refs.searchInput.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 200));
  ([...document.querySelectorAll('.search-pop__item')][1] as HTMLButtonElement).click();
  await flush();
  expect(deps.refs.stage.textContent).toContain('Не удалось загрузить станции этого места');
});

test('review: Space on a sheet handle does not toggle playback', async () => {
  await startApp(deps);
  deps.refs.sheetHandle.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
  expect(player.toggle).not.toHaveBeenCalled();
});

test('review: picking the playing place or station again reveals the swiped-away place card', async () => {
  const reveal = vi.fn();
  const app = await startApp({ ...deps, card: { show: vi.fn(), setLearn: vi.fn(), reveal } });
  await app.selectPlace(lisbon);
  (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
  await flush();
  reveal.mockClear();
  await app.selectPlace(lisbon);
  expect(reveal).toHaveBeenCalled();
});

test('English interface: learn mode says "Next in English" (no Russian cases)', async () => {
  const en = (await import('../locales/en.json')).default;
  const i18nEn = createI18n('en', en);
  const app = await startApp({ ...deps, i18n: i18nEn, refs: renderShell(document.getElementById('app')!, i18nEn) });
  app.learn('en');
  expect(document.querySelector('.pb__next')!.textContent).toBe('Next in English');
});

test('analytics events: play, search, surprise, share', async () => {
  const gtag = vi.fn();
  (globalThis as { gtag?: unknown }).gtag = gtag;
  try {
    const app = await startApp(deps);
    await app.selectPlace(lisbon);
    (deps.refs.panelBody.querySelector('.station__pick') as HTMLButtonElement).click();
    await flush();
    expect(gtag).toHaveBeenCalledWith('event', 'play_station', { country: 'PT', place: 'Lisbon' });
    deps.refs.searchInput.value = 'ра';
    deps.refs.searchInput.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 200));
    expect(gtag).toHaveBeenCalledWith('event', 'search', { search_term: 'ра' });
    await app.surprise();
    expect(gtag).toHaveBeenCalledWith('event', 'surprise', {});
    (deps.refs.player.querySelector('.pb__share') as HTMLButtonElement).click();
    await flush();
    expect(gtag).toHaveBeenCalledWith('event', 'share', { method: 'copied' });
  } finally {
    delete (globalThis as { gtag?: unknown }).gtag;
  }
});

test('cookie settings button appears when the consent snippet is present and reopens the banner', async () => {
  const open = vi.fn();
  (globalThis as { globeConsent?: unknown }).globeConsent = { open };
  try {
    await startApp(deps);
    expect(deps.refs.cookiesButton.closest('[hidden]')).toBeNull();
    deps.refs.cookiesButton.click();
    expect(open).toHaveBeenCalled();
  } finally {
    delete (globalThis as { globeConsent?: unknown }).globeConsent;
  }
});
