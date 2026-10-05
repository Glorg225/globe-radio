import type { I18n } from '../i18n/i18n';
import { escapeHtml } from './html';
import { icons } from './icons';
import './tokens.css';
import './shell.css';

export interface ShellRefs {
  header: HTMLElement;
  left: HTMLElement;
  stage: HTMLElement;
  placeCard: HTMLElement;
  player: HTMLElement;
  status: HTMLElement;
}

export function renderShell(root: HTMLElement, i18n: I18n): ShellRefs {
  const t = (key: string) => escapeHtml(i18n.t(key));
  document.title = i18n.t('app.name');
  root.className = 'shell';
  root.innerHTML = `
    <header class="shell__header">
      <div class="logo">${icons.logo}<span class="logo__text">${t('app.name')}</span></div>
      <label class="search">${icons.search}
        <input type="search" placeholder="${t('header.search.placeholder')}" aria-label="${t('header.search.placeholder')}">
      </label>
      <button class="btn btn--accent" data-action="surprise" aria-label="${t('header.surprise')}">${icons.shuffle}<span>${t('header.surprise')}</span></button>
      <div class="spacer"></div>
      <button class="btn btn--outline" data-action="learn" aria-label="${t('header.learn')}">${icons.message}<span>${t('header.learn')}</span></button>
      <div class="segment" role="group" aria-label="${t('header.view.label')}">
        <button aria-pressed="true" data-view="globe">${t('header.view.globe')}</button>
        <button aria-pressed="false" data-view="map">${t('header.view.map')}</button>
      </div>
      <button class="btn btn--outline btn--icon" data-action="install" aria-label="${t('header.install')}">${icons.download}</button>
    </header>
    <div class="shell__body">
      <aside class="shell__left">
        <nav class="tabs">
          <button class="tabs__tab is-active">${t('panel.tabs.here')}</button>
          <button class="tabs__tab">${t('panel.tabs.favorites')}</button>
          <button class="tabs__tab">${t('panel.tabs.history')}</button>
        </nav>
        <p class="panel-empty">${t('panel.empty')}</p>
      </aside>
      <main class="shell__stage">
        <p class="stage__status" role="status"></p>
        <div class="stage__zoom">
          <button aria-label="${t('map.zoomIn')}">+</button>
          <button aria-label="${t('map.zoomOut')}">−</button>
        </div>
        <p class="stage__attribution">${t('footer.attribution')}</p>
      </main>
      <aside class="shell__place">
        <div class="place__head">
          <span class="section-label">${t('place.title')}</span>
          <button class="btn--ghost" aria-label="${t('place.collapse')}">${icons.chevronRight}</button>
        </div>
      </aside>
    </div>
    <footer class="shell__player"><span class="player__idle">${t('player.idle')}</span></footer>
  `;
  const q = (s: string) => root.querySelector<HTMLElement>(s)!;
  return {
    header: q('.shell__header'),
    left: q('.shell__left'),
    stage: q('.shell__stage'),
    placeCard: q('.shell__place'),
    player: q('.shell__player'),
    status: q('.stage__status'),
  };
}
