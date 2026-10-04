import type { Place } from '../data/places';
import type { Clusterer, MapItem } from './cluster';

export interface MapCallbacks { onSelect(place: Place): void; label(item: MapItem): string }
export interface MapView {
  setPlaying(place: Place | null): void;
  flyTo(lat: number, lon: number): void;
  zoomBy(factor: number): void;
  destroy(): void;
}
export type MapFactory = (el: HTMLElement, clusterer: Clusterer, cb: MapCallbacks) => Promise<MapView>;
