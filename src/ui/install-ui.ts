import type { I18n } from '../i18n/i18n';
import type { InstallState } from '../pwa/install';
import { icons } from './icons';

export function createInstallUi(d: { button: HTMLButtonElement; host: HTMLElement; i18n: I18n; state: InstallState; narrow(): boolean }): { setContext(c: 'share' | 'normal'): void } {
  const { i18n, state } = d;
  let context: 'share' | 'normal' = 'normal';
  let banner: HTMLElement | null = null;
  d.button.addEventListener('click', () => { void state.install(); });

  function render() {
    d.button.hidden = state.mode() !== 'prompt';
    const want = d.narrow() && state.showBanner(context);
    if (!want) { banner?.remove(); banner = null; return; }
    banner?.remove();
    banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', i18n.t('install.button'));
    const name = i18n.t('app.name');
    const text = document.createElement('span');
    text.className = 'install-banner__text';
    text.textContent = state.mode() === 'ios' ? i18n.t('install.ios', { name }) : i18n.t('install.banner', { name });
    banner.innerHTML = icons.download;
    banner.append(text);
    if (state.mode() === 'prompt') {
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'install-banner__go';
      go.textContent = i18n.t('install.button');
      go.addEventListener('click', () => { void state.install(); });
      banner.append(go);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'install-banner__close';
    close.setAttribute('aria-label', i18n.t('install.close'));
    close.innerHTML = icons.x;
    close.addEventListener('click', () => state.dismiss());
    banner.append(close);
    d.host.append(banner);
  }
  state.subscribe(render);
  render();
  return { setContext(c) { context = c; render(); } };
}
