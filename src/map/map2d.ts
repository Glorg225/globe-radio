import { geoEquirectangular, geoGraticule10, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { fillTooltip } from './tooltip';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import type { Place } from '../data/places';
import type { MapItem } from './cluster';
import { dotStyle } from './dot-style';
import { hitTest } from './hit-test';
import './map.css';
import type { MapFactory } from './map-view';
import { createPulse } from './pulse';
import { MAX_SCALE, scaleToZoom } from './zoom';

const SPHERE: GeoPermissibleObjects = { type: 'Sphere' };
const AXES: GeoPermissibleObjects = {
  type: 'MultiLineString',
  coordinates: [[[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]], [[0, -90], [0, 0], [0, 90]]],
};

export const createMap2D: MapFactory = async (el, clusterer, cb) => {
  const css = getComputedStyle(document.documentElement);
  const token = (n: string) => css.getPropertyValue(n).trim();
  const color = { bg: token('--map-bg'), land: token('--map-land'), border: token('--border-card'), grid: token('--map-grid'), axis: token('--map-axis'), accent: token('--accent'), teal: token('--teal'), muted: token('--dot-muted') };
  const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
  const land = feature(topo, topo.objects.countries) as GeoPermissibleObjects;
  const graticule = geoGraticule10();

  // Own host element: destroying a stale view must not wipe a newer view mounted into the same container.
  const host = document.createElement('div');
  host.className = 'view-host view-host--map';
  el.append(host);
  const canvas = document.createElement('canvas');
  canvas.className = 'map2d';
  const tooltip = document.createElement('div');
  tooltip.className = 'map-tooltip map-tooltip--floating';
  tooltip.hidden = true;
  const pulse = createPulse();
  pulse.hidden = true;
  host.append(canvas, pulse, tooltip);

  const ctx = canvas.getContext('2d')!;
  const projection = geoEquirectangular();
  const path = geoPath(projection, ctx);
  let w = 0;
  let h = 0;
  let transform: ZoomTransform = zoomIdentity;
  let screen: { x: number; y: number; r: number; item: MapItem }[] = [];
  let playing: Place | null = null;

  const zb = d3zoom<HTMLCanvasElement, unknown>().scaleExtent([1, MAX_SCALE]).on('zoom', (e: { transform: ZoomTransform }) => {
    transform = e.transform;
    draw();
  });
  const sel = select(canvas).call(zb);

  function stroke(obj: GeoPermissibleObjects, style: string, width: number) {
    ctx.beginPath(); path(obj); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.stroke();
  }

  function placePulse() {
    const p = playing && projection([playing.lon, playing.lat]);
    pulse.hidden = !p;
    if (p) { pulse.style.left = `${transform.applyX(p[0])}px`; pulse.style.top = `${transform.applyY(p[1])}px`; }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);
    const lw = 1 / transform.k;
    ctx.beginPath(); path(SPHERE); ctx.fillStyle = color.bg; ctx.fill();
    ctx.beginPath(); path(land); ctx.fillStyle = color.land; ctx.fill();
    stroke(land, color.border, lw);
    stroke(graticule, color.grid, lw);
    stroke(AXES, color.axis, lw);
    stroke(SPHERE, color.border, lw);
    ctx.restore();

    const items = clusterer.items(scaleToZoom(transform.k));
    const maxPop = Math.max(1, ...items.filter((i) => i.tone !== 'muted').map((i) => i.pop));
    screen = [];
    for (const item of items) {
      const p = projection([item.lon, item.lat]);
      if (!p) continue;
      const x = transform.applyX(p[0]);
      const y = transform.applyY(p[1]);
      if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
      const muted = item.tone === 'muted';
      const { size, opacity } = muted ? { size: 3, opacity: 0.35 } : dotStyle(item.pop, maxPop);
      const fill = muted ? color.muted : item.tone === 'teal' ? color.teal : color.accent;
      ctx.shadowColor = fill;
      ctx.shadowBlur = muted ? 0 : 8;
      ctx.fillStyle = fill;
      ctx.globalAlpha = opacity;
      ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
      screen.push({ x, y, r: size / 2, item });
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    placePulse();
  }

  function resize() {
    w = canvas.parentElement!.clientWidth - 2;
    h = canvas.parentElement!.clientHeight - 2;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    projection.fitExtent([[0, 0], [w, h]], SPHERE);
    zb.extent([[0, 0], [w, h]]).translateExtent([[0, 0], [w, h]]);
    draw();
  }

  const at = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    // Teal dots are drawn last; check them first so they win over the muted dot at the same point.
    return hitTest([...screen].reverse(), e.clientX - r.left, e.clientY - r.top);
  };
  const centerOn = (lon: number, lat: number, k: number) => {
    const p = projection([lon, lat]);
    if (p) sel.call(zb.transform, zoomIdentity.translate(w / 2, h / 2).scale(k).translate(-p[0], -p[1]));
  };

  canvas.addEventListener('mousemove', (e) => {
    const item = at(e);
    canvas.style.cursor = item ? 'pointer' : 'grab';
    tooltip.hidden = !item;
    if (!item) return;
    const r = canvas.getBoundingClientRect();
    fillTooltip(tooltip, cb, item);
    tooltip.style.left = `${e.clientX - r.left}px`;
    tooltip.style.top = `${e.clientY - r.top}px`;
  });
  canvas.addEventListener('mouseleave', () => { tooltip.hidden = true; });
  canvas.addEventListener('click', (e) => {
    const item = at(e);
    if (!item) return;
    if (item.type === 'cluster') centerOn(item.lon, item.lat, Math.min(MAX_SCALE, 2 ** (item.zoomTo - 1)));
    else cb.onSelect(item.place);
  });

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  return {
    setPlaying(place) { playing = place; placePulse(); },
    flyTo(lat, lon) { centerOn(lon, lat, Math.max(transform.k, 8)); },
    zoomBy(factor) { sel.call(zb.scaleBy, factor); },
    refresh() { draw(); },
    destroy() {
      ro.disconnect();
      sel.on('.zoom', null);
      host.remove();
    },
  };
};
