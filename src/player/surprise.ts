import type { Place } from '../data/places';
import type { StationLite } from '../data/shards';

export function weightedPick<T>(items: T[], weight: (x: T) => number, random: () => number): T | null {
  const ws = items.map((x) => Math.max(0, weight(x)));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    if (ws[i] <= 0) continue;
    if (r < ws[i]) return items[i];
    r -= ws[i];
  }
  for (let i = items.length - 1; i >= 0; i--) if (ws[i] > 0) return items[i];
  return null;
}

export interface SurpriseQuery {
  places: Place[];
  weightOf(p: Place): number;
  stationsOf(cc: string): Promise<StationLite[]>;
  isBlocked(id: string): boolean;
  filter?: (s: StationLite) => boolean;
  random?: () => number;
  attempts?: number;
}

// A random place (weighted by station count), then a station in it — popular ones a little more often.
export async function pickSurprise(q: SurpriseQuery): Promise<{ station: StationLite; place: Place } | null> {
  const random = q.random ?? Math.random;
  const tried = new Set<string>();
  for (let i = 0; i < (q.attempts ?? 5); i++) {
    const place = weightedPick(q.places.filter((p) => !tried.has(p.id)), q.weightOf, random);
    if (!place) return null;
    tried.add(place.id);
    let list: StationLite[];
    try { list = await q.stationsOf(place.cc); } catch { continue; }
    const candidates = list.filter((s) => s.placeId === place.id && !q.isBlocked(s.id) && (q.filter?.(s) ?? true));
    const station = weightedPick(candidates, (s) => Math.log(s.clicks + 2), random);
    if (station) return { station, place };
  }
  return null;
}
