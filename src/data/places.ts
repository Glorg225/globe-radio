import type { PlaceKind, PlaceRef } from './types';

export interface Place extends PlaceRef { count: number; pop: number }
export type CompactPlace = [id: string, lat: number, lon: number, kind: 0 | 1 | 2, cc: string, nameRu: string, name: string, count: number, pop: number];
export interface PlacesFile { v: 2; generated: string; places: CompactPlace[] }

const KINDS: PlaceKind[] = ['exact', 'region', 'country'];

export function encodePlace(p: Place): CompactPlace {
  return [p.id, p.lat, p.lon, KINDS.indexOf(p.kind) as 0 | 1 | 2, p.cc, p.nameRu, p.name, p.count, p.pop];
}

export function decodePlace(c: CompactPlace): Place {
  const [id, lat, lon, kind, cc, nameRu, name, count, pop] = c;
  return { id, lat, lon, kind: KINDS[kind], cc, nameRu, name, count, pop };
}
