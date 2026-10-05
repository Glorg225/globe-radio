import ru from '../../locales/ru.json';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config';
import { applyDirection, createI18n, resolveLocale, type Messages } from '../i18n/i18n';
import { safeStorage } from '../i18n/storage';
import { renderShell } from '../ui/shell';
import { loadStations } from '../data/load';

const catalogs: Record<string, Messages> = { ru };
const locale = resolveLocale(location.search, safeStorage(), navigator.languages, SUPPORTED_LOCALES, DEFAULT_LOCALE);
const i18n = createI18n(locale, catalogs[locale]);
applyDirection(document, locale);
const refs = renderShell(document.getElementById('app')!, i18n);

refs.status.textContent = i18n.t('data.loading');
loadStations(import.meta.env.BASE_URL)
  .then((stations) => {
    refs.status.textContent = '';
    // Temporary debug handle until Plan 2 mounts the map.
    (window as unknown as { __stations: unknown }).__stations = stations;
  })
  .catch((e) => {
    console.error(e);
    refs.status.textContent = i18n.t('data.error');
  });
