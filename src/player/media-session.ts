export interface SessionInfo { title: string; artist: string; artwork: string }

export function updateMediaSession(
  ms: MediaSession | undefined,
  info: SessionInfo | null,
  state: 'playing' | 'paused' | 'none',
  h: { play(): void; pause(): void; next(): void },
): void {
  if (!ms) return;
  try {
    ms.playbackState = state;
    if (!info) ms.metadata = null;
    else if (typeof MediaMetadata !== 'undefined') {
      ms.metadata = new MediaMetadata({ title: info.title, artist: info.artist, artwork: info.artwork ? [{ src: info.artwork, sizes: '96x96' }] : [] });
    }
  } catch { /* partial support */ }
  const actions: [MediaSessionAction, () => void][] = [['play', h.play], ['pause', h.pause], ['nexttrack', h.next]];
  for (const [action, fn] of actions) {
    try { ms.setActionHandler(action, fn); } catch { /* action not supported */ }
  }
}
