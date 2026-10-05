import type { StationLite } from '../data/shards';

const TALK = new Set(['news', 'talk']);
export const isTalk = (s: Pick<StationLite, 'tags'>) => s.tags.some((t) => TALK.has(t));
