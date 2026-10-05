export interface StationLite {
  id: string; name: string; url: string; placeId: string; cc: string;
  langs: string[]; tags: string[]; votes: number; clicks: number; favicon: string; hls: boolean;
}
export type CompactStationV2 = [id: string, name: string, url: string, placeId: string, langs: string, tags: string, votes: number, clicks: number, favicon: string, hls: 0 | 1];
export interface PlaceInfo { tz: string; wikiRu: string; wikiEn: string }
export type PlaceInfoRow = [id: string, tz: string, wikiRu: string, wikiEn: string];
export interface ShardFile { v: 2; cc: string; stations: CompactStationV2[]; places?: PlaceInfoRow[] }

export function encodeStation(s: StationLite): CompactStationV2 {
  return [s.id, s.name, s.url, s.placeId, s.langs.join(','), s.tags.join(','), s.votes, s.clicks, s.favicon, s.hls ? 1 : 0];
}

export function decodeStation(c: CompactStationV2, cc: string): StationLite {
  const [id, name, url, placeId, langs, tags, votes, clicks, favicon, hls] = c;
  return { id, name, url, placeId, cc, langs: langs ? langs.split(',') : [], tags: tags ? tags.split(',') : [], votes, clicks, favicon, hls: hls === 1 };
}

export interface ShardStore { get(cc: string): Promise<StationLite[]>; info(cc: string): Promise<Map<string, PlaceInfo>> }

interface LoadedShard { stations: StationLite[]; info: Map<string, PlaceInfo> }

export function createShardStore(baseUrl: string, fetchFn: typeof fetch = fetch): ShardStore {
  const cache = new Map<string, Promise<LoadedShard>>();
  async function load(cc: string): Promise<LoadedShard> {
    const r = await fetchFn(`${baseUrl}data/stations/${cc}.json`);
    if (!r.ok) throw new Error(`stations ${cc} HTTP ${r.status}`);
    const body = (await r.json()) as Partial<ShardFile>;
    if (body.v !== 2 || !Array.isArray(body.stations)) throw new Error('unsupported stations format');
    const info = new Map<string, PlaceInfo>((body.places ?? []).map(([id, tz, wikiRu, wikiEn]) => [id, { tz, wikiRu, wikiEn }]));
    return { stations: body.stations.map((c) => decodeStation(c, cc)), info };
  }
  function file(cc: string): Promise<LoadedShard> {
    let p = cache.get(cc);
    if (!p) {
      p = load(cc);
      cache.set(cc, p);
      p.catch(() => cache.delete(cc));
    }
    return p;
  }
  return {
    get: (cc) => file(cc).then((f) => f.stations),
    info: (cc) => file(cc).then((f) => f.info),
  };
}
