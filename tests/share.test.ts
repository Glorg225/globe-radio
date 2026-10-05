import { expect, test, vi } from 'vitest';
import type { Place } from '../src/data/places';
import type { ShardStore, StationLite } from '../src/data/shards';
import { shareStation } from '../src/share/share';
import { buildShareUrl, parseShareParams, resolveShared, stripShareParams } from '../src/share/share-link';

const ID = '96062a7b-0601-11e8-ae97-52543be04c81';
const place: Place = { id: 'c:1', lat: 0, lon: 0, kind: 'exact', cc: 'PT', nameRu: 'Лиссабон', name: 'Lisbon', count: 1, pop: 1 };
const station: StationLite = { id: ID, name: 'Fado', url: 'https://x', placeId: 'c:1', cc: 'PT', langs: [], tags: [], votes: 0, clicks: 0, favicon: '', hls: false };
const shards = (list: StationLite[]): ShardStore => ({ get: vi.fn(async () => list), info: vi.fn(async () => new Map()) });

test('share url keeps the page path and replaces other parameters', () => {
  expect(buildShareUrl('https://u.github.io/globe-radio/?lang=ru#x', station))
    .toBe(`https://u.github.io/globe-radio/?station=${ID}&c=PT`);
});

test('parse share params validates id and country', () => {
  expect(parseShareParams(`?station=${ID}&c=PT`)).toEqual({ id: ID, cc: 'PT' });
  expect(parseShareParams(`?station=${ID}`)).toEqual({ id: ID, cc: null });
  expect(parseShareParams(`?station=${ID}&c=xx1`)).toEqual({ id: ID, cc: null });
  expect(parseShareParams('?station=<script>')).toBeNull();
  expect(parseShareParams('?lang=ru')).toBeNull();
});

test('strip share params leaves other parameters', () =>
  expect(stripShareParams(`https://a/b/?station=${ID}&c=PT&lang=ru`)).toBe('https://a/b/?lang=ru'));

test('resolves via the country file', async () => {
  expect(await resolveShared({ id: ID, cc: 'PT' }, { places: [place], shards: shards([station]) })).toEqual({ station, place });
});

test('without a country asks Radio Browser for it', async () => {
  const f = vi.fn(async () => new Response(JSON.stringify([{ countrycode: 'PT' }])));
  const r = await resolveShared({ id: ID, cc: null }, { places: [place], shards: shards([station]), fetchFn: f as unknown as typeof fetch, mirrors: ['m1'] });
  expect(r).toEqual({ station, place });
  expect((f.mock.calls[0] as unknown[])[0]).toBe(`https://m1/json/stations/byuuid/${ID}`);
});

test('station gone from the data, or lookup failure → null (review focus 1)', async () => {
  expect(await resolveShared({ id: ID, cc: 'PT' }, { places: [place], shards: shards([]) })).toBeNull();
  const down = (async () => { throw new Error('net'); }) as unknown as typeof fetch;
  expect(await resolveShared({ id: ID, cc: null }, { places: [place], shards: shards([station]), fetchFn: down, mirrors: ['m1'] })).toBeNull();
  const broken: ShardStore = { get: async () => { throw new Error('net'); }, info: async () => new Map() };
  expect(await resolveShared({ id: ID, cc: 'PT' }, { places: [place], shards: broken })).toBeNull();
});

const opts = { url: 'https://x', title: 'Fado', text: 'Слушаю «Fado» — Лиссабон' };

test('phones use the system share sheet', async () => {
  const share = vi.fn(async () => {});
  expect(await shareStation({ ...opts, preferShare: true, nav: { share } })).toBe('shared');
  expect(share).toHaveBeenCalledWith({ url: 'https://x', title: 'Fado', text: 'Слушаю «Fado» — Лиссабон' });
});

test('closing the share sheet is not an error and does not copy (review focus 2)', async () => {
  const writeText = vi.fn(async () => {});
  const share = vi.fn(async () => { throw new DOMException('cancel', 'AbortError'); });
  expect(await shareStation({ ...opts, preferShare: true, nav: { share, clipboard: { writeText } } })).toBe('cancelled');
  expect(writeText).not.toHaveBeenCalled();
});

test('desktop copies the link; copy failure is reported', async () => {
  const writeText = vi.fn(async () => {});
  expect(await shareStation({ ...opts, preferShare: false, nav: { share: vi.fn(), clipboard: { writeText } } })).toBe('copied');
  expect(writeText).toHaveBeenCalledWith('https://x');
  expect(await shareStation({ ...opts, preferShare: false, nav: { clipboard: { writeText: async () => { throw new Error('denied'); } } } })).toBe('failed');
  expect(await shareStation({ ...opts, preferShare: false, nav: {} })).toBe('failed');
});

test('share sheet error other than cancel falls back to copying', async () => {
  const writeText = vi.fn(async () => {});
  const share = vi.fn(async () => { throw new DOMException('no', 'NotAllowedError'); });
  expect(await shareStation({ ...opts, preferShare: true, nav: { share, clipboard: { writeText } } })).toBe('copied');
});
