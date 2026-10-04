import { decode } from './stations';
import type { CompactStation, Station } from './types';

export async function loadStations(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<Station[]> {
  const r = await fetchFn(`${baseUrl}data/stations.json`);
  if (!r.ok) throw new Error(`stations HTTP ${r.status}`);
  const body = (await r.json()) as { v?: number; stations?: CompactStation[] };
  if (body.v !== 1 || !Array.isArray(body.stations)) throw new Error('unsupported stations format');
  return body.stations.map(decode);
}
