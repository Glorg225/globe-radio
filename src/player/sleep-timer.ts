export const SLEEP_OPTIONS = [15, 30, 60, 90] as const;
export const FADE_MS = 10_000;
const STEP_MS = 250;

export interface SleepTimer { start(minutes: number): void; cancel(): void; minutesLeft(): number | null; subscribe(l: () => void): () => void }

// Fades a gain (1 → 0) on top of the user's volume, so the volume slider keeps its own value.
export function createSleepTimer(d: { setGain(g: number): void; stop(): void; now?: () => number }): SleepTimer {
  const now = d.now ?? Date.now;
  const listeners = new Set<() => void>();
  let endsAt: number | null = null;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let fading = false;
  const notify = () => { for (const l of listeners) l(); };

  function clear() {
    for (const t of timers) { clearTimeout(t); clearInterval(t); }
    timers = [];
    if (fading) d.setGain(1);
    fading = false;
    endsAt = null;
  }

  function finish() {
    for (const t of timers) { clearTimeout(t); clearInterval(t); }
    timers = [];
    d.stop();
    fading = false;
    endsAt = null;
    d.setGain(1);
    notify();
  }

  return {
    start(minutes) {
      clear();
      endsAt = now() + minutes * 60_000;
      const total = endsAt - now();
      timers.push(setInterval(notify, 60_000));
      timers.push(setTimeout(() => {
        fading = true;
        const started = now();
        timers.push(setInterval(() => {
          const k = Math.min(1, (now() - started) / FADE_MS);
          d.setGain(1 - k);
          if (k >= 1) finish();
        }, STEP_MS));
      }, Math.max(0, total - FADE_MS)));
      notify();
    },
    cancel() { clear(); notify(); },
    minutesLeft: () => (endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now()) / 60_000))),
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
