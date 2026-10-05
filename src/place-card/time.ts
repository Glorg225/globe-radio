import type { I18n } from '../i18n/i18n';

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

const partsFormat = new Map<string, Intl.DateTimeFormat>();
export function offsetMinutes(tz: string, at: Date): number {
  let f = partsFormat.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    partsFormat.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  const atMinute = Math.floor(at.getTime() / 60000) * 60000;
  return Math.round((asUtc - atMinute) / 60000);
}

export function formatClock(tz: string, at: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
}

export function diffLabel(i18n: I18n, placeOffset: number, userOffset: number): string {
  const diff = placeOffset - userOffset;
  if (diff === 0) return i18n.t('place.time.same');
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const text = h && m ? i18n.t('place.time.hm', { h, m }) : h ? i18n.t('place.time.h', { h }) : i18n.t('place.time.m', { m });
  return i18n.t(diff > 0 ? 'place.time.later' : 'place.time.earlier', { diff: text });
}

export function msUntilNextMinute(nowMs: number): number {
  return 60000 - (nowMs % 60000);
}
