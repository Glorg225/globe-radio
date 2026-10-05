import type { I18n } from '../i18n/i18n';
import { escapeHtml } from './html';
import { icons } from './icons';
import './tokens.css';
import './shell.css';
import './learn.css';
import './conveniences.css';

export interface ShellRefs {
  header: HTMLElement; left: HTMLElement; panelBody: HTMLElement; closePanel: HTMLButtonElement;
  stage: HTMLElement; stars: HTMLElement; map: HTMLElement; status: HTMLElement;
  zoomIn: HTMLButtonElement; zoomOut: HTMLButtonElement; viewButtons: HTMLButtonElement[];
  placeCard: HTMLElement; player: HTMLElement;
  banner: HTMLElement; learnButton: HTMLButtonElement;
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
    <div class="learn-banner" hidden></div>
    <div class="shell__body">
      <aside class="shell__left">
        <div class="panel-top">
          <nav class="tabs">
            <button class="tabs__tab is-active">${t('panel.tabs.here')}</button>
            <button class="tabs__tab">${t('panel.tabs.favorites')}</button>
            <button class="tabs__tab">${t('panel.tabs.history')}</button>
          </nav>
          <button class="btn--ghost panel-close" aria-label="${t('panel.close')}">${icons.x}</button>
        </div>
        <div class="panel-body"><p class="panel-empty">${t('panel.empty')}</p></div>
      </aside>
      <main class="shell__stage">
        <div class="stage__stars" aria-hidden="true"></div>
        <div class="stage__map"></div>
        <p class="stage__status" role="status"></p>
        <div class="stage__zoom">
          <button data-zoom="in" aria-label="${t('map.zoomIn')}">+</button>
          <button data-zoom="out" aria-label="${t('map.zoomOut')}">−</button>
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
    <footer class="shell__player"></footer>
  `;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  return {
    header: q('.shell__header'),
    left: q('.shell__left'),
    panelBody: q('.panel-body'),
    closePanel: q<HTMLButtonElement>('.panel-close'),
    stage: q('.shell__stage'),
    stars: q('.stage__stars'),
    map: q('.stage__map'),
    status: q('.stage__status'),
    zoomIn: q<HTMLButtonElement>('[data-zoom="in"]'),
    zoomOut: q<HTMLButtonElement>('[data-zoom="out"]'),
    viewButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-view]')],
    placeCard: q('.shell__place'),
    player: q('.shell__player'),
    banner: q('.learn-banner'),
    learnButton: q<HTMLButtonElement>('[data-action="learn"]'),
  };
}
