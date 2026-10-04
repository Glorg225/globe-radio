import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { StationLite } from '../src/data/shards';
import { createPlayer, STREAM_TIMEOUT_MS, type AudioLike, type HlsCtor } from '../src/player/player';

class FakeAudio extends EventTarget implements AudioLike {
  src = ''; volume = 1; muted = false; paused = true; native = false;
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute(n: string) { if (n === 'src') this.src = ''; }
  load() {}
  canPlayType(t: string) { return this.native && t === 'application/vnd.apple.mpegurl' ? 'maybe' : ''; }
  fire(t: string) { this.dispatchEvent(new Event(t)); }
}

interface FakeHls { url?: string; handlers: ((e: string, d: { fatal?: boolean }) => void)[] }
const st = (id: string, hls = false): StationLite =>
  ({ id, name: id, url: `https://${id}`, placeId: 'p', cc: 'DE', langs: [], tags: [], votes: 0, clicks: 0, favicon: '', hls });

let audio: FakeAudio;
let failures: string[];
let hlsInstances: FakeHls[];
const Hls = class {
  static Events = { ERROR: 'hlsError' };
  static isSupported() { return true; }
  url?: string;
  handlers: ((e: string, d: { fatal?: boolean }) => void)[] = [];
  constructor() { hlsInstances.push(this); }
  loadSource(u: string) { this.url = u; }
  attachMedia() {}
  on(_e: string, cb: (e: string, d: { fatal?: boolean }) => void) { this.handlers.push(cb); }
  destroy() {}
} as unknown as HlsCtor;

const make = (resolveUrl = async (s: StationLite) => s.url) =>
  createPlayer({ audio, resolveUrl, loadHls: async () => Hls, onFailure: (s) => failures.push(s.id) });

beforeEach(() => { vi.useFakeTimers(); audio = new FakeAudio(); failures = []; hlsInstances = []; });
afterEach(() => vi.useRealTimers());

test('loading → playing on the playing event', async () => {
  const p = make();
  await p.play(st('a'));
  expect(p.getState()).toMatchObject({ kind: 'loading' });
  expect(audio.src).toBe('https://a');
  audio.fire('playing');
  expect(p.getState()).toMatchObject({ kind: 'playing', station: { id: 'a' } });
});

test('no sound within 8 s → error and failure reported once', async () => {
  const p = make();
  await p.play(st('a'));
  await vi.advanceTimersByTimeAsync(STREAM_TIMEOUT_MS);
  expect(STREAM_TIMEOUT_MS).toBe(8000);
  expect(p.getState()).toMatchObject({ kind: 'error', station: { id: 'a' } });
  expect(failures).toEqual(['a']);
});

test('a stall longer than 8 s while playing → error; a short stall recovers', async () => {
  const p = make();
  await p.play(st('a'));
  audio.fire('playing');
  audio.fire('waiting');
  await vi.advanceTimersByTimeAsync(5000);
  audio.fire('playing');
  await vi.advanceTimersByTimeAsync(5000);
  expect(p.getState().kind).toBe('playing');
  audio.fire('waiting');
  await vi.advanceTimersByTimeAsync(STREAM_TIMEOUT_MS);
  expect(p.getState().kind).toBe('error');
});

test('media error while loading → error', async () => {
  const p = make();
  await p.play(st('a'));
  audio.fire('error');
  expect(p.getState().kind).toBe('error');
  expect(failures).toEqual(['a']);
});

test('quick switch A → B: only B is current, A never fails (review focus 1)', async () => {
  let releaseA!: (u: string) => void;
  const p = make((s) => (s.id === 'a' ? new Promise<string>((r) => { releaseA = r; }) : Promise.resolve(s.url)));
  void p.play(st('a'));
  await p.play(st('b'));
  releaseA('https://a');
  await vi.advanceTimersByTimeAsync(0);
  expect(audio.src).toBe('https://b');
  audio.fire('playing');
  await vi.advanceTimersByTimeAsync(STREAM_TIMEOUT_MS * 2);
  expect(p.getState()).toMatchObject({ kind: 'playing', station: { id: 'b' } });
  expect(failures).toEqual([]);
});

test('HLS station uses hls.js when not natively supported; fatal error → error', async () => {
  const p = make();
  await p.play(st('h', true));
  expect(hlsInstances).toHaveLength(1);
  expect(hlsInstances[0].url).toBe('https://h');
  hlsInstances[0].handlers[0]('hlsError', { fatal: true });
  expect(p.getState().kind).toBe('error');
});

test('native HLS (Safari) plays through the audio element', async () => {
  audio.native = true;
  const p = make();
  await p.play(st('h', true));
  expect(hlsInstances).toHaveLength(0);
  expect(audio.src).toBe('https://h');
});

test('url resolution failure → error', async () => {
  const p = make(async () => { throw new Error('no https'); });
  await p.play(st('a'));
  expect(p.getState().kind).toBe('error');
});

test('pause and toggle back reconnects the live stream', async () => {
  const p = make();
  await p.play(st('a'));
  audio.fire('playing');
  p.toggle();
  expect(p.getState().kind).toBe('paused');
  expect(audio.paused).toBe(true);
  p.toggle();
  await vi.advanceTimersByTimeAsync(0);
  expect(p.getState().kind).toBe('loading');
});

test('volume is clamped and unsubscribed listeners are not called', async () => {
  const p = make();
  const seen: string[] = [];
  const off = p.subscribe((s) => seen.push(s.kind));
  p.setVolume(2);
  expect(audio.volume).toBe(1);
  p.setVolume(-1);
  expect(audio.volume).toBe(0);
  await p.play(st('a'));
  off();
  audio.fire('playing');
  expect(seen).toEqual(['loading']);
});

test('browser autoplay block (NotAllowedError) pauses without blaming the station', async () => {
  const p = make();
  audio.play = () => Promise.reject(new DOMException('needs a user gesture', 'NotAllowedError'));
  await p.play(st('a'));
  expect(p.getState()).toMatchObject({ kind: 'paused', station: { id: 'a' } });
  expect(failures).toEqual([]);
  await vi.advanceTimersByTimeAsync(STREAM_TIMEOUT_MS * 2);
  expect(p.getState().kind).toBe('paused');
  expect(failures).toEqual([]);
});

test('the 8 s no-sound timer starts when the stream is attached, not while the url is resolving', async () => {
  let release!: (u: string) => void;
  const p = make(() => new Promise<string>((r) => { release = r; }));
  void p.play(st('a'));
  await vi.advanceTimersByTimeAsync(STREAM_TIMEOUT_MS + 2000);
  expect(p.getState().kind).toBe('loading');
  release('https://a');
  await vi.advanceTimersByTimeAsync(STREAM_TIMEOUT_MS - 1);
  expect(p.getState().kind).toBe('loading');
  await vi.advanceTimersByTimeAsync(1);
  expect(p.getState().kind).toBe('error');
});
