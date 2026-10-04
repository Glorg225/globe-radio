export interface StationLite {
  id: string; name: string; url: string; placeId: string; cc: string;
  langs: string[]; tags: string[]; votes: number; clicks: number; favicon: string; hls: boolean;
}
export type CompactStationV2 = [id: string, name: string, url: string, placeId: string, langs: string, tags: string, votes: number, clicks: number, favicon: string, hls: 0 | 1];
export interface ShardFile { v: 2; cc: string; stations: CompactStationV2[] }

export function encodeStation(s: StationLite): CompactStationV2 {
  return [s.id, s.name, s.url, s.placeId, s.langs.join(','), s.tags.join(','), s.votes, s.clicks, s.favicon, s.hls ? 1 : 0];
}

export function decodeStation(c: CompactStationV2, cc: string): StationLite {
  const [id, name, url, placeId, langs, tags, votes, clicks, favicon, hls] = c;
  return { id, name, url, placeId, cc, langs: langs ? langs.split(',') : [], tags: tags ? tags.split(',') : [], votes, clicks, favicon, hls: hls === 1 };
}
