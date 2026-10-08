import type { Place } from '../data/places';
import type { Clusterer, MapItem } from './cluster';

import type { MapLabelDetail } from './tooltip';

// label: the tooltip's first line (also used as plain text); detail: optional second line and flag.
export interface MapCallbacks { onSelect(place: Place): void; label(item: MapItem): string; detail?(item: MapItem): MapLabelDetail | null }
export interface MapView {
  setPlaying(place: Place | null): void;
  flyTo(lat: number, lon: number): void;
  zoomBy(factor: number): void;
  refresh(): void;
  destroy(): void;
}
export type MapFactory = (el: HTMLElement, clusterer: Clusterer, cb: MapCallbacks) => Promise<MapView>;
