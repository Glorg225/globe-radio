export const MAX_ZOOM = 12;
// How close each view can get; clustering must end before these limits (see CLUSTER_MAX_ZOOM).
export const MIN_ALTITUDE = 0.02;
export const MAX_SCALE = 256;
const BASE_ALTITUDE = 2.5;
const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(0, z));

export const altitudeToZoom = (alt: number) => clamp(Math.log2(BASE_ALTITUDE / alt) + 1);
export const zoomToAltitude = (z: number) => BASE_ALTITUDE / 2 ** (z - 1);
export const scaleToZoom = (k: number) => clamp(Math.log2(k) + 1);
