import ru from '../../locales/ru.json';
import { loadPlaces } from '../data/places';
import { createShardStore } from '../data/shards';
import { applyDirection, createI18n, resolveLocale, type Messages } from '../i18n/i18n';
import { safeStorage } from '../i18n/storage';
import { detectWebGL, measureFps } from '../map/choose-mode';
import { renderStarfield } from '../map/starfield';
import { createBlacklist } from '../player/blacklist';
import { loadHls } from '../player/hls-loader';
import { createPlayer } from '../player/player';
import { resolveStreamUrl } from '../player/stream-url';
import { renderShell } from '../ui/shell';
import { startApp } from './app';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config';

const catalogs: Record<string, Messages> = { ru };
const storage = safeStorage();
const locale = resolveLocale(location.search, storage, navigator.languages, SUPPORTED_LOCALES, DEFAULT_LOCALE);
const i18n = createI18n(locale, catalogs[locale]);
applyDirection(document, locale);
const refs = renderShell(document.getElementById('app')!, i18n);
renderStarfield(refs.stars);

const base = import.meta.env.BASE_URL;
const blacklist = createBlacklist(storage);
const audio = new Audio();
audio.preload = 'none';
const player = createPlayer({ audio, resolveUrl: (s) => resolveStreamUrl(s), loadHls, onFailure: (s) => blacklist.add(s.id) });

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
  hasWebGL: detectWebGL(),
  narrowTouch: matchMedia('(max-width: 760px) and (pointer: coarse)').matches,
  measureFps: () => measureFps(3000),
  mediaSession: 'mediaSession' in navigator ? navigator.mediaSession : undefined,
});
