import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { buildManifest, THEME_COLOR } from '../src/pwa/manifest';

const pngSize = (path: string) => { const b = readFileSync(path); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('manifest: name from the one config, standalone, dark theme, scope = site path', () => {
  const m = buildManifest('/globe-radio/');
  expect(m).toMatchObject({
    name: 'Globe Radio', short_name: 'Globe Radio', lang: 'en', display: 'standalone', orientation: 'portrait',
    start_url: '/globe-radio/', scope: '/globe-radio/', theme_color: THEME_COLOR, background_color: THEME_COLOR,
  });
  expect(THEME_COLOR).toBe('#0A0F1E');
  expect(m.icons.filter((i) => i.purpose === 'maskable')).toHaveLength(1);
});

test('every manifest icon and the apple touch icon exist with the declared size', () => {
  for (const i of buildManifest('/').icons) {
    expect(pngSize(`public/${i.src}`)).toEqual(i.sizes.split('x').map(Number));
  }
  expect(pngSize('public/icons/apple-touch-icon.png')).toEqual([180, 180]);
});

test('index.html: apple touch icon, standalone meta tags', () => {
  const html = readFileSync('index.html', 'utf8');
  expect(html).toContain('rel="apple-touch-icon" href="/icons/apple-touch-icon.png"');
  expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
  expect(html).toContain('name="apple-mobile-web-app-title"');
});
