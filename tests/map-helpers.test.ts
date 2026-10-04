import { expect, test } from 'vitest';
import { detectWebGL, initialMode, measureFps } from '../src/map/choose-mode';
import { dotStyle, hexToRgba } from '../src/map/dot-style';
import { hitTest } from '../src/map/hit-test';
import { altitudeToZoom, MAX_ZOOM, scaleToZoom, zoomToAltitude } from '../src/map/zoom';

test('zoom conversions', () => {
  expect(altitudeToZoom(2.5)).toBe(1);
  expect(altitudeToZoom(0.3125)).toBe(4);
  expect(altitudeToZoom(100)).toBe(0);
  expect(altitudeToZoom(0.000001)).toBe(MAX_ZOOM);
  expect(zoomToAltitude(altitudeToZoom(0.5))).toBeCloseTo(0.5);
  expect(scaleToZoom(1)).toBe(1);
  expect(scaleToZoom(8)).toBe(4);
});

test('dot style: 3–7 px, 45–100 % opacity, monotonic, safe for zero', () => {
  expect(dotStyle(0, 100)).toEqual({ size: 3, opacity: 0.45 });
  expect(dotStyle(100, 100)).toEqual({ size: 7, opacity: 1 });
  expect(dotStyle(10, 100).size).toBeGreaterThan(dotStyle(1, 100).size);
  expect(dotStyle(5, 0)).toEqual({ size: 3, opacity: 0.45 });
});

test('hexToRgba', () => expect(hexToRgba('#FFB547', 0.5)).toBe('rgba(255, 181, 71, 0.5)'));

test('hitTest picks the nearest point within its radius + slop', () => {
  const pts = [{ x: 10, y: 10, r: 3, item: 'a' }, { x: 16, y: 10, r: 3, item: 'b' }];
  expect(hitTest(pts, 15, 10)).toBe('b');
  expect(hitTest(pts, 11, 11)).toBe('a');
  expect(hitTest(pts, 100, 100)).toBeNull();
});

test('initial mode', () => {
  expect(initialMode({ saved: 'globe', hasWebGL: false, narrowTouch: false })).toBe('map');
  expect(initialMode({ saved: 'map', hasWebGL: true, narrowTouch: false })).toBe('map');
  expect(initialMode({ saved: 'globe', hasWebGL: true, narrowTouch: true })).toBe('globe');
  expect(initialMode({ saved: null, hasWebGL: true, narrowTouch: true })).toBe('map');
  expect(initialMode({ saved: 'junk', hasWebGL: true, narrowTouch: false })).toBe('globe');
});

test('detectWebGL handles missing context and exceptions', () => {
  const doc = (ctx: unknown) => ({ createElement: () => ({ getContext: () => ctx }) }) as unknown as Document;
  expect(detectWebGL(doc({}))).toBe(true);
  expect(detectWebGL(doc(null))).toBe(false);
  expect(detectWebGL({ createElement: () => { throw new Error('x'); } } as unknown as Document)).toBe(false);
});

test('measureFps averages frames over the window', async () => {
  let t = 0;
  const raf = (cb: FrameRequestCallback) => { t += 40; queueMicrotask(() => cb(t)); return 0; };
  await expect(measureFps(1000, raf, () => t)).resolves.toBe(25);
});

test('measureFps ignores time while the tab is hidden', async () => {
  let t = 0;
  let visibility = 'visible';
  const listeners: (() => void)[] = [];
  const doc = {
    get visibilityState() { return visibility; },
    addEventListener: (_: string, l: () => void) => listeners.push(l),
    removeEventListener: () => {},
  } as unknown as Document;
  let calls = 0;
  const raf = (cb: FrameRequestCallback) => {
    calls++;
    if (calls === 5) { visibility = 'hidden'; listeners.forEach((l) => l()); t += 60_000; visibility = 'visible'; listeners.forEach((l) => l()); }
    t += 40;
    queueMicrotask(() => cb(t));
    return 0;
  };
  await expect(measureFps(1000, raf, () => t, doc)).resolves.toBe(25);
});
