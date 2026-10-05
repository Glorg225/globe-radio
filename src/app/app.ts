import { countryName, placeTitle } from '../data/place-name';
import type { Place } from '../data/places';
import type { PlaceInfo, ShardStore, StationLite } from '../data/shards';
import type { PlaceCardData } from '../place-card/place-card';
import type { I18n } from '../i18n/i18n';
import { initialMode, MODE_STORAGE_KEY, type ViewMode } from '../map/choose-mode';
import { prepositional } from '../i18n/ru-grammar';
import { buildLanguageIndex, lowerFirst, type LanguageEntry } from '../learn/language-index';
import { createLearnState, type LearnState } from '../learn/learn-state';
import { createClusterer, layered, type Clusterer, type MapItem } from '../map/cluster';
import { createLearnBanner } from '../ui/learn-banner';
import { createLearnPicker } from '../ui/learn-picker';
import type { MapFactory, MapView } from '../map/map-view';
import type { Blacklist } from '../player/blacklist';
import { updateMediaSession } from '../player/media-session';
import { findNextNearby } from '../player/next-nearby';
import type { Player } from '../player/player';
import { createPlayerBar } from '../ui/player-bar';
import type { ShellRefs } from '../ui/shell';
import { renderListMessage, renderStationList, type StationListHandle } from '../ui/station-list';
import { showToast } from '../ui/toast';

export interface AppDeps {
  refs: ShellRefs; i18n: I18n; storage: Storage | null;
  loadPlaces(): Promise<Place[]>; shards: ShardStore;
  factories: Record<ViewMode, MapFactory>;
  player: Player; blacklist: Blacklist;
  hasWebGL: boolean; narrowTouch: boolean;
  measureFps(): Promise<number>;
  card: { show(d: PlaceCardData | null): void; setLearn(code: string | null, onLearn: (code: string) => void): void };
  mediaSession?: MediaSession;
}
export interface AppHandle { mode(): ViewMode; selectPlace(p: Place): Promise<void>; next(): Promise<void>; learn(code: string | null): void }

export const VOLUME_KEY = 'volume';
export const MUTE_KEY = 'muted';
const MIN_FPS = 30;

export async function startApp(d: AppDeps): Promise<AppHandle> {
  const { refs, i18n, player } = d;
  const t = i18n.t;
  const read = (k: string) => { try { return d.storage?.getItem(k) ?? null; } catch { return null; } };
  const write = (k: string, v: string) => { try { d.storage?.setItem(k, v); } catch { /* storage unavailable */ } };

  let places: Place[] = [];
  let base: Clusterer | null = null;
  let layer: Clusterer | null = null;
  const source: Clusterer = { items: (z) => layer?.items(z) ?? [] };
  let languages: LanguageEntry[] = [];
  let learnState: LearnState | null = null;
  let learnCode: string | null = null;
  let langPrep = '';
  let view: MapView | null = null;
  let mode: ViewMode = 'globe';
  let selected: Place | null = null;
  let playingPlace: Place | null = null;
  let list: { placeId: string; handle: StationListHandle } | null = null;

  const storedVolume = Number(read(VOLUME_KEY) ?? '0.8');
  let volume = Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 1 ? storedVolume : 0.8;
  let muted = read(MUTE_KEY) === '1';
  player.setVolume(volume);
  player.setMuted(muted);

  const stationsLabel = (n: number) => t('stations.count', { count: n });
  const label = (item: MapItem) => {
    if (item.tone === 'teal') {
      return item.type === 'place'
        ? t('learn.tooltip', { place: placeTitle(item.place, i18n.locale), stations: stationsLabel(item.count), langPrep })
        : t('learn.stationsIn', { stations: stationsLabel(item.count), langPrep });
    }
    return item.type === 'place'
      ? t('map.tooltip', { place: placeTitle(item.place, i18n.locale), stations: stationsLabel(item.count) })
      : stationsLabel(item.count);
  };
  const placeLabel = (p: Place | null) => {
    if (!p) return '';
    const title = placeTitle(p, i18n.locale);
    return p.kind === 'country' ? title : t('player.placeCountry', { place: title, country: countryName(p.cc, i18n.locale) });
  };

  const bar = createPlayerBar(refs.player, i18n, {
    onToggle: () => player.toggle(),
    onNext: () => { void next(); },
    onVolume: (v) => {
      volume = v;
      player.setVolume(v);
      write(VOLUME_KEY, String(v));
      if (muted && v > 0) { muted = false; player.setMuted(false); write(MUTE_KEY, '0'); }
      renderBar();
    },
    onMute: () => { muted = !muted; player.setMuted(muted); write(MUTE_KEY, muted ? '1' : '0'); renderBar(); },
  });
  const renderBar = () => bar.render({
    state: player.getState(), place: placeLabel(playingPlace), volume, muted,
    nextLabel: learnCode ? t('learn.next', { langPrep }) : undefined,
  });

  async function renderList(place: Place, showLoading = true, showAll = false) {
    list = null;
    if (showLoading) renderListMessage(refs.panelBody, t('data.loading'));
    try {
      const all = await d.shards.get(place.cc);
      if (selected !== place) return;
      const inPlace = all.filter((s) => s.placeId === place.id);
      const lang = showAll ? null : learnCode;
      const stations = lang ? inPlace.filter((s) => s.langs.includes(lang)) : inPlace;
      if (lang && stations.length === 0) {
        renderListMessage(refs.panelBody, t('learn.empty', { langPrep }), { label: t('learn.showAll'), onClick: () => { void renderList(place, false, true); } });
        return;
      }
      const state = player.getState();
      const count = stationsLabel(stations.length);
      const country = countryName(place.cc, i18n.locale);
      const subtitle = lang
        ? place.kind === 'country' ? t('learn.subtitleApprox', { stations: count, langPrep }) : t('learn.subtitle', { country, stations: count, langPrep })
        : place.kind === 'country' ? t('list.subtitleApprox', { stations: count }) : t('list.subtitle', { country, stations: count });
      const handle = renderStationList(refs.panelBody, i18n, {
        title: placeTitle(place, i18n.locale),
        subtitle,
        stations,
        playingId: state.kind === 'idle' ? null : state.station.id,
        onPick: (s) => { void playStation(s, place); },
        learn: lang ? { tip: t('learn.tip'), talkLabel: t('learn.talk') } : undefined,
      });
      list = { placeId: place.id, handle };
    } catch {
      if (selected !== place) return;
      renderListMessage(refs.panelBody, t('list.loadError'), { label: t('common.retry'), onClick: () => { void renderList(place); } });
    }
  }

  async function selectPlace(p: Place) {
    selected = p;
    refs.left.classList.add('is-open');
    await renderList(p);
  }

  // Recently played stations are skipped by "next", so it moves on instead of bouncing between two favourites.
  const recent: string[] = [];
  const RECENT_LIMIT = 30;

  async function playStation(s: StationLite, p: Place) {
    recent.splice(0, recent.length, ...recent.filter((id) => id !== s.id), s.id);
    if (recent.length > RECENT_LIMIT) recent.shift();
    playingPlace = p;
    view?.setPlaying(p);
    await player.play(s);
  }

  async function next() {
    const state = player.getState();
    if (state.kind === 'idle' || !playingPlace) return;
    const query = {
      currentId: state.station.id,
      currentPlace: playingPlace,
      places,
      stationsOf: (cc: string) => d.shards.get(cc),
      filter: learnCode ? (s: StationLite) => s.langs.includes(learnCode!) : undefined,
    };
    // Prefer stations not heard recently; when everything around was played, start a new round.
    const found = await findNextNearby({ ...query, isBlocked: (id) => d.blacklist.has(id) || recent.includes(id) })
      ?? await findNextNearby({ ...query, isBlocked: (id) => d.blacklist.has(id) });
    if (!found) { showToast(refs.stage, learnCode ? t('learn.noNext', { langPrep }) : t('player.noNext')); return; }
    if (found.place.id !== playingPlace.id) view?.flyTo(found.place.lat, found.place.lon);
    selected = found.place;
    void renderList(found.place, false);
    await playStation(found.station, found.place);
  }

  // The card follows the playing station; a slow place-info answer for an older station is dropped.
  let cardKey = '';
  let cardToken = 0;
  async function updateCard(station: StationLite | null) {
    const place = playingPlace;
    const key = station && place ? `${station.id}|${place.id}` : '';
    if (key === cardKey) return;
    cardKey = key;
    const my = ++cardToken;
    if (!station || !place) { d.card.show(null); return; }
    let info: PlaceInfo | null = null;
    try { info = (await d.shards.info(place.cc)).get(place.id) ?? null; } catch { info = null; }
    if (my === cardToken) d.card.show({ place, station, info });
  }

  player.subscribe((s) => {
    renderBar();
    const station = s.kind === 'idle' ? null : s.station;
    updateMediaSession(
      d.mediaSession,
      station ? { title: station.name, artist: placeLabel(playingPlace), artwork: station.favicon } : null,
      s.kind === 'playing' || s.kind === 'loading' ? 'playing' : s.kind === 'idle' ? 'none' : 'paused',
      { play: () => player.toggle(), pause: () => player.pause(), next: () => { void next(); } },
    );
    if (list && selected && list.placeId === selected.id) list.handle.setPlaying(station?.id ?? null);
    void updateCard(station);
  });

  let mountToken = 0;
  async function mount(m: ViewMode) {
    const token = ++mountToken;
    view?.destroy();
    view = null;
    refs.map.replaceChildren();
    mode = m;
    for (const b of refs.viewButtons) b.setAttribute('aria-pressed', String(b.dataset.view === m));
    const v = await d.factories[m](refs.map, source, { onSelect: (p) => { void selectPlace(p); }, label });
    // A newer mount started while this view was loading: drop this one.
    if (token !== mountToken) { v.destroy(); return; }
    view = v;
    v.setPlaying(playingPlace);
  }

  async function mountSafe(m: ViewMode) {
    try {
      await mount(m);
    } catch {
      if (m === 'globe') {
        await mount('map');
        showToast(refs.stage, t('map.fallback'));
      } else {
        refs.status.textContent = t('data.error');
      }
    }
  }

  for (const b of refs.viewButtons) {
    b.addEventListener('click', () => {
      const m = b.dataset.view as ViewMode;
      if (m === mode || !base) return;
      if (m === 'globe' && !d.hasWebGL) { showToast(refs.stage, t('map.fallback')); return; }
      write(MODE_STORAGE_KEY, m);
      void mountSafe(m);
    });
  }
  refs.zoomIn.addEventListener('click', () => view?.zoomBy(2));
  refs.zoomOut.addEventListener('click', () => view?.zoomBy(0.5));
  refs.closePanel.addEventListener('click', () => refs.left.classList.remove('is-open'));
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('input, textarea, select, button, [contenteditable]')) return;
    e.preventDefault();
    player.toggle();
  });

  let picker: { update(): void } | null = null;
  const banner = createLearnBanner(refs.banner, i18n, () => learnState?.set(null));
  function applyLearn(code: string | null) {
    learnCode = code;
    const entry = code ? languages.find((e) => e.code === code) ?? null : null;
    langPrep = entry ? prepositional(lowerFirst(entry.name, i18n.locale)) : '';
    if (base) layer = layered(base, code ? createClusterer(places, (p) => p.langs?.[code] ?? 0) : null);
    view?.refresh();
    picker?.update();
    banner.show(entry);
    d.card.setLearn(code, (c) => learnState?.set(c));
    renderBar();
    if (selected) void renderList(selected, false);
  }

  const handle: AppHandle = { mode: () => mode, selectPlace, next, learn: (code) => learnState?.set(code) };
  d.card.show(null);
  d.card.setLearn(null, (c) => learnState?.set(c));
  renderBar();

  refs.status.textContent = t('data.loading');
  try {
    places = await d.loadPlaces();
  } catch {
    refs.status.textContent = t('data.error');
    return handle;
  }
  refs.status.textContent = '';
  base = createClusterer(places);
  layer = base;
  languages = buildLanguageIndex(places, i18n.locale);
  const known = new Set(languages.map((e) => e.code));
  learnState = createLearnState(d.storage, (c) => known.has(c));
  picker = createLearnPicker(i18n, refs.learnButton, {
    languages: () => languages,
    current: () => learnState!.get(),
    onPick: (c) => learnState!.set(c === learnState!.get() ? null : c),
  });
  learnState.subscribe(applyLearn);
  applyLearn(learnState.get());
  await mountSafe(initialMode({ saved: read(MODE_STORAGE_KEY), hasWebGL: d.hasWebGL, narrowTouch: d.narrowTouch }));
  if (mode === 'globe') {
    void d.measureFps().then((fps) => {
      if (fps < MIN_FPS && mode === 'globe') {
        void mount('map');
        showToast(refs.stage, t('map.fallback'));
      }
    });
  }
  return handle;
}
