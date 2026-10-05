export interface GzCity { id: number; nameRu: string; name: string; lat: number; lon: number; cc: string; admin1: string; pop: number; aliases: string[] }
export interface GzAdmin1 { cc: string; code: string; nameRu: string; name: string; aliases: string[] }
export interface Gazetteer { cities: GzCity[]; admin1: GzAdmin1[] }

type CityRow = [id: number, nameRu: string, name: string, lat: number, lon: number, cc: string, admin1: string, pop: number, aliases: string];
type Admin1Row = [cc: string, code: string, nameRu: string, name: string, aliases: string];
export interface GazetteerFile { v: 1; cities: CityRow[]; admin1: Admin1Row[] }

// Generic words that region fields add around the real name, in the languages seen in Radio Browser data.
const GENERIC = new Set([
  'region', 'regiao', 'regione', 'state', 'estado', 'province', 'provincia', 'oblast', 'republic', 'county',
  'prefecture', 'governorate', 'district', 'department', 'departement', 'municipality', 'city', 'of', 'the',
  'область', 'край', 'республика', 'регион', 'город', 'провинция', 'штат', 'округ',
]);

export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((w) => w && !GENERIC.has(w))
    .join(' ');
}

export function encodeGazetteer(g: Gazetteer): GazetteerFile {
  return {
    v: 1,
    cities: g.cities.map((c) => [c.id, c.nameRu, c.name, c.lat, c.lon, c.cc, c.admin1, c.pop, c.aliases.join('|')]),
    admin1: g.admin1.map((a) => [a.cc, a.code, a.nameRu, a.name, a.aliases.join('|')]),
  };
}

const split = (s: string) => (s ? s.split('|') : []);

export function decodeGazetteer(f: GazetteerFile): Gazetteer {
  return {
    cities: f.cities.map(([id, nameRu, name, lat, lon, cc, admin1, pop, aliases]) => ({ id, nameRu, name, lat, lon, cc, admin1, pop, aliases: split(aliases) })),
    admin1: f.admin1.map(([cc, code, nameRu, name, aliases]) => ({ cc, code, nameRu, name, aliases: split(aliases) })),
  };
}
