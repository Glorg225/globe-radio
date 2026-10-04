import ru from '../../locales/ru.json';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config';
import { applyDirection, createI18n, resolveLocale, type Messages } from '../i18n/i18n';
import { safeStorage } from '../i18n/storage';
import { renderShell } from '../ui/shell';

const catalogs: Record<string, Messages> = { ru };
const locale = resolveLocale(location.search, safeStorage(), navigator.languages, SUPPORTED_LOCALES, DEFAULT_LOCALE);
const i18n = createI18n(locale, catalogs[locale]);
applyDirection(document, locale);
renderShell(document.getElementById('app')!, i18n);
