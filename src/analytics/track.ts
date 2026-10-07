// Sends a GA4 event through the consent snippet's gtag (queued until the visitor accepts; no-op without it).
export function track(name: string, params: Record<string, string | number> = {}): void {
  const gtag = (globalThis as { gtag?: (...args: unknown[]) => void }).gtag;
  gtag?.('event', name, params);
}
