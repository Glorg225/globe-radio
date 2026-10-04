import Supercluster from 'supercluster';
import type { Place } from '../data/places';

export type MapItem =
  | { type: 'place'; key: string; place: Place; lat: number; lon: number; count: number; pop: number }
  | { type: 'cluster'; key: string; lat: number; lon: number; count: number; pop: number; zoomTo: number };
export interface Clusterer { items(zoom: number): MapItem[] }

// Above this zoom places are never grouped; both views can zoom past it, so every cluster opens.
export const CLUSTER_MAX_ZOOM = 6;

interface Props { i: number; count: number; pop: number }
interface Reduced { count: number; pop: number }

export function createClusterer(places: Place[]): Clusterer {
  const index = new Supercluster<Props, Reduced>({
    radius: 40,
    maxZoom: CLUSTER_MAX_ZOOM,
    map: (p) => ({ count: p.count, pop: p.pop }),
    reduce: (acc, p) => { acc.count += p.count; acc.pop += p.pop; },
  });
  index.load(places.map((p, i) => ({
    type: 'Feature' as const,
    properties: { i, count: p.count, pop: p.pop },
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
        return { type: 'place', key: place.id, place, lat: place.lat, lon: place.lon, count: place.count, pop: place.pop };
      });
    },
  };
}
