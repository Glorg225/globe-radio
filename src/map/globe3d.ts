import Globe from 'globe.gl';
import type { Place } from '../data/places';
import { escapeHtml } from '../ui/html';
import type { MapItem } from './cluster';
import { dotStyle, hexToRgba } from './dot-style';
import './map.css';
import type { MapFactory } from './map-view';
import { createPulse } from './pulse';
import { altitudeToZoom, zoomToAltitude } from './zoom';

const INITIAL_ALTITUDE = 2.2;
// Angular size of one screen pixel per unit of camera altitude (tuned so dots stay 3–7 px).
const DEG_PER_PX_PER_ALT = 0.12;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const createGlobe3D: MapFactory = async (el, clusterer, cb) => {
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim();
  const glow = css.getPropertyValue('--globe-glow').trim();
  const pulse = createPulse();
  const globe = new Globe(el, { animateIn: false });
  let maxPop = 1;
  let lastZoom = -1;
  let lastAlt = INITIAL_ALTITUDE;

  const altitude = () => globe.pointOfView().altitude;
  const radiusOf = (o: object) => (dotStyle((o as MapItem).pop, maxPop).size / 2) * DEG_PER_PX_PER_ALT * altitude();

  function refresh(force = false) {
    const alt = altitude();
    const zoom = Math.floor(altitudeToZoom(alt));
    if (force || zoom !== lastZoom) {
      lastZoom = zoom;
      lastAlt = alt;
      const items = clusterer.items(zoom);
      maxPop = Math.max(1, ...items.map((i) => i.pop));
      globe.pointRadius(radiusOf).pointsData(items);
    } else if (Math.abs(alt - lastAlt) / lastAlt > 0.15) {
      lastAlt = alt;
      globe.pointRadius((o: object) => radiusOf(o));
    }
  }

  globe
    .width(el.clientWidth)
    .height(el.clientHeight)
    .backgroundColor('rgba(0,0,0,0)')
    .globeImageUrl(`${import.meta.env.BASE_URL}textures/earth-night.jpg`)
    .showAtmosphere(true)
    .atmosphereColor(glow)
    .atmosphereAltitude(0.16)
    .pointLat('lat')
    .pointLng('lon')
    .pointAltitude(0.003)
    .pointResolution(8)
    .pointColor((o: object) => hexToRgba(accent, dotStyle((o as MapItem).pop, maxPop).opacity))
    .pointLabel((o: object) => `<div class="map-tooltip">${escapeHtml(cb.label(o as MapItem))}</div>`)
    .onPointClick((o: object) => {
      const item = o as MapItem;
      if (item.type === 'cluster') {
        globe.pointOfView({ lat: item.lat, lng: item.lon, altitude: zoomToAltitude(item.zoomTo) }, reducedMotion() ? 0 : 1000);
      } else {
        cb.onSelect(item.place);
      }
    })
    .htmlElementsData([])
    .htmlLat('lat')
    .htmlLng('lon')
    .htmlAltitude(0.004)
    .htmlElement(() => pulse)
    .onZoom(() => refresh());
  globe.pointOfView({ lat: 30, lng: 10, altitude: INITIAL_ALTITUDE });
  refresh(true);

  const ro = new ResizeObserver(() => globe.width(el.clientWidth).height(el.clientHeight));
  ro.observe(el);

  return {
    setPlaying(place: Place | null) { globe.htmlElementsData(place ? [place] : []); },
    flyTo(lat, lon) {
      globe.pointOfView({ lat, lng: lon, altitude: Math.min(altitude(), 1.2) }, reducedMotion() ? 0 : 1200);
    },
    zoomBy(factor) {
      const pov = globe.pointOfView();
      globe.pointOfView({ ...pov, altitude: Math.min(4, Math.max(0.05, pov.altitude / factor)) }, reducedMotion() ? 0 : 300);
    },
    destroy() {
      ro.disconnect();
      globe._destructor();
      el.replaceChildren();
    },
  };
};
