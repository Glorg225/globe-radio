// Only the URLs are bundled (a few KB); each SVG is fetched when its flag is shown.
const urls = import.meta.glob('../../node_modules/flag-icons/flags/4x3/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const byCode = new Map(Object.entries(urls).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]));

export function flagUrl(cc: string): string | null {
  return byCode.get(cc.toLowerCase()) ?? null;
}
