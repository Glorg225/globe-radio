// URL slugs for the static SEO pages: lowercase Latin letters, digits and hyphens only.

// Letters that Unicode normalisation does not decompose into a base letter + diacritic.
const SPECIAL: Record<string, string> = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ßæœøłđðþı]/g, (ch) => SPECIAL[ch])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Unique slugs in list order: the first item keeps the plain slug (so order by importance),
// a later collision gets the place id as a suffix ("c:4951788" -> "springfield-4951788"),
// a name without Latin letters falls back to the whole id ("c:3" -> "c-3").
export function assignSlugs<T>(items: T[], name: (t: T) => string, id: (t: T) => string): Map<T, string> {
  const used = new Set<string>();
  const out = new Map<T, string>();
  for (const item of items) {
    let slug = slugify(name(item));
    if (!slug) slug = slugify(id(item));
    else if (used.has(slug)) slug = `${slug}-${slugify(id(item).replace(/^[a-z]:/i, ''))}`;
    const base = slug;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    out.set(item, slug);
  }
  return out;
}
