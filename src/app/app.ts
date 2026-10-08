import { countryName, placeTitle } from '../data/place-name';
import { GENRES, genreById, stationStyles } from '../data/genres';
import type { StyleIndex } from '../data/styles';
import type { Place } from '../data/places';
import type { PlaceInfo, ShardStore, StationLite } from '../data/shards';
import type { PlaceCardData } from '../place-card/place-card';
import type { I18n } from '../i18n/i18n';
import { initialMode, MODE_STORAGE_KEY, type ViewMode } from '../map/choose-mode';
import { prepositional } from '../i18n/ru-grammar';
import { buildLanguageIndex, lowerFirst, type LanguageEntry } from '../learn/language-index';
import { createChoiceState, createLearnState, STYLE_KEY, type ChoiceState, type LearnState } from '../learn/learn-state';
import { createClusterer, layered, type Clusterer, type MapItem } from '../map/cluster';
import { createLearnBanner } from '../ui/learn-banner';
import { createLearnPicker } from '../ui/learn-picker';
import type { MapFactory, MapView } from '../map/map-view';
import type { MapLabelDetail } from '../map/tooltip';
import type { Blacklist } from '../player/blacklist';
import { updateMediaSession } from '../player/media-session';
import { findNextNearby } from '../player/next-nearby';
import type { Player } from '../player/player';
import { createPlayerBar } from '../ui/player-bar';
import type { ShellRefs } from '../ui/shell';
import { toSaved, type Library, type SavedStation } from '../library/library';
import { languageNames } from '../place-card/language';
import { formatClock, isValidTimeZone } from '../place-card/time';
import type { SleepTimer } from '../player/sleep-timer';
import { track } from '../analytics/track';
import { pickSurprise } from '../player/surprise';
import type { NetworkStatus } from '../pwa/network';
import type { SearchResult } from '../search/search-index';
import { buildShareUrl, parseShareParams, resolveShared, stripShareParams } from '../share/share-link';
import { topCountries, type CountryLink } from '../seo/country';
import { renderBrowseCountries } from '../ui/browse-countries';
import { createStyleBanner } from '../ui/style-banner';
import { createStylePicker } from '../ui/style-picker';
import { createMobileNav } from '../ui/mobile-nav';
import { createSearchBox } from '../ui/search-box';
import { attachSheetDrag } from '../ui/sheet';
import { showShareCard } from '../ui/share-card';
import { openMoreMenu } from '../ui/more-menu';
import { openSleepMenu } from '../ui/sleep-menu';
import { renderListMessage, renderSavedList, renderStationList, type SavedListHandle, type StationListHandle } from '../ui/station-list';
import { showToast } from '../ui/toast';

export interface AppDeps {
  refs: ShellRefs; i18n: I18n; storage: Storage | null;
  loadPlaces(): Promise<Place[]>; shards: ShardStore;
  // Style mode data (public/data/styles.json), fetched on first use.
  loadStyles(): Promise<StyleIndex>;
  factories: Record<ViewMode, MapFactory>;
  player: Player; blacklist: Blacklist;
  hasWebGL: boolean; narrowTouch: boolean;
  measureFps(): Promise<number>;
  card: { show(d: PlaceCardData | null): void; setLearn(code: string | null, onLearn: (code: string) => void): void; reveal?(): void };
  mediaSession?: MediaSession;
  library: Library;
  sleep: SleepTimer;
  share(o: { url: string; title: string; text: string }): Promise<'shared' | 'copied' | 'cancelled' | 'failed'>;
  createSearch(places: Place[]): { search(q: string): Promise<SearchResult>; prefetch?(): void };
  location: { href: string; search: string };
  replaceUrl(url: string): void;
  flagUrl(cc: string): string | null;
  now(): Date;
  fetchFn?: typeof fetch;
  network?: NetworkStatus;
  installUi?: { setContext(c: 'share' | 'normal'): void };
  narrow?(): boolean;
}
export type PanelTab = 'here' | 'favorites' | 'history';
export interface AppHandle {
  mode(): ViewMode; selectPlace(p: Place): Promise<void>; next(): Promise<void>; learn(code: string | null): void; style(id: string | null): void;
  surprise(): Promise<void>; tab(name: PanelTab): void;
}

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
  // Style mode (#40): a style id, its index once loaded (styles.json), and the shared load.
  let styleState: ChoiceState | null = null;
  let styleId: string | null = null;
  let styleIndex: StyleIndex | null = null;
  let styleLoad: Promise<StyleIndex | null> | null = null;
  let browseStyles: { id: string; name: string }[] = [];
  let searchBox: { close(): void } | null = null;
  const styleName = () => (styleId ? genreById(styleId)?.name ?? styleId : '');
  let langPrep = '';
  let view: MapView | null = null;
  let mode: ViewMode = 'globe';
  let selected: Place | null = null;
  let playingPlace: Place | null = null;
  let list: { placeId: string; handle: StationListHandle } | null = null;
  let tab: PanelTab = 'here';
  let saved: SavedListHandle | null = null;
  let focusStar: { id: string; index: number } | null = null;
  let pickToken = 0;
  let byId = new Map<string, Place>();
  let countries: CountryLink[] = [];

  const storedVolume = Number(read(VOLUME_KEY) ?? '0.8');
  let volume = Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 1 ? storedVolume : 0.8;
  let muted = read(MUTE_KEY) === '1';
  player.setVolume(volume);
  player.setMuted(muted);

  const stationsLabel = (n: number) => t('stations.count', { count: n });
  const label = (item: MapItem) => {
    if (item.tone === 'teal' && learnCode) {
      return item.type === 'place'
        ? t('learn.tooltip', { place: placeTitle(item.place, i18n.locale), stations: stationsLabel(item.count), langPrep })
        : t('learn.stationsIn', { stations: stationsLabel(item.count), langPrep });
    }
    return item.type === 'place'
      ? t('map.tooltip', { place: placeTitle(item.place, i18n.locale), stations: stationsLabel(item.count) })
      : stationsLabel(item.count);
  };
  // Tooltip second line: local time, up to 2 languages, up to 2 styles; the flag of the place's country.
  const detail = (item: MapItem): MapLabelDetail | null => {
    if (item.type !== 'place') return null;
    const p = item.place;
    const langs = Object.entries(p.langs ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([code]) => code);
    const parts = [
      p.tz && isValidTimeZone(p.tz) ? formatClock(p.tz, d.now(), i18n.locale) : '',
      langs.length ? languageNames(langs, i18n.locale) : '',
      (p.styles ?? []).slice(0, 2).map((id) => genreById(id)?.name).filter(Boolean).join(', '),
    ].filter(Boolean);
    return { flag: d.flagUrl(p.cc), text: parts.join(' · ') };
  };
  const placeLabel = (p: Place | null) => {
    if (!p) return '';
    const title = placeTitle(p, i18n.locale);
    return p.kind === 'country' ? title : t('player.placeCountry', { place: title, country: countryName(p.cc, i18n.locale) });
  };

  let sleepChoice: number | null = null;
  // Offline: say so at once instead of letting the player wait for the 8-second stream timeout.
  const offlineBlocked = () => {
    if (!d.network || d.network.online()) return false;
    showToast(refs.stage, t('net.offlinePlay'));
    return true;
  };
  const togglePlay = () => {
    const kind = player.getState().kind;
    if (kind !== 'loading' && kind !== 'playing' && offlineBlocked()) return;
    player.toggle();
  };
  const openSleep = (anchor: HTMLElement) => {
    openSleepMenu(anchor, i18n, sleepChoice, (m) => {
      sleepChoice = m;
      if (m) d.sleep.start(m); else d.sleep.cancel();
    });
  };
  const bar = createPlayerBar(refs.player, i18n, {
    onToggle: togglePlay,
    onNext: () => { void next(); },
    onVolume: (v) => {
      volume = v;
      player.setVolume(v);
      write(VOLUME_KEY, String(v));
      if (muted && v > 0) { muted = false; player.setMuted(false); write(MUTE_KEY, '0'); }
      renderBar();
    },
    onMute: () => { muted = !muted; player.setMuted(muted); write(MUTE_KEY, muted ? '1' : '0'); renderBar(); },
    onFavorite: () => { const s = player.getState(); if (s.kind !== 'idle') d.library.toggleFavorite(toSaved(s.station)); },
    onShare: () => { void shareCurrent(); },
    onSleep: openSleep,
    onMore: (anchor) => {
      const s = player.getState();
      if (s.kind === 'idle') return;
      const fav = d.library.isFavorite(s.station.id);
      openMoreMenu(anchor, t('player.more'), [
        { label: t('player.sleep'), onClick: () => openSleep(anchor) },
        { label: t('player.share'), onClick: () => { void shareCurrent(); } },
        { label: t(fav ? 'station.unfavorite' : 'station.favorite'), onClick: () => { d.library.toggleFavorite(toSaved(s.station)); } },
      ]);
    },
  });
  const renderBar = () => bar.render({
    state: player.getState(), place: placeLabel(playingPlace), volume, muted,
    nextLabel: learnCode ? t('learn.next', { langPrep }) : styleId ? t('style.next', { style: styleName() }) : undefined,
    favorite: (() => { const s = player.getState(); return s.kind !== 'idle' && d.library.isFavorite(s.station.id); })(),
    sleepMinutes: d.sleep.minutesLeft() ?? undefined,
    sleepLabel: (() => { const m = d.sleep.minutesLeft(); return m === null ? undefined : t('sleep.active', { m }); })(),
  });
  d.sleep.subscribe(() => {
    if (d.sleep.minutesLeft() === null) sleepChoice = null;
    renderBar();
  });

  // The active filter of the list, "next", "surprise" and the map layer: a language (learn) or a style (#40).
  function stationMatch(): ((s: StationLite) => boolean) | undefined {
    const code = learnCode;
    if (code) return (s) => s.langs.includes(code);
    const id = styleId;
    if (id) return (s) => stationStyles(s).includes(id);
    return undefined;
  }
  function placeWeight(p: Place): number {
    if (learnCode) return p.langs?.[learnCode] ?? 0;
    if (styleId) return styleIndex?.get(styleId)?.get(p.id) ?? 0;
    return p.count;
  }

  async function renderList(place: Place, showLoading = true, showAll = false) {
    list = null;
    if (showLoading) renderListMessage(refs.panelBody, t('data.loading'));
    try {
      const all = await d.shards.get(place.cc);
      if (selected !== place || tab !== 'here') return;
      const inPlace = all.filter((s) => s.placeId === place.id);
      const lang = showAll ? null : learnCode;
      const style = showAll ? null : styleId;
      const match = showAll ? undefined : stationMatch();
      const stations = match ? inPlace.filter(match) : inPlace;
      if (match && stations.length === 0) {
        const empty = lang ? t('learn.empty', { langPrep }) : t('style.empty', { style: styleName() });
        renderListMessage(refs.panelBody, empty, { label: t('learn.showAll'), onClick: () => { void renderList(place, false, true); } }, clearAction());
        return;
      }
      const state = player.getState();
      const count = stationsLabel(stations.length);
      const country = countryName(place.cc, i18n.locale);
      const subtitle = lang
        ? place.kind === 'country' ? t('learn.subtitleApprox', { stations: count, langPrep }) : t('learn.subtitle', { country, stations: count, langPrep })
        : style
          ? place.kind === 'country' ? t('style.subtitleApprox', { stations: count, style: styleName() }) : t('style.subtitle', { country, stations: count, style: styleName() })
          : place.kind === 'country' ? t('list.subtitleApprox', { stations: count }) : t('list.subtitle', { country, stations: count });
      const handle = renderStationList(refs.panelBody, i18n, {
        title: placeTitle(place, i18n.locale),
        subtitle,
        stations,
        playingId: state.kind === 'idle' ? null : state.station.id,
        onPick: (s) => { if (d.narrow?.()) { closeSheet(); nav.set('globe'); } void playStation(s, place); },
        learn: lang ? { tip: t('learn.tip'), talkLabel: t('learn.talk') } : undefined,
        favorites: { isFavorite: (id) => d.library.isFavorite(id), onToggle: (s) => { d.library.toggleFavorite(toSaved(s)); } },
        onClose: () => clearSelection(true),
      });
      list = { placeId: place.id, handle };
    } catch {
      if (selected !== place || tab !== 'here') return;
      renderListMessage(refs.panelBody, t('list.loadError'), { label: t('common.retry'), onClick: () => { void renderList(place); } }, clearAction());
    }
  }

  // Back to "Pick a point on the globe" and the country links. The close button vanishes, so focus goes to
  // the Here tab; Escape moves it there only from inside the panel and otherwise leaves it where it is.
  function clearSelection(fromButton: boolean) {
    if (!selected) return;
    const focusInPanel = fromButton || refs.left.contains(document.activeElement);
    selected = null;
    list = null;
    if (tab === 'here') renderTab();
    if (focusInPanel) refs.tabs[0]?.focus();
  }
  const clearAction = () => ({ label: t('list.clear'), onClick: () => clearSelection(true) });

  async function selectPlace(p: Place) {
    selected = p;
    showTab('here');
    nav.set('globe');
    if (playingPlace && p.id === playingPlace.id) d.card.reveal?.();
    refs.left.classList.add('is-open');
    await renderList(p);
  }

  // Recently played stations are skipped by "next", so it moves on instead of bouncing between two favourites.
  const recent: string[] = [];
  const RECENT_LIMIT = 30;

  async function playStation(s: StationLite, p: Place) {
    pickToken++;
    if (offlineBlocked()) return;
    d.card.reveal?.();
    track('play_station', { country: s.cc, place: p.name });
    recent.splice(0, recent.length, ...recent.filter((id) => id !== s.id), s.id);
    if (recent.length > RECENT_LIMIT) recent.shift();
    playingPlace = p;
    view?.setPlaying(p);
    d.library.remember(toSaved(s));
    await player.play(s);
  }

  async function next() {
    const state = player.getState();
    if (state.kind === 'idle' || !playingPlace) return;
    const current = playingPlace;
    const match = stationMatch();
    const query = {
      currentId: state.station.id,
      currentPlace: current,
      // In learn or style mode search only places that have it (the nearest 60 of any kind may have none).
      places: match ? places.filter((p) => placeWeight(p) > 0 || p.id === current.id) : places,
      stationsOf: (cc: string) => d.shards.get(cc),
      filter: match,
    };
    // Prefer stations not heard recently; when everything around was played, start a new round.
    const found = await findNextNearby({ ...query, isBlocked: (id) => d.blacklist.has(id) || recent.includes(id) })
      ?? await findNextNearby({ ...query, isBlocked: (id) => d.blacklist.has(id) });
    if (!found) { showToast(refs.stage, learnCode ? t('learn.noNext', { langPrep }) : styleId ? t('style.noNext', { style: styleName() }) : t('player.noNext')); return; }
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
      { play: togglePlay, pause: () => player.pause(), next: () => { void next(); } },
    );
    if (tab === 'here' && list && selected && list.placeId === selected.id) list.handle.setPlaying(station?.id ?? null);
    if (tab !== 'here') saved?.setPlaying(station?.id ?? null);
    void updateCard(station);
  });

  // Panel tabs: the selected place's list, or the saved favorites / history.
  function showTab(name: PanelTab) {
    tab = name;
    for (const b of refs.tabs) b.classList.toggle('is-active', b.dataset.tab === name);
  }
  const savedSub = (item: SavedStation) => placeLabel(byId.get(item.placeId) ?? null) || countryName(item.cc, i18n.locale);
  function renderTab() {
    if (tab === 'here') {
      saved = null;
      if (selected) void renderList(selected, true);
      else {
        renderListMessage(refs.panelBody, t('panel.empty'));
        if (countries.length) refs.panelBody.append(renderBrowseCountries(i18n, countries, browseStylesProps()));
      }
      return;
    }
    list = null;
    const st = player.getState();
    const items = tab === 'favorites' ? d.library.favorites() : d.library.history();
    saved = renderSavedList(refs.panelBody, i18n, {
      items,
      focus: focusStar ?? undefined,
      playingId: st.kind === 'idle' ? null : st.station.id,
      empty: t(tab === 'favorites' ? 'library.emptyFavorites' : 'library.emptyHistory'),
      sub: savedSub,
      onPick: (item) => { if (d.narrow?.()) { closeSheet(); nav.set('globe'); } void playSaved(item); },
      isFavorite: (id) => d.library.isFavorite(id),
      onToggleFavorite: (item) => {
        focusStar = { id: item.id, index: items.findIndex((x) => x.id === item.id) };
        d.library.toggleFavorite(item);
      },
    });
    focusStar = null;
  }
  function setTab(name: PanelTab) {
    showTab(name);
    refs.left.classList.add('is-open');
    renderTab();
  }
  for (const b of refs.tabs) b.addEventListener('click', () => setTab(b.dataset.tab as PanelTab));
  // Phone: bottom menu, search screen and the list sheet.
  const closeSearch = () => refs.root.classList.remove('is-searching');
  const closeSheet = () => refs.left.classList.remove('is-open', 'is-full');
  const nav = createMobileNav(refs.navButtons, {
    onGlobe: () => { closeSearch(); closeSheet(); nav.set('globe'); },
    onSearch: () => { closeSheet(); refs.root.classList.add('is-searching'); refs.searchInput.focus(); nav.set('search'); },
    onFavorites: () => { closeSearch(); setTab('favorites'); nav.set('favorites'); },
    onLearn: () => { closeSearch(); refs.learnButton.click(); },
  });
  refs.closePanel.addEventListener('click', () => nav.set('globe'));
  // Tablet: the place card is a drawer on the right.
  const setPlaceDrawer = (open: boolean) => {
    refs.placeCard.classList.toggle('is-open', open);
    refs.placeToggle.setAttribute('aria-expanded', String(open));
  };
  refs.placeToggle.addEventListener('click', () => setPlaceDrawer(!refs.placeCard.classList.contains('is-open')));
  // Escape clears the selected place, unless something on top of the page takes it first: a typing field,
  // an open menu or dialog (they close themselves on the same key), or the place drawer (closed below).
  document.addEventListener('keydown', (e) => {
    // Only where the list with its close button is in view: the Here tab on a wide screen (phones close the sheet).
    if (e.key !== 'Escape' || e.defaultPrevented || !selected || tab !== 'here' || d.narrow?.()) return;
    if (refs.placeCard.classList.contains('is-open')) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('[role="menu"], [role="dialog"], .learn-pop, .search-pop')) return;
    clearSelection(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && refs.placeCard.classList.contains('is-open')) setPlaceDrawer(false); });
  attachSheetDrag(refs.left, refs.sheetHandle, { expandable: true, onClose: () => { closeSheet(); nav.set('globe'); } });
  d.library.subscribe(() => {
    if (tab !== 'here') renderTab();
    list?.handle.refreshFavorites();
    renderBar();
  });

  async function playSaved(item: SavedStation) {
    if (offlineBlocked()) return;
    const my = ++pickToken;
    const place = byId.get(item.placeId);
    let station: StationLite | undefined;
    try {
      station = (await d.shards.get(item.cc)).find((s) => s.id === item.id);
    } catch {
      if (my === pickToken) showToast(refs.stage, t('list.loadError'));
      return;
    }
    if (my !== pickToken) return;
    if (!station || !place) { showToast(refs.stage, t('library.gone')); return; }
    view?.flyTo(place.lat, place.lon);
    await playStation(station, place);
  }

  async function surprise() {
    track('surprise');
    const found = await pickSurprise({
      places,
      weightOf: placeWeight,
      stationsOf: (cc) => d.shards.get(cc),
      isBlocked: (id) => d.blacklist.has(id) || recent.includes(id),
      filter: stationMatch(),
    });
    if (!found) { showToast(refs.stage, t('surprise.none')); return; }
    view?.flyTo(found.place.lat, found.place.lon);
    void selectPlace(found.place);
    if (d.narrow?.()) closeSheet();
    await playStation(found.station, found.place);
  }
  refs.surpriseButton.addEventListener('click', () => { void surprise(); });

  async function shareCurrent() {
    const s = player.getState();
    if (s.kind === 'idle') return;
    const result = await d.share({
      url: buildShareUrl(d.location.href, s.station),
      title: s.station.name,
      text: t('share.text', { station: s.station.name, place: placeLabel(playingPlace) }),
    });
    track('share', { method: result });
    if (result === 'copied') showToast(refs.stage, t('share.copied'));
    if (result === 'failed') showToast(refs.stage, t('share.failed'));
  }

  // A shared link (?station=...) opens a card; sound starts only after the "Listen" tap.
  async function openShared() {
    // Read the link before cleaning the address: d.location is live in the browser.
    const search = d.location.search;
    if (!new URLSearchParams(search).has('station')) return;
    const params = parseShareParams(search);
    d.replaceUrl(stripShareParams(d.location.href));
    if (!params) { showToast(refs.stage, t('share.gone')); return; }
    const found = await resolveShared(params, { places, shards: d.shards, fetchFn: d.fetchFn });
    if (!found) { showToast(refs.stage, t('share.gone')); return; }
    view?.flyTo(found.place.lat, found.place.lon);
    void selectPlace(found.place);
    if (d.narrow?.()) refs.left.classList.remove('is-open');
    d.installUi?.setContext('share');
    let tz = '';
    try { tz = (await d.shards.info(found.place.cc)).get(found.place.id)?.tz ?? ''; } catch { tz = ''; }
    const where = placeLabel(found.place);
    const line = isValidTimeZone(tz) ? t('share.placeTime', { place: where, time: formatClock(tz, d.now(), i18n.locale) }) : where;
    showShareCard(refs.stage, i18n, { name: found.station.name, flag: d.flagUrl(found.place.cc), line }, {
      onListen: () => { d.installUi?.setContext('normal'); void playStation(found.station, found.place); },
      onClose: () => { d.installUi?.setContext('normal'); },
    });
  }

  let mountToken = 0;
  async function mount(m: ViewMode) {
    const token = ++mountToken;
    view?.destroy();
    view = null;
    refs.map.replaceChildren();
    mode = m;
    for (const b of refs.viewButtons) b.setAttribute('aria-pressed', String(b.dataset.view === m));
    const v = await d.factories[m](refs.map, source, { onSelect: (p) => { void selectPlace(p); }, label, detail });
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
    if (e.code !== 'Space' || e.defaultPrevented) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('input, textarea, select, button, [contenteditable], [role="button"]')) return;
    e.preventDefault();
    togglePlay();
  });

  let picker: { update(): void } | null = null;
  const banner = createLearnBanner(refs.banner, i18n, () => learnState?.set(null));
  const styleBanner = createStyleBanner(refs.styleBanner, i18n, () => styleState?.set(null));
  let stylePicker: { update(): void } | null = null;

  // The highlighted layer follows the active mode: places weighted by the language or by the style.
  function rebuildLayer() {
    if (!base) return;
    layer = layered(base, learnCode || (styleId && styleIndex) ? createClusterer(places, placeWeight) : null);
  }

  const ensureStyles = () => (styleLoad ??= d.loadStyles()
    .then((idx) => (styleIndex = idx))
    .catch(() => { styleLoad = null; return null; }));

  function styleSummary(id: string) {
    const per = styleIndex?.get(id);
    if (!per) return null;
    let stations = 0;
    const ccs = new Set<string>();
    for (const [placeId, n] of per) {
      stations += n;
      const p = byId.get(placeId);
      if (p) ccs.add(p.cc);
    }
    return { name: genreById(id)?.name ?? id, stations, countries: ccs.size };
  }

  let styleToken = 0;
  async function applyStyle(id: string | null) {
    styleId = id;
    const my = ++styleToken;
    if (id) learnState?.set(null);
    stylePicker?.update();
    if (id && !styleIndex) {
      const idx = await ensureStyles();
      if (my !== styleToken) return;
      if (!idx) { showToast(refs.stage, t('style.error')); styleState?.set(null); return; }
    }
    if (id && !styleIndex?.get(id)?.size) { showToast(refs.stage, t('style.none', { style: styleName() })); styleState?.set(null); return; }
    rebuildLayer();
    view?.refresh();
    styleBanner.show(id ? styleSummary(id) : null);
    renderBar();
    if (selected) void renderList(selected, false);
  }

  // The biggest styles (by stations of the places that list them) as buttons in the browse block.
  function topStyles(n = 8) {
    const counts = new Map<string, number>();
    for (const p of places) for (const id of p.styles ?? []) counts.set(id, (counts.get(id) ?? 0) + p.count);
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => ({ id, name: genreById(id)?.name ?? id }));
  }
  const browseStylesProps = (fromSearch = false) => ({
    ids: browseStyles,
    onPick: (id: string) => { if (fromSearch) { searchBox?.close(); closeSearch(); } styleState?.set(id); },
  });
  function applyLearn(code: string | null) {
    learnCode = code;
    const entry = code ? languages.find((e) => e.code === code) ?? null : null;
    // Russian needs the prepositional case; other languages use the language name as is ("in Spanish").
    langPrep = entry ? (i18n.locale === 'ru' ? prepositional(lowerFirst(entry.name, i18n.locale)) : entry.name) : '';
    if (code) styleState?.set(null);
    rebuildLayer();
    view?.refresh();
    picker?.update();
    nav.setLearning(!!entry);
    banner.show(entry);
    d.card.setLearn(code, (c) => learnState?.set(c));
    renderBar();
    if (selected) void renderList(selected, false);
  }

  // Cookie settings: only when the consent snippet is on the page (production build with a GA id).
  const consent = (globalThis as { globeConsent?: { open(): void } }).globeConsent;
  if (consent) {
    (refs.cookiesButton.closest('.cookies-link') as HTMLElement).hidden = false;
    refs.cookiesButton.addEventListener('click', () => consent.open());
  }
  const handle: AppHandle = { mode: () => mode, selectPlace, next, learn: (code) => learnState?.set(code), style: (id) => styleState?.set(id), surprise, tab: setTab };
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
  byId = new Map(places.map((p) => [p.id, p]));
  countries = topCountries(places);
  browseStyles = topStyles();
  if (tab === 'here' && !selected) renderTab();
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
  styleState = createChoiceState(d.storage, (id) => !!genreById(id), STYLE_KEY);
  stylePicker = createStylePicker(i18n, refs.styleButton, {
    styles: async () => {
      const idx = await ensureStyles();
      if (!idx) return null;
      return GENRES.map((g) => ({ id: g.id, name: g.name, group: g.group, stations: [...(idx.get(g.id)?.values() ?? [])].reduce((sum, n) => sum + n, 0) }));
    },
    current: () => styleState!.get(),
    onPick: (id) => styleState!.set(id === styleState!.get() ? null : id),
  });
  styleState.subscribe((id) => { void applyStyle(id); });
  if (styleState.get()) void applyStyle(styleState.get());
  const searchIndex = d.createSearch(places);
  searchBox = createSearchBox(refs.searchInput, i18n, {
    search: (q) => { track('search', { search_term: q }); return searchIndex.search(q); },
    prefetch: () => searchIndex.prefetch?.(),
    // On a wide screen the Here tab already shows the block when nothing is selected: no duplicate under the field.
    browse: () => (countries.length && (d.narrow?.() || !refs.panelBody.querySelector('.browse')) ? renderBrowseCountries(i18n, countries, browseStylesProps(true)) : null),
    placeLabel: (p) => placeLabel(p),
    onPlace: (p) => { closeSearch(); nav.set('globe'); view?.flyTo(p.lat, p.lon); void selectPlace(p); },
    onStation: async (h) => {
      closeSearch();
      nav.set('globe');
      if (offlineBlocked()) return;
      const my = ++pickToken;
      view?.flyTo(h.place.lat, h.place.lon);
      void selectPlace(h.place);
      if (d.narrow?.()) closeSheet();
      let station: StationLite | undefined;
      try { station = (await d.shards.get(h.place.cc)).find((s) => s.placeId === h.place.id && s.name === h.name); } catch {
        if (my === pickToken) showToast(refs.stage, t('list.loadError'));
        return;
      }
      if (my !== pickToken) return;
      if (!station) { showToast(refs.stage, t('library.gone')); return; }
      await playStation(station, h.place);
    },
  });
  await mountSafe(initialMode({ saved: read(MODE_STORAGE_KEY), hasWebGL: d.hasWebGL, narrowTouch: d.narrowTouch }));
  await openShared();
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
