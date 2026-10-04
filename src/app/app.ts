import { countryName, placeTitle } from '../data/place-name';
import type { Place } from '../data/places';
import type { PlaceInfo, ShardStore, StationLite } from '../data/shards';
import type { PlaceCardData } from '../place-card/place-card';
import type { I18n } from '../i18n/i18n';
import { initialMode, MODE_STORAGE_KEY, type ViewMode } from '../map/choose-mode';
import { createClusterer, type Clusterer, type MapItem } from '../map/cluster';
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
  card: { show(d: PlaceCardData | null): void };
  mediaSession?: MediaSession;
}
export interface AppHandle { mode(): ViewMode; selectPlace(p: Place): Promise<void>; next(): Promise<void> }

export const VOLUME_KEY = 'volume';
export const MUTE_KEY = 'muted';
const MIN_FPS = 30;

export async function startApp(d: AppDeps): Promise<AppHandle> {
  const { refs, i18n, player } = d;
  const t = i18n.t;
  const read = (k: string) => { try { return d.storage?.getItem(k) ?? null; } catch { return null; } };
  const write = (k: string, v: string) => { try { d.storage?.setItem(k, v); } catch { /* storage unavailable */ } };

  let places: Place[] = [];
  let clusterer: Clusterer | null = null;
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
  const label = (item: MapItem) =>
    item.type === 'place'
      ? t('map.tooltip', { place: placeTitle(item.place, i18n.locale), stations: stationsLabel(item.count) })
      : stationsLabel(item.count);
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
  const renderBar = () => bar.render({ state: player.getState(), place: placeLabel(playingPlace), volume, muted });

  async function renderList(place: Place, showLoading = true) {
    list = null;
    if (showLoading) renderListMessage(refs.panelBody, t('data.loading'));
    try {
      const all = await d.shards.get(place.cc);
      if (selected !== place) return;
      const stations = all.filter((s) => s.placeId === place.id);
      const state = player.getState();
      const subtitle = place.kind === 'country'
        ? t('list.subtitleApprox', { stations: stationsLabel(stations.length) })
        : t('list.subtitle', { country: countryName(place.cc, i18n.locale), stations: stationsLabel(stations.length) });
      const handle = renderStationList(refs.panelBody, i18n, {
        title: placeTitle(place, i18n.locale),
        subtitle,
        stations,
        playingId: state.kind === 'idle' ? null : state.station.id,
        onPick: (s) => { void playStation(s, place); },
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

  async function playStation(s: StationLite, p: Place) {
    playingPlace = p;
    view?.setPlaying(p);
    await player.play(s);
  }

  async function next() {
    const state = player.getState();
    if (state.kind === 'idle' || !playingPlace) return;
    const found = await findNextNearby({
      currentId: state.station.id,
      currentPlace: playingPlace,
      places,
      stationsOf: (cc) => d.shards.get(cc),
      isBlocked: (id) => d.blacklist.has(id),
    });
    if (!found) { showToast(refs.stage, t('player.noNext')); return; }
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
    const v = await d.factories[m](refs.map, clusterer!, { onSelect: (p) => { void selectPlace(p); }, label });
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
      if (m === mode || !clusterer) return;
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

  const handle: AppHandle = { mode: () => mode, selectPlace, next };
  d.card.show(null);
  renderBar();

  refs.status.textContent = t('data.loading');
  try {
    places = await d.loadPlaces();
  } catch {
    refs.status.textContent = t('data.error');
    return handle;
  }
  refs.status.textContent = '';
  clusterer = createClusterer(places);
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
