export const MAX_ZOOM = 12;
const BASE_ALTITUDE = 2.5;
const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(0, z));

export const altitudeToZoom = (alt: number) => clamp(Math.log2(BASE_ALTITUDE / alt) + 1);
export const zoomToAltitude = (z: number) => BASE_ALTITUDE / 2 ** (z - 1);
export const scaleToZoom = (k: number) => clamp(Math.log2(k) + 1);
