// Style mode: which places have stations of a style, and how many (public/data/styles.json, built by the snapshot).
// Loaded on first use of the mode, so the first load of the site does not grow.
export interface StylesFile { v: 1; styles: Record<string, [placeId: string, stations: number][]> }
export type StyleIndex = Map<string, Map<string, number>>;

export async function loadStyles(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<StyleIndex> {
  const r = await fetchFn(`${baseUrl}data/styles.json`);
  if (!r.ok) throw new Error(`styles HTTP ${r.status}`);
  const body = (await r.json()) as Partial<StylesFile>;
  if (body.v !== 1 || !body.styles) throw new Error('unsupported styles format');
  return new Map(Object.entries(body.styles).map(([id, rows]) => [id, new Map(rows)]));
}
