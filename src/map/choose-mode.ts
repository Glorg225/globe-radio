export type ViewMode = 'globe' | 'map';
export const MODE_STORAGE_KEY = 'mapMode';

export function initialMode(o: { saved: string | null; hasWebGL: boolean; narrowTouch: boolean }): ViewMode {
  if (!o.hasWebGL) return 'map';
  if (o.saved === 'globe' || o.saved === 'map') return o.saved;
  return o.narrowTouch ? 'map' : 'globe';
}

export function detectWebGL(doc: Document = document): boolean {
  try {
    const c = doc.createElement('canvas') as HTMLCanvasElement;
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Browsers pause or throttle frames in hidden tabs, so the window restarts whenever the tab was hidden.
export function measureFps(
  durationMs: number,
  raf: (cb: FrameRequestCallback) => number = requestAnimationFrame,
  now: () => number = () => performance.now(),
  doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> = document,
): Promise<number> {
  return new Promise((resolve) => {
    let start: number | null = null;
    let frames = 0;
    const reset = () => { start = null; frames = 0; };
    doc.addEventListener('visibilitychange', reset);
    const tick = () => {
      if (doc.visibilityState !== 'visible') { reset(); raf(tick); return; }
      if (start === null) { start = now(); raf(tick); return; }
      frames++;
      const elapsed = now() - start;
      if (elapsed >= durationMs) {
        doc.removeEventListener('visibilitychange', reset);
        resolve((frames * 1000) / elapsed);
      } else {
        raf(tick);
      }
    };
    raf(tick);
  });
}
