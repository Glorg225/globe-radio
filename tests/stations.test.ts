import { expect, test } from 'vitest';
import { decode, dedupe, encode, toStation } from '../src/data/stations';
import type { RawStation } from '../src/data/types';

const centroids = { PT: [39.5, -8.0] as [number, number] };
const raw = (o: Partial<RawStation> = {}): RawStation => ({
  stationuuid: 'u1', name: '  Rádio Comercial ', url: 'https://a/stream', url_resolved: 'https://b/stream',
  favicon: 'https://a/ico.png', tags: 'Pop, Rock,pop,,news,talk,hits,extra', countrycode: 'pt',
  language: 'portuguese', languagecodes: 'pt', votes: 10, clickcount: 5, lastcheckok: 1, hls: 0,
  geo_lat: 38.72, geo_long: -9.14, state: 'Lisboa', ...o,
});

test('maps a good station', () => {
  expect(toStation(raw(), centroids)).toEqual({
    id: 'u1', name: 'Rádio Comercial', url: 'https://b/stream', lat: 38.72, lon: -9.14, approx: false,
    cc: 'PT', state: 'Lisboa', langs: ['pt'], tags: ['pop', 'rock', 'news', 'talk', 'hits'],
    votes: 10, clicks: 5, favicon: 'https://a/ico.png', hls: false,
  });
});
test('rejects http stream', () => expect(toStation(raw({ url_resolved: 'http://b/s' }), centroids)).toBeNull());
test('rejects empty url_resolved even if url is https', () => expect(toStation(raw({ url_resolved: '' }), centroids)).toBeNull());
test('rejects not-ok stations', () => expect(toStation(raw({ lastcheckok: 0 }), centroids)).toBeNull());
test('rejects empty name', () => expect(toStation(raw({ name: '   ' }), centroids)).toBeNull());
test('missing coords → country centroid, approx', () => {
  const s = toStation(raw({ geo_lat: null, geo_long: null }), centroids)!;
  expect([s.lat, s.lon, s.approx]).toEqual([39.5, -8.0, true]);
});
test('0,0 coords are treated as missing', () =>
  expect(toStation(raw({ geo_lat: 0, geo_long: 0 }), centroids)!.approx).toBe(true));
test('out-of-range coords are treated as missing', () =>
  expect(toStation(raw({ geo_lat: 120, geo_long: 10 }), centroids)!.approx).toBe(true));
test('no coords and unknown country → dropped', () =>
  expect(toStation(raw({ geo_lat: null, geo_long: null, countrycode: 'ZZ' }), centroids)).toBeNull());
test('http favicon is dropped (mixed content)', () =>
  expect(toStation(raw({ favicon: 'http://a/ico.png' }), centroids)!.favicon).toBe(''));
test('dedupe keeps first by id', () => {
  const a = toStation(raw(), centroids)!;
  const b = { ...a, name: 'dup' };
  expect(dedupe([a, b])).toEqual([a]);
});
test('encode/decode roundtrip', () => {
  const s = toStation(raw({ hls: 1 }), centroids)!;
  expect(decode(encode(s))).toEqual(s);
});
