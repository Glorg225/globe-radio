import { expect, test } from 'vitest';
import { SW_GLOB_IGNORES, SW_NAVIGATE_DENYLIST } from '../src/pwa/sw-config';

const denied = (path: string) => SW_NAVIGATE_DENYLIST.some((re) => re.test(path));

test('the installed app never replaces SEO pages, the 404 page or data with the globe', () => {
  expect(denied('/globe-radio/radio/portugal/lisbon/')).toBe(true);
  expect(denied('/globe-radio/radio/')).toBe(true);
  expect(denied('/globe-radio/404.html')).toBe(true);
  expect(denied('/globe-radio/data/places.json')).toBe(true);
  expect(denied('/globe-radio/')).toBe(false);
  expect(SW_GLOB_IGNORES).toEqual(expect.arrayContaining(['data/**', 'radio/**', '404.html', 'sitemap.xml', 'robots.txt']));
});
