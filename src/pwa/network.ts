export interface NetworkStatus { online(): boolean; subscribe(l: (online: boolean) => void): () => void }

export function createNetworkStatus(win: EventTarget & { navigator: { onLine: boolean } }): NetworkStatus {
  const listeners = new Set<(online: boolean) => void>();
  const fire = () => { for (const l of listeners) l(win.navigator.onLine); };
  win.addEventListener('online', fire);
  win.addEventListener('offline', fire);
  return {
    online: () => win.navigator.onLine,
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
