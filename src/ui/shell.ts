import { SEO_PAGES_LIVE } from '../app/config';
import type { I18n } from '../i18n/i18n';
import { escapeHtml } from './html';
import { icons } from './icons';
import './tokens.css';
import './shell.css';
import './learn.css';
import './conveniences.css';
import './browse.css';
import './mobile.css';

export interface ShellRefs {
  header: HTMLElement; left: HTMLElement; panelBody: HTMLElement; closePanel: HTMLButtonElement;
  stage: HTMLElement; stars: HTMLElement; map: HTMLElement; status: HTMLElement;
  zoomIn: HTMLButtonElement; zoomOut: HTMLButtonElement; viewButtons: HTMLButtonElement[];
  placeCard: HTMLElement; player: HTMLElement;
  banner: HTMLElement; learnButton: HTMLButtonElement;
  tabs: HTMLButtonElement[]; searchInput: HTMLInputElement; surpriseButton: HTMLButtonElement;
  netBanner: HTMLElement; root: HTMLElement; installButton: HTMLButtonElement;
  navButtons: HTMLButtonElement[]; sheetHandle: HTMLElement; placeToggle: HTMLButtonElement; cookiesButton: HTMLButtonElement;
}

export function renderShell(root: HTMLElement, i18n: I18n): ShellRefs {
  const t = (key: string) => escapeHtml(i18n.t(key));
  document.title = i18n.t('app.title');
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
    <div class="net-banner" hidden></div>
    <div class="shell__body">
      <aside class="shell__left">
        <div class="sheet__handle" role="button" tabindex="0" aria-label="${t('sheet.handle')}"></div>
        <div class="panel-top">
          <nav class="tabs">
            <button class="tabs__tab is-active" data-tab="here">${t('panel.tabs.here')}</button>
            <button class="tabs__tab" data-tab="favorites">${t('panel.tabs.favorites')}</button>
            <button class="tabs__tab" data-tab="history">${t('panel.tabs.history')}</button>
          </nav>
          <button class="btn--ghost panel-close" aria-label="${t('panel.close')}">${icons.x}</button>
        </div>
        <div class="panel-body"><p class="panel-empty">${t('panel.empty')}</p></div>
      </aside>
      <main class="shell__stage">
        <div class="stage__stars" aria-hidden="true"></div>
        <div class="stage__map"></div>
        <button class="btn btn--outline btn--icon stage__place-toggle" type="button" aria-label="${t('place.show')}" aria-expanded="false">${icons.info}</button>
        <p class="stage__status" role="status"></p>
        <div class="stage__zoom">
          <button data-zoom="in" aria-label="${t('map.zoomIn')}">+</button>
          <button data-zoom="out" aria-label="${t('map.zoomOut')}">−</button>
        </div>
        <p class="stage__attribution">${t('footer.attribution')}<span${SEO_PAGES_LIVE ? '' : ' hidden'}> · <a href="radio/">${t('footer.byCountry')}</a></span><span class="cookies-link" hidden> · <button type="button" class="link-btn" data-action="cookies">${t('footer.cookies')}</button></span></p>
      </main>
      <aside class="shell__place">
        <div class="place__head">
          <span class="section-label">${t('place.title')}</span>
          <button class="btn--ghost" aria-label="${t('place.collapse')}">${icons.chevronRight}</button>
        </div>
      </aside>
    </div>
    <footer class="shell__player"></footer>
    <nav class="mobile-nav" aria-label="${t('nav.label')}">
      <button type="button" data-nav="globe"><span class="mobile-nav__bar"></span><span>${t('nav.globe')}</span></button>
      <button type="button" data-nav="search"><span class="mobile-nav__bar"></span><span>${t('nav.search')}</span></button>
      <button type="button" data-nav="favorites"><span class="mobile-nav__bar"></span><span>${t('nav.favorites')}</span></button>
      <button type="button" data-nav="learn"><span class="mobile-nav__bar"></span><span>${t('nav.learn')}</span></button>
    </nav>
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
    tabs: [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')],
    searchInput: q<HTMLInputElement>('.search input'),
    surpriseButton: q<HTMLButtonElement>('[data-action="surprise"]'),
    netBanner: q('.net-banner'),
    root,
    installButton: q<HTMLButtonElement>('[data-action="install"]'),
    navButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-nav]')],
    sheetHandle: q('.sheet__handle'),
    placeToggle: q<HTMLButtonElement>('.stage__place-toggle'),
    cookiesButton: q<HTMLButtonElement>('[data-action="cookies"]'),
  };
}
