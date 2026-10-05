import { countryName, placeTitle } from '../data/place-name';
import type { Place } from '../data/places';
import type { PlaceInfo, StationLite } from '../data/shards';
import type { I18n } from '../i18n/i18n';
import { escapeHtml } from '../ui/html';
import { icons } from '../ui/icons';
import { languageNames } from './language';
import './place-card.css';
import { diffLabel, formatClock, isValidTimeZone, msUntilNextMinute, offsetMinutes } from './time';
import type { WikiResult } from './wiki';

export interface PlaceCardData { place: Place; station: StationLite; info: PlaceInfo | null }
export interface PlaceCardDeps {
  i18n: I18n; storage: Storage | null;
  flagUrl(cc: string): string | null;
  findArticle(info: PlaceInfo): Promise<WikiResult>;
  now(): Date; userOffset(): number;
}
export interface PlaceCard { show(d: PlaceCardData | null): void; setLearn(code: string | null, onLearn: (code: string) => void): void; destroy(): void }
export const COLLAPSE_KEY = 'placeCardCollapsed';

export function createPlaceCard(panel: HTMLElement, sheetHost: HTMLElement, deps: PlaceCardDeps): PlaceCard {
  const { i18n } = deps;
  const t = (k: string) => escapeHtml(i18n.t(k));
  panel.innerHTML = `
    <div class="place__head">
      <span class="section-label">${t('place.title')}</span>
      <button class="btn--ghost pc__collapse">${icons.chevronRight}</button>
    </div>
    <p class="panel-empty pc__empty">${t('place.empty')}</p>
    <div class="pc__content" hidden>
      <div class="pc__title">
        <img class="pc__flag" width="54" height="36" alt="">
        <div><div class="pc__name"></div><div class="pc__country"></div></div>
      </div>
      <div class="pc__tiles">
        <div class="pc__tile pc__time"><div class="pc__label">${t('place.time')}</div><div class="pc__clock"></div><div class="pc__diff"></div></div>
        <div class="pc__tile pc__langtile"><div class="pc__label">${t('place.lang')}</div><div class="pc__langs"></div>
          <div class="pc__match" hidden>${t('place.lang.match')}</div>
          <button class="pc__learn" type="button" hidden>${t('place.learn')}</button></div>
      </div>
      <div class="pc__wiki" hidden>
        <img class="pc__photo" alt="" referrerpolicy="no-referrer">
        <p class="pc__note" hidden>${t('place.wiki.english')}</p>
        <p class="pc__text"></p>
        <a class="pc__link" target="_blank" rel="noopener noreferrer"></a>
      </div>
    </div>`;
  const sheet = document.createElement('div');
  sheet.className = 'pc-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="pcs__handle"></div>
    <div class="pcs__top">
      <img class="pcs__flag" width="36" height="24" alt="">
      <div class="pcs__head"><div class="pcs__name"></div><div class="pcs__meta"></div></div>
      <div class="pcs__clock"></div>
    </div>
    <p class="pcs__text"></p>
    <a class="pcs__link" target="_blank" rel="noopener noreferrer"></a>`;
  sheetHost.append(sheet);

  const q = <T extends HTMLElement>(root: HTMLElement, s: string) => root.querySelector<T>(s)!;
  const el = {
    collapse: q<HTMLButtonElement>(panel, '.pc__collapse'), empty: q(panel, '.pc__empty'), content: q(panel, '.pc__content'),
    flag: q<HTMLImageElement>(panel, '.pc__flag'), name: q(panel, '.pc__name'), country: q(panel, '.pc__country'),
    langTile: q(panel, '.pc__langtile'), match: q(panel, '.pc__match'), learnBtn: q<HTMLButtonElement>(panel, '.pc__learn'),
    time: q(panel, '.pc__time'), clock: q(panel, '.pc__clock'), diff: q(panel, '.pc__diff'), langs: q(panel, '.pc__langs'),
    wiki: q(panel, '.pc__wiki'), photo: q<HTMLImageElement>(panel, '.pc__photo'), note: q(panel, '.pc__note'),
    text: q(panel, '.pc__text'), link: q<HTMLAnchorElement>(panel, '.pc__link'),
    sFlag: q<HTMLImageElement>(sheet, '.pcs__flag'), sName: q(sheet, '.pcs__name'), sMeta: q(sheet, '.pcs__meta'),
    sClock: q(sheet, '.pcs__clock'), sText: q(sheet, '.pcs__text'), sLink: q<HTMLAnchorElement>(sheet, '.pcs__link'),
  };

  let collapsed = false;
  try { collapsed = deps.storage?.getItem(COLLAPSE_KEY) === '1'; } catch { collapsed = false; }
  const applyCollapse = () => {
    panel.classList.toggle('is-collapsed', collapsed);
    el.collapse.setAttribute('aria-label', i18n.t(collapsed ? 'place.expand' : 'place.collapse'));
  };
  el.collapse.addEventListener('click', () => {
    collapsed = !collapsed;
    try { deps.storage?.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* unavailable */ }
    applyCollapse();
  });
  applyCollapse();
  el.photo.addEventListener('error', () => { el.photo.hidden = true; });
  el.flag.addEventListener('error', () => { el.flag.hidden = true; el.sFlag.hidden = true; });

  let token = 0;
  let currentPlaceId: string | null = null;
  let tz = '';
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = () => {
    if (!tz) return;
    const now = deps.now();
    el.clock.textContent = formatClock(tz, now, i18n.locale);
    el.sClock.textContent = el.clock.textContent;
    el.diff.textContent = diffLabel(i18n, offsetMinutes(tz, now), deps.userOffset());
  };
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (!tz) return;
    timer = setTimeout(() => { tick(); schedule(); }, msUntilNextMinute(deps.now().getTime()));
  };

  function renderWiki(r: WikiResult) {
    const s = r.summary;
    el.wiki.hidden = !s && !r.link;
    el.photo.hidden = !s?.image;
    if (s?.image) el.photo.src = s.image;
    el.note.hidden = s?.lang !== 'en';
    el.text.hidden = !s;
    el.text.textContent = s?.text ?? '';
    el.sText.textContent = s?.text ?? '';
    el.sText.hidden = !s;
    const label = i18n.t(s ? 'place.wiki.read' : 'place.wiki.more');
    for (const a of [el.link, el.sLink]) {
      a.hidden = !r.link;
      if (r.link) a.href = r.link;
    }
    el.link.textContent = `${label} ↗`;
    el.sLink.textContent = `${i18n.t('place.wiki.more')} ↗`;
  }

  let learnCode: string | null = null;
  let onLearn: ((code: string) => void) | null = null;
  let stationLangs: string[] = [];
  let learnTarget: string | null = null;
  function renderLearn() {
    const match = !!learnCode && stationLangs.includes(learnCode);
    el.langTile.classList.toggle('is-match', match);
    el.match.hidden = !match;
    learnTarget = stationLangs.find((c) => languageNames([c], i18n.locale) !== '') ?? null;
    el.learnBtn.hidden = match || !learnTarget;
  }
  el.learnBtn.addEventListener('click', () => { if (learnTarget) onLearn?.(learnTarget); });

  return {
    show(d) {
      if (!d) {
        token++;
        currentPlaceId = null;
        tz = '';
        schedule();
        el.empty.hidden = false;
        el.content.hidden = true;
        sheet.hidden = true;
        return;
      }
      // Language depends on the station: refresh it even when the place is the same (pause/resume, next in the same city).
      const langs = languageNames(d.station.langs, i18n.locale) || i18n.t('place.lang.none');
      el.langs.textContent = langs;
      stationLangs = d.station.langs;
      renderLearn();
      const country = countryName(d.place.cc, i18n.locale);
      el.sMeta.textContent = `${d.place.kind === 'country' ? i18n.t('place.approx') : country} · ${langs}`;
      if (d.place.id === currentPlaceId) return;
      currentPlaceId = d.place.id;
      const my = ++token;

      el.empty.hidden = true;
      el.content.hidden = false;
      sheet.hidden = false;
      const title = placeTitle(d.place, i18n.locale);
      el.name.textContent = title;
      el.sName.textContent = title;
      el.country.textContent = d.place.kind === 'country' ? i18n.t('place.approx') : country;
      const flag = deps.flagUrl(d.place.cc);
      for (const img of [el.flag, el.sFlag]) { img.hidden = !flag; if (flag) img.src = flag; }

      tz = d.info && isValidTimeZone(d.info.tz) ? d.info.tz : '';
      el.time.hidden = !tz;
      el.sClock.hidden = !tz;
      tick();
      schedule();

      el.wiki.hidden = true;
      el.sText.hidden = true;
      el.sLink.hidden = true;
      if (!d.info || (!d.info.wikiRu && !d.info.wikiEn)) return;
      void deps.findArticle(d.info).then((r) => { if (my === token) renderWiki(r); });
    },
    setLearn(code, cb) {
      learnCode = code;
      onLearn = cb;
      renderLearn();
    },
    destroy() {
      token++;
      if (timer !== undefined) clearTimeout(timer);
      sheet.remove();
    },
  };
}
