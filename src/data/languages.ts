// English and native language names -> ISO 639-1.
// Extend from the snapshot report (unknownLanguages).
const NAME_TO_CODE: Record<string, string> = {
  english: 'en', spanish: 'es', 'español': 'es', espanol: 'es', castellano: 'es',
  french: 'fr', 'français': 'fr', francais: 'fr', german: 'de', deutsch: 'de',
  italian: 'it', italiano: 'it', portuguese: 'pt', 'português': 'pt', portugues: 'pt', brazilian: 'pt', 'brazilian portuguese': 'pt',
  russian: 'ru', 'русский': 'ru', ukrainian: 'uk', 'українська': 'uk', belarusian: 'be',
  polish: 'pl', polski: 'pl', czech: 'cs', 'čeština': 'cs', slovak: 'sk', slovenian: 'sl', croatian: 'hr', serbian: 'sr', bosnian: 'bs',
  bulgarian: 'bg', macedonian: 'mk', romanian: 'ro', 'română': 'ro', hungarian: 'hu', magyar: 'hu',
  greek: 'el', 'ελληνικά': 'el', turkish: 'tr', 'türkçe': 'tr', dutch: 'nl', nederlands: 'nl', flemish: 'nl',
  swedish: 'sv', svenska: 'sv', norwegian: 'no', norsk: 'no', danish: 'da', dansk: 'da', finnish: 'fi', suomi: 'fi', icelandic: 'is',
  estonian: 'et', latvian: 'lv', lithuanian: 'lt', irish: 'ga', welsh: 'cy', catalan: 'ca', 'català': 'ca', basque: 'eu', euskara: 'eu', galician: 'gl',
  arabic: 'ar', 'العربية': 'ar', hebrew: 'he', persian: 'fa', farsi: 'fa', urdu: 'ur', hindi: 'hi', bengali: 'bn', bangla: 'bn',
  tamil: 'ta', telugu: 'te', malayalam: 'ml', kannada: 'kn', marathi: 'mr', gujarati: 'gu', punjabi: 'pa', nepali: 'ne', sinhala: 'si',
  chinese: 'zh', mandarin: 'zh', cantonese: 'zh', '中文': 'zh', japanese: 'ja', '日本語': 'ja', korean: 'ko', '한국어': 'ko',
  thai: 'th', vietnamese: 'vi', 'tiếng việt': 'vi', indonesian: 'id', 'bahasa indonesia': 'id', malay: 'ms', filipino: 'tl', tagalog: 'tl',
  swahili: 'sw', amharic: 'am', hausa: 'ha', yoruba: 'yo', zulu: 'zu', afrikaans: 'af', somali: 'so',
  armenian: 'hy', georgian: 'ka', azerbaijani: 'az', kazakh: 'kk', uzbek: 'uz', mongolian: 'mn', albanian: 'sq', esperanto: 'eo', latin: 'la',
};

// ISO 639-2/3 -> 639-1 for common cases
const THREE_TO_TWO: Record<string, string> = {
  eng: 'en', spa: 'es', fra: 'fr', fre: 'fr', deu: 'de', ger: 'de', ita: 'it', por: 'pt', rus: 'ru', ukr: 'uk',
  pol: 'pl', nld: 'nl', dut: 'nl', ara: 'ar', zho: 'zh', chi: 'zh', jpn: 'ja', kor: 'ko', tur: 'tr', ell: 'el', gre: 'el',
  swe: 'sv', nor: 'no', dan: 'da', fin: 'fi', ces: 'cs', cze: 'cs', ron: 'ro', rum: 'ro', hun: 'hu', heb: 'he', hin: 'hi', fas: 'fa', per: 'fa',
};

const display = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });

function isKnownCode(code: string): boolean {
  if (!/^[a-z]{2}$/.test(code)) return false;
  try { return display.of(code) !== undefined; } catch { return false; }
}

function fromCode(raw: string): string | undefined {
  const c = raw.trim().toLowerCase();
  if (c.length === 3) return THREE_TO_TWO[c];
  return isKnownCode(c) ? c : undefined;
}

function fromName(raw: string): string | undefined {
  const n = raw.trim().toLowerCase();
  return n ? NAME_TO_CODE[n] : undefined;
}

export function normalizeLanguages(languagecodes: string, language: string): string[] {
  const out: string[] = [];
  const push = (c: string | undefined) => { if (c && !out.includes(c)) out.push(c); };
  for (const part of languagecodes.split(',')) push(fromCode(part));
  if (out.length === 0) {
    for (const part of language.split(/,|\/|;|\band\b/i)) push(fromName(part));
  }
  return out;
}
