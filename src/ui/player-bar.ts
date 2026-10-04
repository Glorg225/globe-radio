import type { I18n } from '../i18n/i18n';
import type { PlayerState } from '../player/player';
import { escapeHtml } from './html';
import { icons } from './icons';

export interface PlayerBarHandlers { onToggle(): void; onNext(): void; onVolume(v: number): void; onMute(): void }
export interface PlayerBarView { state: PlayerState; place: string; volume: number; muted: boolean }

export function createPlayerBar(host: HTMLElement, i18n: I18n, h: PlayerBarHandlers): { render(v: PlayerBarView): void } {
  const t = (k: string) => escapeHtml(i18n.t(k));
  host.innerHTML = `
    <div class="pb__now">
      <div class="pb__tile"></div>
      <div class="pb__text">
        <div class="pb__name"></div>
        <div class="pb__meta"><span class="pb__live"></span><span class="pb__status"></span></div>
      </div>
      <button class="pb__star" disabled aria-label="${t('station.favorite')}" title="${t('common.soon')}">${icons.star}</button>
    </div>
    <div class="pb__center">
      <button class="pb__play"></button>
      <button class="btn btn--outline pb__next">${icons.skipForward}<span></span></button>
    </div>
    <div class="pb__right">
      <button class="btn btn--outline pb__sleep" disabled title="${t('common.soon')}">${icons.moon}<span>${t('player.sleep')}</span></button>
      <button class="btn btn--outline btn--icon pb__share" disabled aria-label="${t('player.share')}" title="${t('common.soon')}">${icons.share}</button>
      <div class="pb__volume">
        <button class="pb__mute"></button>
        <input class="pb__range" type="range" min="0" max="100" step="1" aria-label="${t('player.volume')}">
      </div>
    </div>`;
  const q = <T extends HTMLElement>(s: string) => host.querySelector<T>(s)!;
  const tileEl = q<HTMLDivElement>('.pb__tile');
  const name = q<HTMLDivElement>('.pb__name');
  const live = q<HTMLSpanElement>('.pb__live');
  const status = q<HTMLSpanElement>('.pb__status');
  const play = q<HTMLButtonElement>('.pb__play');
  const next = q<HTMLButtonElement>('.pb__next');
  const nextLabel = next.querySelector('span')!;
  const mute = q<HTMLButtonElement>('.pb__mute');
  const range = q<HTMLInputElement>('.pb__range');

  play.addEventListener('click', h.onToggle);
  next.addEventListener('click', h.onNext);
  mute.addEventListener('click', h.onMute);
  range.addEventListener('input', () => h.onVolume(Number(range.value) / 100));

  return {
    render({ state, place, volume, muted }) {
      const station = state.kind === 'idle' ? null : state.station;
      name.textContent = station ? station.name : i18n.t('player.idle');
      tileEl.textContent = station ? (station.name.trim()[0] ?? '?').toUpperCase() : '';
      const statusText: Record<PlayerState['kind'], string> = {
        idle: '',
        loading: i18n.t('player.connecting'),
        playing: i18n.t('player.live', { place }),
        paused: i18n.t('player.paused', { place }),
        error: i18n.t('player.error'),
      };
      status.textContent = statusText[state.kind];
      live.hidden = state.kind !== 'playing';
      host.classList.toggle('is-error', state.kind === 'error');
      const active = state.kind === 'loading' || state.kind === 'playing';
      play.disabled = !station;
      play.setAttribute('aria-label', i18n.t(active ? 'player.pause' : 'player.play'));
      play.innerHTML = active ? icons.pause : icons.play;
      next.disabled = !station;
      nextLabel.textContent = i18n.t(state.kind === 'error' ? 'player.tryNext' : 'player.next');
      mute.setAttribute('aria-label', i18n.t(muted ? 'player.unmute' : 'player.mute'));
      mute.innerHTML = muted ? icons.volumeOff : icons.volume;
      range.value = String(Math.round((muted ? 0 : volume) * 100));
    },
  };
}
