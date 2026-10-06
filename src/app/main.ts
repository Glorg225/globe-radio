import ru from '../../locales/ru.json';
import { loadPlaces } from '../data/places';
import { createShardStore } from '../data/shards';
import { applyDirection, createI18n, resolveLocale, type Messages } from '../i18n/i18n';
import { safeStorage } from '../i18n/storage';
import { detectWebGL, measureFps } from '../map/choose-mode';
import { renderStarfield } from '../map/starfield';
import { flagUrl } from '../place-card/flag';
import { createPlaceCard } from '../place-card/place-card';
import { findArticle } from '../place-card/wiki';
import { createWikiCache } from '../place-card/wiki-cache';
import { createLibrary } from '../library/library';
import { createBlacklist } from '../player/blacklist';
import { loadHls } from '../player/hls-loader';
import { createPlayer } from '../player/player';
import { resolveStreamUrl } from '../player/stream-url';
import { createSleepTimer } from '../player/sleep-timer';
import { createSearchIndex } from '../search/search-index';
import { shareStation } from '../share/share';
import { registerSW } from 'virtual:pwa-register';
import { createNetworkStatus } from '../pwa/network';
import { createInstall } from '../pwa/install';
import { setupUpdates } from '../pwa/update';
import { createInstallUi } from '../ui/install-ui';
import { bindKeyboardInset } from '../ui/keyboard-inset';
import { bindNetBanner } from '../ui/net-banner';
import { renderShell } from '../ui/shell';
import { showActionToast } from '../ui/toast';
import { startApp } from './app';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config';

const catalogs: Record<string, Messages> = { ru };
const storage = safeStorage();
const locale = resolveLocale(location.search, storage, navigator.languages, SUPPORTED_LOCALES, DEFAULT_LOCALE);
const i18n = createI18n(locale, catalogs[locale]);
applyDirection(document, locale);
const refs = renderShell(document.getElementById('app')!, i18n);
renderStarfield(refs.stars);
const network = createNetworkStatus(window);
bindNetBanner(refs.netBanner, i18n, network);
bindKeyboardInset(window, refs.root);
const narrowQuery = matchMedia('(max-width: 760px)');
const installUi = createInstallUi({
  button: refs.installButton,
  host: refs.root,
  i18n,
  state: createInstall({ win: window, storage, userAgent: navigator.userAgent, standalone: matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true }),
  narrow: () => narrowQuery.matches,
});
setupUpdates({
  register: (o) => registerSW({ onNeedRefresh: o.onNeedRefresh }),
  show: (onUpdate) => { showActionToast(refs.stage, i18n.t('update.available'), { label: i18n.t('update.reload'), onClick: onUpdate }); },
});

const wikiCache = createWikiCache(storage);
const card = createPlaceCard(refs.placeCard, refs.stage, {
  i18n,
  storage,
  flagUrl,
  findArticle: (info) => findArticle(info, fetch, wikiCache),
  now: () => new Date(),
  userOffset: () => -new Date().getTimezoneOffset(),
});

const base = import.meta.env.BASE_URL;
const blacklist = createBlacklist(storage);
const audio = new Audio();
audio.preload = 'none';
const player = createPlayer({ audio, resolveUrl: (s) => resolveStreamUrl(s), loadHls, onFailure: (s) => blacklist.add(s.id) });
const sleep = createSleepTimer({ setGain: (g) => player.setGain(g), stop: () => player.pause() });
const coarse = matchMedia('(pointer: coarse)').matches;

void startApp({
  refs,
  i18n,
  storage,
  loadPlaces: () => loadPlaces(base),
  shards: createShardStore(base),
  factories: {
    globe: (el, c, cb) => import('../map/globe3d').then((m) => m.createGlobe3D(el, c, cb)),
    map: (el, c, cb) => import('../map/map2d').then((m) => m.createMap2D(el, c, cb)),
  },
  player,
  blacklist,
  card,
  hasWebGL: detectWebGL(),
  narrowTouch: matchMedia('(max-width: 760px) and (pointer: coarse)').matches,
  measureFps: () => measureFps(3000),
  mediaSession: 'mediaSession' in navigator ? navigator.mediaSession : undefined,
  library: createLibrary(storage),
  sleep,
  share: (o) => shareStation({ ...o, preferShare: coarse, nav: navigator }),
  createSearch: (places) => createSearchIndex(base, places, i18n.locale),
  location,
  replaceUrl: (url) => history.replaceState(null, '', url),
  flagUrl,
  now: () => new Date(),
  network,
  installUi,
  narrow: () => narrowQuery.matches,
});
