import type { StationLite } from '../data/shards';

export type PlayerState =
  | { kind: 'idle' }
  | { kind: 'loading' | 'playing' | 'paused' | 'error'; station: StationLite };

export interface AudioLike extends EventTarget {
  src: string; volume: number; muted: boolean;
  play(): Promise<void>; pause(): void; removeAttribute(name: string): void; load(): void; canPlayType(type: string): string;
}
export interface HlsLike {
  loadSource(url: string): void; attachMedia(media: AudioLike): void;
  on(event: string, cb: (event: string, data: { fatal?: boolean }) => void): void; destroy(): void;
}
export interface HlsCtor { new (): HlsLike; isSupported(): boolean; Events: { ERROR: string } }
export interface PlayerDeps {
  audio: AudioLike;
  resolveUrl(s: StationLite): Promise<string>;
  loadHls(): Promise<HlsCtor>;
  onFailure(s: StationLite): void;
  timeoutMs?: number;
}
export interface Player {
  play(s: StationLite): Promise<void>; pause(): void; toggle(): void;
  setVolume(v: number): void; setMuted(m: boolean): void;
  /** Extra 0..1 multiplier on the volume (the sleep timer fade). */
  setGain(g: number): void;
  getState(): PlayerState; subscribe(l: (s: PlayerState) => void): () => void;
}

export const STREAM_TIMEOUT_MS = 8000;
const isHlsUrl = (u: string) => /\.m3u8(\?|$)/i.test(u);

export function createPlayer(deps: PlayerDeps): Player {
  const { audio } = deps;
  const timeoutMs = deps.timeoutMs ?? STREAM_TIMEOUT_MS;
  const listeners = new Set<(s: PlayerState) => void>();
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  let volume = 1;
  let gain = 1;
  let state: PlayerState = { kind: 'idle' };
  let token = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hls: HlsLike | null = null;

  const set = (s: PlayerState) => { state = s; for (const l of listeners) l(s); };
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const arm = (t: number) => { clearTimer(); timer = setTimeout(() => { if (t === token) fail(); }, timeoutMs); };

  function teardown() {
    clearTimer();
    hls?.destroy();
    hls = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }

  function fail() {
    if (state.kind === 'idle') return;
    const station = state.station;
    token++;
    teardown();
    set({ kind: 'error', station });
    deps.onFailure(station);
  }

  audio.addEventListener('playing', () => {
    if (state.kind === 'loading' || state.kind === 'playing') { clearTimer(); set({ kind: 'playing', station: state.station }); }
  });
  audio.addEventListener('waiting', () => { if (state.kind === 'playing') arm(token); });
  audio.addEventListener('error', () => { if (state.kind === 'loading' || state.kind === 'playing') fail(); });
  // A live stream never ends on its own: 'ended' means the server closed the connection.
  audio.addEventListener('ended', () => { if (state.kind === 'loading' || state.kind === 'playing') fail(); });
  // Paused from outside (headphones unplugged, OS interruption): reflect it so the next press resumes.
  audio.addEventListener('pause', () => {
    if (state.kind !== 'playing') return;
    const station = state.station;
    token++;
    clearTimer();
    set({ kind: 'paused', station });
  });

  async function play(station: StationLite) {
    const t = ++token;
    teardown();
    set({ kind: 'loading', station });
    try {
      const url = await deps.resolveUrl(station);
      if (t !== token) return;
      if ((station.hls || isHlsUrl(url)) && !audio.canPlayType('application/vnd.apple.mpegurl')) {
        const Hls = await deps.loadHls();
        if (t !== token) return;
        if (!Hls.isSupported()) { fail(); return; }
        const h = new Hls();
        hls = h;
        h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal && t === token) fail(); });
        h.loadSource(url);
        h.attachMedia(audio);
      } else {
        audio.src = url;
      }
      // The 8 s "no sound" window starts once the stream is attached (URL resolution has its own budget).
      arm(t);
      await audio.play();
    } catch (e) {
      if (t !== token) return;
      // Autoplay blocked: the station is fine, the browser wants a user gesture first.
      if (e instanceof DOMException && e.name === 'NotAllowedError') pause();
      else fail();
    }
  }

  function pause() {
    if (state.kind === 'loading' || state.kind === 'playing') {
      const station = state.station;
      token++;
      teardown();
      set({ kind: 'paused', station });
    }
  }

  return {
    play,
    pause,
    toggle() {
      if (state.kind === 'loading' || state.kind === 'playing') pause();
      else if (state.kind === 'paused' || state.kind === 'error') void play(state.station);
    },
    setVolume(v) { volume = clamp(v); audio.volume = volume * gain; },
    setGain(g) { gain = clamp(g); audio.volume = volume * gain; },
    setMuted(m) { audio.muted = m; },
    getState: () => state,
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
