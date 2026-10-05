import type { I18n } from '../i18n/i18n';
import type { LanguageEntry } from '../learn/language-index';
import { escapeHtml } from './html';
import { icons } from './icons';

export function createLearnBanner(host: HTMLElement, i18n: I18n, onOff: () => void): { show(e: LanguageEntry | null): void } {
  host.innerHTML = `${icons.message}<b class="learn-banner__title">${escapeHtml(i18n.t('learn.banner.title'))}</b><span class="learn-banner__info"></span><span class="spacer"></span><button class="learn-banner__off" type="button">${escapeHtml(i18n.t('learn.off'))}</button>`;
  const info = host.querySelector<HTMLElement>('.learn-banner__info')!;
  host.querySelector('button')!.addEventListener('click', onOff);
  return {
    show(e) {
      host.hidden = !e;
      if (!e) return;
      info.textContent = i18n.t('learn.banner.info', {
        lang: e.name,
        stations: i18n.t('stations.count', { count: e.stations }),
        countries: i18n.t('learn.countries', { count: e.countries }),
      });
    },
  };
}
