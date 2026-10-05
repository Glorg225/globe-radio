import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createSleepTimer, FADE_MS, SLEEP_OPTIONS } from '../src/player/sleep-timer';

let volume: number;
let stop: ReturnType<typeof vi.fn<() => void>>;
const make = () => createSleepTimer({ getVolume: () => volume, setVolume: (v) => { volume = v; }, stop });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); volume = 0.8; stop = vi.fn<() => void>(); });
afterEach(() => vi.useRealTimers());

test('options are 15/30/60/90 minutes', () => expect([...SLEEP_OPTIONS]).toEqual([15, 30, 60, 90]));

test('minutes left counts down (rounded up) and notifies every minute', () => {
  const t = make();
  const l = vi.fn();
  t.subscribe(l);
  t.start(15);
  expect(t.minutesLeft()).toBe(15);
  vi.advanceTimersByTime(60_000 * 2 + 1);
  expect(t.minutesLeft()).toBe(13);
  expect(l.mock.calls.length).toBeGreaterThanOrEqual(3);
});

test('fades out over the last 10 s, stops, then restores the volume and turns itself off', () => {
  const t = make();
  t.start(15);
  vi.advanceTimersByTime(15 * 60_000 - FADE_MS + FADE_MS / 2);
  expect(volume).toBeGreaterThan(0.3);
  expect(volume).toBeLessThan(0.5);
  vi.advanceTimersByTime(FADE_MS / 2 + 500);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(volume).toBe(0.8);
  expect(t.minutesLeft()).toBeNull();
});

test('cancel during the fade restores the volume and does not stop', () => {
  const t = make();
  t.start(15);
  vi.advanceTimersByTime(15 * 60_000 - FADE_MS / 2);
  t.cancel();
  expect(volume).toBe(0.8);
  vi.advanceTimersByTime(FADE_MS);
  expect(stop).not.toHaveBeenCalled();
  expect(t.minutesLeft()).toBeNull();
});

test('restarting replaces the previous timer', () => {
  const t = make();
  t.start(15);
  t.start(30);
  vi.advanceTimersByTime(16 * 60_000);
  expect(stop).not.toHaveBeenCalled();
  expect(t.minutesLeft()).toBe(14);
});

test('volume changed by hand during the fade: the timer still ends and restores the pre-fade volume (review focus 3)', () => {
  const t = make();
  t.start(15);
  vi.advanceTimersByTime(15 * 60_000 - FADE_MS + 1000);
  volume = 1;
  vi.advanceTimersByTime(FADE_MS);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(volume).toBe(0.8);
});
