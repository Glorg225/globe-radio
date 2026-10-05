import Supercluster from 'supercluster';
import type { Place } from '../data/places';

export type MapItem =
  | { type: 'place'; key: string; place: Place; lat: number; lon: number; count: number; pop: number; tone?: 'muted' | 'teal' }
  | { type: 'cluster'; key: string; lat: number; lon: number; count: number; pop: number; zoomTo: number; tone?: 'muted' | 'teal' };
export interface Clusterer { items(zoom: number): MapItem[] }

// Above this zoom places are never grouped; both views can zoom past it, so every cluster opens.
export const CLUSTER_MAX_ZOOM = 6;

interface Props { i: number; count: number; pop: number }
interface Reduced { count: number; pop: number }

// With a weight (e.g. stations in one language) only places with weight > 0 are indexed and counted by it.
export function createClusterer(all: Place[], weight?: (p: Place) => number): Clusterer {
  const places = weight ? all.filter((p) => weight(p) > 0) : all;
  const countOf = (p: Place) => (weight ? weight(p) : p.count);
  const popOf = (p: Place) => (weight ? weight(p) : p.pop);
  const index = new Supercluster<Props, Reduced>({
    radius: 40,
    maxZoom: CLUSTER_MAX_ZOOM,
    map: (p) => ({ count: p.count, pop: p.pop }),
    reduce: (acc, p) => { acc.count += p.count; acc.pop += p.pop; },
  });
  index.load(places.map((p, i) => ({
    type: 'Feature' as const,
    properties: { i, count: countOf(p), pop: popOf(p) },
    geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
  })));

  return {
    items(zoom) {
      return index.getClusters([-180, -85, 180, 85], Math.floor(zoom)).map((f): MapItem => {
        const [lon, lat] = f.geometry.coordinates;
        const props = f.properties as Partial<Props> & Reduced & { cluster?: boolean; cluster_id?: number };
        if (props.cluster) {
          const id = props.cluster_id!;
          return { type: 'cluster', key: `cl:${id}`, lat, lon, count: props.count, pop: props.pop, zoomTo: index.getClusterExpansionZoom(id) };
        }
        const place = places[props.i!];
        return { type: 'place', key: place.id, place, lat: place.lat, lon: place.lon, count: countOf(place), pop: popOf(place) };
      });
    },
  };
}

// Learn mode: every place muted underneath, places of the chosen language in teal on top.
export function layered(base: Clusterer, highlight: Clusterer | null): Clusterer {
  if (!highlight) return base;
  return {
    items: (zoom) => [
      ...base.items(zoom).map((i) => ({ ...i, tone: 'muted' as const })),
      ...highlight.items(zoom).map((i) => ({ ...i, tone: 'teal' as const })),
    ],
  };
}
