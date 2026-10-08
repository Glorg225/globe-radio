import type { I18n } from '../i18n/i18n';
import { escapeHtml } from './html';
import { icons } from './icons';

export interface StyleSummary { name: string; stations: number; countries: number }

// "Style · Jazz · 738 stations in 75 countries · Turn off" - same look as the learn-a-language banner.
export function createStyleBanner(host: HTMLElement, i18n: I18n, onOff: () => void): { show(s: StyleSummary | null): void } {
  host.innerHTML = `${icons.volume}<b class="learn-banner__title">${escapeHtml(i18n.t('style.banner.title'))}</b><span class="learn-banner__info"></span><span class="spacer"></span><button class="learn-banner__off" type="button">${escapeHtml(i18n.t('learn.off'))}</button>`;
  const info = host.querySelector<HTMLElement>('.learn-banner__info')!;
  host.querySelector('button')!.addEventListener('click', onOff);
  return {
    show(s) {
      host.hidden = !s;
      if (!s) return;
      info.textContent = i18n.t('style.banner.info', {
        style: s.name,
        stations: i18n.t('stations.count', { count: s.stations }),
        countries: i18n.t('learn.countries', { count: s.countries }),
      });
    },
  };
}
