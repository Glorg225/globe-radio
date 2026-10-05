// A new service worker is waiting: offer a reload instead of switching versions under the listener.
export function setupUpdates(d: { register(o: { onNeedRefresh(): void }): (reload?: boolean) => Promise<void>; show(onUpdate: () => void): void }): void {
  const update = d.register({ onNeedRefresh: () => d.show(() => { void update(true); }) });
}
