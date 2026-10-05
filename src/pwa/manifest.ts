import ru from '../../locales/ru.json';

export const THEME_COLOR = '#0A0F1E';

// Web app manifest; the app name comes from the one config (locales/ru.json, key app.name).
export function buildManifest(base: string) {
  return {
    name: ru['app.name'],
    short_name: ru['app.name'],
    description: ru['app.description'],
    lang: 'ru',
    dir: 'ltr' as const,
    start_url: base,
    scope: base,
    display: 'standalone' as const,
    orientation: 'portrait' as const,
    theme_color: THEME_COLOR,
    background_color: THEME_COLOR,
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ] as { src: string; sizes: string; type: string; purpose?: string }[],
  };
}
