import { beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import { createI18n } from '../src/i18n/i18n';
import { createInstall, INSTALL_DISMISSED_KEY, VISITS_KEY } from '../src/pwa/install';
import { createInstallUi } from '../src/ui/install-ui';

class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } }
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1';
const promptEvent = () => Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
  prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome: 'accepted' as const }),
});
let storage: Storage;
let win: EventTarget;
beforeEach(() => { storage = new Mem() as unknown as Storage; win = new EventTarget(); document.body.innerHTML = '<header><button class="install"></button></header><div id="host"></div>'; });

test('android: nothing until the browser offers install; then prompt; install calls the browser prompt', async () => {
  const s = createInstall({ win, storage, userAgent: ANDROID, standalone: false });
  expect(s.mode()).toBe('none');
  const e = promptEvent();
  win.dispatchEvent(e);
  expect(e.defaultPrevented).toBe(true);
  expect(s.mode()).toBe('prompt');
  await s.install();
  expect(e.prompt).toHaveBeenCalled();
  expect(s.mode()).toBe('none');
});

test('banner: on the share screen at once, otherwise from the second visit; dismiss hides it for good', () => {
  const first = createInstall({ win, storage, userAgent: ANDROID, standalone: false });
  win.dispatchEvent(promptEvent());
  expect(first.showBanner('share')).toBe(true);
  expect(first.showBanner('normal')).toBe(false);
  const second = createInstall({ win, storage, userAgent: ANDROID, standalone: false });
  win.dispatchEvent(promptEvent());
  expect(storage.getItem(VISITS_KEY)).toBe('2');
  expect(second.showBanner('normal')).toBe(true);
  second.dismiss();
  expect(storage.getItem(INSTALL_DISMISSED_KEY)).toBe('1');
  expect(second.showBanner('share')).toBe(false);
});

test('installed from the browser menu, or already standalone → nothing to offer (review focus 4)', () => {
  const s = createInstall({ win, storage, userAgent: ANDROID, standalone: false });
  win.dispatchEvent(promptEvent());
  win.dispatchEvent(new Event('appinstalled'));
  expect(s.mode()).toBe('none');
  win.dispatchEvent(promptEvent());
  expect(s.mode()).toBe('none');
  expect(createInstall({ win, storage, userAgent: IPHONE, standalone: true }).mode()).toBe('none');
});

test('iPhone Safari: instructions mode without a browser event', () => {
  expect(createInstall({ win, storage, userAgent: IPHONE, standalone: false }).mode()).toBe('ios');
});

test('ui: header button only when the browser can install; phone banner with text, install and close', async () => {
  storage.setItem(VISITS_KEY, '5');
  const s = createInstall({ win, storage, userAgent: ANDROID, standalone: false });
  const button = document.querySelector('.install') as HTMLButtonElement;
  const host = document.getElementById('host')!;
  let narrow = false;
  createInstallUi({ button, host, i18n: createI18n('ru', ru), state: s, narrow: () => narrow });
  expect(button.hidden).toBe(true);
  win.dispatchEvent(promptEvent());
  expect(button.hidden).toBe(false);
  expect(host.querySelector('.install-banner')).toBeNull();
  narrow = true;
  win.dispatchEvent(promptEvent());
  const banner = host.querySelector('.install-banner') as HTMLElement;
  expect(banner.textContent).toContain('Добавить «Радио планеты» на главный экран');
  (banner.querySelector('.install-banner__close') as HTMLButtonElement).click();
  expect(host.querySelector('.install-banner')).toBeNull();
  expect(storage.getItem(INSTALL_DISMISSED_KEY)).toBe('1');
});

test('ui: iPhone banner shows the instruction and no install button', () => {
  storage.setItem(VISITS_KEY, '5');
  const s = createInstall({ win, storage, userAgent: IPHONE, standalone: false });
  const host = document.getElementById('host')!;
  createInstallUi({ button: document.querySelector('.install') as HTMLButtonElement, host, i18n: createI18n('ru', ru), state: s, narrow: () => true });
  const banner = host.querySelector('.install-banner') as HTMLElement;
  expect(banner.textContent).toContain('На экран Домой');
  expect(banner.querySelector('.install-banner__go')).toBeNull();
});
