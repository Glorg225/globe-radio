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

export function measureFps(
  durationMs: number,
  raf: (cb: FrameRequestCallback) => number = requestAnimationFrame,
  now: () => number = () => performance.now(),
): Promise<number> {
  return new Promise((resolve) => {
    const start = now();
    let frames = 0;
    const tick = () => {
      frames++;
      const elapsed = now() - start;
      if (elapsed >= durationMs) resolve((frames * 1000) / elapsed);
      else raf(tick);
    };
    raf(tick);
  });
}
