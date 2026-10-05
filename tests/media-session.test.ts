import { afterEach, expect, test, vi } from 'vitest';
import { updateMediaSession } from '../src/player/media-session';

afterEach(() => vi.unstubAllGlobals());

test('sets metadata, state and action handlers', () => {
  vi.stubGlobal('MediaMetadata', class { constructor(public init: unknown) {} });
  const ms = { metadata: null as unknown, playbackState: 'none', setActionHandler: vi.fn() };
  const h = { play: vi.fn(), pause: vi.fn(), next: vi.fn() };
  updateMediaSession(ms as unknown as MediaSession, { title: 'Fado', artist: 'Лиссабон, Португалия', artwork: 'https://i' }, 'playing', h);
  expect(ms.playbackState).toBe('playing');
  expect((ms.metadata as { init: { title: string } }).init.title).toBe('Fado');
  expect(ms.setActionHandler).toHaveBeenCalledWith('nexttrack', expect.any(Function));
});

test('missing API or unsupported action does not throw', () => {
  expect(() => updateMediaSession(undefined, null, 'none', { play() {}, pause() {}, next() {} })).not.toThrow();
  const ms = { metadata: null, playbackState: 'none', setActionHandler: () => { throw new Error('unsupported'); } };
  expect(() => updateMediaSession(ms as unknown as MediaSession, null, 'none', { play() {}, pause() {}, next() {} })).not.toThrow();
});
