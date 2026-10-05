export async function shareStation(o: {
  url: string; title: string; text: string; preferShare: boolean;
  nav: { share?: (d: ShareData) => Promise<void>; clipboard?: { writeText(s: string): Promise<void> } };
}): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (o.preferShare && o.nav.share) {
    try {
      await o.nav.share({ url: o.url, title: o.title, text: o.text });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    if (!o.nav.clipboard) return 'failed';
    await o.nav.clipboard.writeText(o.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
