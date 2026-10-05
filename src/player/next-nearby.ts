import { haversineKm } from '../data/geo';
import type { Place } from '../data/places';
import type { StationLite } from '../data/shards';

export interface NextQuery {
  currentId: string;
  currentPlace: Place;
  places: Place[];
  stationsOf(cc: string): Promise<StationLite[]>;
  isBlocked(id: string): boolean;
  filter?: (s: StationLite) => boolean;
  maxPlaces?: number;
}

export async function findNextNearby(q: NextQuery): Promise<{ station: StationLite; place: Place } | null> {
  const { lat, lon } = q.currentPlace;
  const ordered = q.places
    .filter((p) => p.id !== q.currentPlace.id)
    .map((p) => ({ p, d: haversineKm(lat, lon, p.lat, p.lon) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, (q.maxPlaces ?? 60) - 1)
    .map((x) => x.p);
  for (const place of [q.currentPlace, ...ordered]) {
    let list: StationLite[];
    try { list = await q.stationsOf(place.cc); } catch { continue; }
    const best = list
      .filter((s) => s.placeId === place.id && s.id !== q.currentId && !q.isBlocked(s.id) && (q.filter?.(s) ?? true))
      .sort((a, b) => b.clicks - a.clicks)[0];
    if (best) return { station: best, place };
  }
  return null;
}
