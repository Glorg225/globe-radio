import type { I18n } from '../i18n/i18n';
import type { NetworkStatus } from '../pwa/network';

export function bindNetBanner(el: HTMLElement, i18n: I18n, net: NetworkStatus): void {
  el.setAttribute('role', 'status');
  el.textContent = i18n.t('net.offline');
  const apply = (online: boolean) => { el.hidden = online; };
  apply(net.online());
  net.subscribe(apply);
}
