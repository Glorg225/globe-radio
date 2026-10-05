import { normalizeLanguages } from './languages';
import type { Centroids, RawStation, Station } from './types';

const MAX_TAGS = 5;

function validCoords(lat: number | null, lon: number | null): boolean {
  return typeof lat === 'number' && typeof lon === 'number'
    && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
}

const str = (v: string | null | undefined) => (typeof v === 'string' ? v : '');

function parseTags(tags: string): string[] {
  const out: string[] = [];
  for (const t of tags.split(',')) {
    const v = t.trim().toLowerCase();
    if (v && !out.includes(v)) out.push(v);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;

export function toStation(raw: RawStation, centroids: Centroids): Station | null {
  const name = str(raw.name).trim();
  const url = str(raw.url_resolved).trim();
  if (raw.lastcheckok !== 1 || !name || !url.startsWith('https://')) return null;
  const cc = str(raw.countrycode).trim().toUpperCase();
  let lat: number, lon: number, approx: boolean;
  if (validCoords(raw.geo_lat, raw.geo_long)) {
    lat = raw.geo_lat as number; lon = raw.geo_long as number; approx = false;
  } else {
    const c = centroids[cc];
    if (!c) return null;
    [lat, lon] = c; approx = true;
  }
  return {
    id: raw.stationuuid, name, url, lat: round(lat), lon: round(lon), approx, cc,
    state: str(raw.state).trim(),
    langs: normalizeLanguages(str(raw.languagecodes), str(raw.language)),
    tags: parseTags(str(raw.tags)),
    votes: raw.votes, clicks: raw.clickcount,
    favicon: str(raw.favicon).startsWith('https://') ? str(raw.favicon) : '',
    hls: raw.hls === 1,
  };
}

export function dedupe(list: Station[]): Station[] {
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

