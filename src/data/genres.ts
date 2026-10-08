// Station styles: music genres, broadcast formats and decades, built from Radio Browser tags.
// Tags are free text in many languages, so each style lists its spellings; tagKey() folds case, diacritics,
// spaces and punctuation, and decades are recognised by a rule. A spelling belongs to exactly one style.
// The id is also the page slug (/radio/genre/<id>/). Unmatched frequent tags are reported at build time.

export type GenreGroup = 'genre' | 'format' | 'decade';
export interface Genre { id: string; name: string; group: GenreGroup; aliases: string[] }

const g = (id: string, name: string, aliases: string[]): Genre => ({ id, name, group: 'genre', aliases });
const f = (id: string, name: string, aliases: string[]): Genre => ({ id, name, group: 'format', aliases });
const d = (id: string, name: string): Genre => ({ id, name, group: 'decade', aliases: [] });

export const GENRES: Genre[] = [
  g('pop', 'Pop', ['pop', 'pop music', 'balada pop', 'greek pop', 'pop en español', 'поп', 'поп-музыка', 'popmusik', 'k-pop', 'j-pop']),
  g('rock', 'Rock', ['rock', 'pop rock', 'hard rock', 'soft rock', 'progressive rock', 'blues rock', 'rock music', 'rock en español', 'rock nacional', 'рок']),
  g('classic-rock', 'Classic Rock', ['classic rock', 'classic rock hits']),
  g('alternative', 'Alternative & Indie', ['alternative', 'alternative rock', 'indie', 'indie rock', 'indie pop', 'alternative / indie', 'new wave', 'punk', 'punk rock', 'grunge']),
  g('metal', 'Metal', ['metal', 'heavy metal', 'death metal', 'black metal', 'thrash metal']),
  g('jazz', 'Jazz', ['jazz', 'smooth jazz', 'classic jazz', 'jazz music', 'nu jazz', 'acid jazz', 'джаз']),
  g('blues', 'Blues', ['blues']),
  g('classical', 'Classical', ['classical', 'classical music', 'classical piano', 'klassik', 'klassische musik', 'música clásica', 'musique classique', 'musica classica', 'opera', 'baroque', 'классика', 'классическая музыка']),
  g('electronic', 'Electronic', ['electronic', 'electronica', 'electro', 'edm', 'electronic dance music', 'electronic music', 'drum and bass', 'dnb', 'dubstep', 'synthwave', 'idm', 'электроника']),
  g('dance', 'Dance', ['dance', 'club', 'club dance', 'eurodance', 'pop dance', 'dance music', 'party', 'dance hits']),
  g('house', 'House', ['house', 'deep house', 'tech house', 'progressive house']),
  g('techno', 'Techno', ['techno', 'minimal', 'hard techno']),
  g('trance', 'Trance', ['trance', 'psytrance', 'progressive trance', 'goa trance']),
  g('chillout', 'Chillout & Lounge', ['chillout', 'chill', 'lounge', 'chillout+lounge', 'ambient', 'ambient and relaxation music', 'relax', 'relaxation', 'downtempo', 'chillwave', 'lofi']),
  g('hip-hop', 'Hip-Hop & Rap', ['hip hop', 'rap', 'trap', 'hip-hop/rap', 'urban hip hop', 'deutschrap', 'рэп']),
  g('rnb', 'R&B & Soul', ['r&b', 'rnb', 'soul', 'urban', 'r&b/soul', 'neo soul', 'motown']),
  g('funk', 'Funk', ['funk', 'funky']),
  g('reggae', 'Reggae', ['reggae', 'dancehall', 'ska', 'dub']),
  g('latin', 'Latin', ['latin', 'latino', 'latin pop', 'música latina', 'salsa', 'merengue', 'bachata', 'cumbia', 'reggaeton', 'tropical', 'vallenato', 'bossa nova', 'mpb', 'sertanejo', 'tango']),
  g('regional-mexican', 'Regional Mexican', ['regional mexican', 'regional mexicano', 'banda', 'banda norteña', 'norteña', 'norteño', 'grupera', 'ranchera', 'mariachi', 'corridos']),
  g('country', 'Country', ['country', 'country music', 'classic country', 'americana', 'bluegrass']),
  g('folk', 'Folk', ['folk', 'folk music', 'folklore', 'greek folk', 'folk rock', 'celtic', 'народная музыка']),
  g('schlager', 'Schlager', ['schlager', 'volksmusik', 'deutsche schlager']),
  g('world', 'World', ['world', 'world music', 'african music', 'afrobeats', 'afrobeat', 'bollywood', 'arabic music', 'turkish music', 'greek music', 'manele', 'chanson']),
  g('oldies', 'Oldies', ['oldies', 'nostalgie', 'retro', 'flashback', 'golden oldies', 'oldies but goldies', 'old school']),
  g('hits', 'Hits & Top 40', ['hits', 'top 40', 'top hits', 'charts', 'contemporary hits', 'contemporary hits radio', 'chr', 'adult hits', 'classic hits', 'mainstream', 'hot ac', 'current hits']),
  g('easy-listening', 'Easy Listening', ['easy listening', 'adult contemporary', 'hot adult contemporary', 'love songs', 'romantic', 'musica romantica', 'romántica', 'balada', 'baladas', 'balada en español', 'baladas en español', 'soft', 'instrumental']),
  g('disco', 'Disco', ['disco', 'italo disco', 'nu disco']),
  f('news', 'News', ['news', 'noticias', 'nachrichten', 'information', 'informativo', 'actualités', 'notizie', 'news talk', 'local news', 'world news', 'новости']),
  f('talk', 'Talk', ['talk', 'talk radio', 'talk & speech', 'radio hablada', 'spoken word', 'entrevistas', 'debate', 'politics', 'podcast']),
  f('sports', 'Sports', ['sports', 'sport', 'deportes', 'live sports', 'football', 'soccer', 'futebol', 'fútbol', 'спорт']),
  f('religious', 'Religious', ['religious', 'religion', 'christian', 'christian music', 'christian contemporary', 'gospel', 'catholic', 'católica', 'cristiana', 'cristiano', 'bible', 'evangelio', 'worship', 'islamic', 'islam', 'quran', 'jewish']),
  f('community', 'Community & College', ['community', 'community radio', 'radio comunitaria', 'college', 'college radio', 'university radio', 'student radio']),
  f('public', 'Public Radio', ['public radio', 'npr', 'public broadcasting']),
  f('kids', 'Kids', ['kids', 'children', 'kinder', 'infantil']),
  f('variety', 'Variety', ['variety', 'eclectic', 'various', 'various music', 'música variada', 'misc', 'full service', 'adult variety']),
  f('culture', 'Culture & Arts', ['culture', 'cultural', 'arts', 'kultur', 'cultura']),
  d('50s', '50s'), d('60s', '60s'), d('70s', '70s'), d('80s', '80s'), d('90s', '90s'), d('2000s', '2000s'), d('2010s', '2010s'),
];

export function tagKey(tag: string): string {
  return tag.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

const DECADE_WORDS: Record<string, string> = { fifties: '50s', sixties: '60s', seventies: '70s', eighties: '80s', nineties: '90s' };

// "80s", "80's", "80er", "1980s", "eighties" -> "80s"; "00s", "2000er" -> "2000s", "2010s" -> "2010s".
// Bare numbers ("90", "1980", "10s") are not decades: they are as often frequencies, years or "top 10s".
export function decadeOf(key: string): string | undefined {
  if (DECADE_WORDS[key]) return DECADE_WORDS[key];
  const old = /^(?:19)?([5-9])0(?:s|er)$/.exec(key);
  if (old) return `${old[1]}0s`;
  if (/^(?:20)?00(?:s|er)$/.test(key)) return '2000s';
  if (/^2010(?:s|er)$/.test(key)) return '2010s';
  return undefined;
}

const BY_KEY = new Map<string, string>();
for (const genre of GENRES) for (const a of genre.aliases) BY_KEY.set(tagKey(a), genre.id);
const ORDER = new Map(GENRES.map((genre, i) => [genre.id, i]));
const BY_ID = new Map(GENRES.map((genre) => [genre.id, genre]));

export const genreById = (id: string): Genre | undefined => BY_ID.get(id);

export function genreOfTag(tag: string): string | undefined {
  const key = tagKey(tag);
  return BY_KEY.get(key) ?? decadeOf(key);
}

export function stationGenres(tags: string[]): string[] {
  const ids = new Set<string>();
  for (const t of tags) {
    const id = genreOfTag(t);
    if (id) ids.add(id);
  }
  return [...ids].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}

// Same as stationGenres(station.tags), computed once per station object: the app filters
// thousands of stations by style on every "next" and every list.
const perStation = new WeakMap<object, string[]>();
export function stationStyles(station: { tags: string[] }): string[] {
  let ids = perStation.get(station);
  if (!ids) {
    ids = stationGenres(station.tags);
    perStation.set(station, ids);
  }
  return ids;
}

