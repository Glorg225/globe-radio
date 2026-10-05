import { expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import { createI18n } from '../src/i18n/i18n';
import { createNetworkStatus } from '../src/pwa/network';
import { setupUpdates } from '../src/pwa/update';
import { bindNetBanner } from '../src/ui/net-banner';

const fakeWin = (onLine: boolean) => Object.assign(new EventTarget(), { navigator: { onLine } });

test('network status follows online/offline events (review focus 3)', () => {
  const win = fakeWin(true);
  const net = createNetworkStatus(win);
  const seen: boolean[] = [];
  net.subscribe((o) => seen.push(o));
  expect(net.online()).toBe(true);
  win.navigator.onLine = false;
  win.dispatchEvent(new Event('offline'));
  expect(net.online()).toBe(false);
  win.navigator.onLine = true;
  win.dispatchEvent(new Event('online'));
  expect(seen).toEqual([false, true]);
});

test('offline banner shows and hides by itself', () => {
  const win = fakeWin(false);
  const el = document.createElement('div');
  bindNetBanner(el, createI18n('ru', ru), createNetworkStatus(win));
  expect(el.hidden).toBe(false);
  expect(el.textContent).toBe('Нет подключения к интернету');
  expect(el.getAttribute('role')).toBe('status');
  win.navigator.onLine = true;
  win.dispatchEvent(new Event('online'));
  expect(el.hidden).toBe(true);
});

test('update prompt: a new version offers reload, the button applies it', async () => {
  const update = vi.fn(async () => {});
  let need!: () => void;
  const show = vi.fn();
  setupUpdates({ register: (o) => { need = o.onNeedRefresh; return update; }, show });
  expect(show).not.toHaveBeenCalled();
  need();
  expect(show).toHaveBeenCalledTimes(1);
  (show.mock.calls[0] as [() => void])[0]();
  expect(update).toHaveBeenCalledWith(true);
});
