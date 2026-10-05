import type { I18n } from '../i18n/i18n';
import { escapeHtml } from './html';
import { icons } from './icons';

export interface ShareCardData { name: string; flag: string | null; line: string }

export function showShareCard(host: HTMLElement, i18n: I18n, data: ShareCardData, h: { onListen(): void; onClose(): void }): { close(): void } {
  host.querySelector('.share-card')?.remove();
  const t = (k: string) => escapeHtml(i18n.t(k));
  const card = document.createElement('section');
  card.className = 'share-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', i18n.t('share.title'));
  card.innerHTML = `
    <div class="share-card__label">${t('share.title')}</div>
    <div class="share-card__tile"></div>
    <div class="share-card__name"></div>
    <div class="share-card__line"><img class="share-card__flag" width="24" height="16" alt="" hidden><span></span></div>
    <button class="share-card__listen" type="button">${icons.play}<span>${t('share.listen')}</span></button>
    <p class="share-card__note">${t('share.note')}</p>
    <button class="share-card__globe" type="button">${t('share.openGlobe')}</button>`;
  card.querySelector('.share-card__tile')!.textContent = (data.name.trim()[0] ?? '?').toUpperCase();
  card.querySelector('.share-card__name')!.textContent = data.name;
  card.querySelector('.share-card__line span')!.textContent = data.line;
  const flag = card.querySelector<HTMLImageElement>('.share-card__flag')!;
  if (data.flag) { flag.src = data.flag; flag.hidden = false; }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); h.onClose(); } };
  function close() {
    card.remove();
    host.classList.remove('is-dimmed');
    document.removeEventListener('keydown', onKey);
  }
  card.querySelector('.share-card__listen')!.addEventListener('click', () => { close(); h.onListen(); });
  card.querySelector('.share-card__globe')!.addEventListener('click', () => { close(); h.onClose(); });
  host.classList.add('is-dimmed');
  host.append(card);
  document.addEventListener('keydown', onKey);
  card.querySelector<HTMLButtonElement>('.share-card__listen')!.focus();
  return { close };
}
