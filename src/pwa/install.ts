export const INSTALL_DISMISSED_KEY = 'installDismissed';
export const VISITS_KEY = 'visits';
export type InstallMode = 'none' | 'prompt' | 'ios';
export interface InstallState {
  mode(): InstallMode;
  showBanner(context: 'share' | 'normal'): boolean;
  install(): Promise<void>;
  dismiss(): void;
  subscribe(l: () => void): () => void;
}
interface PromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export function createInstall(d: { win: EventTarget; storage: Storage | null; userAgent: string; standalone: boolean }): InstallState {
  const read = (k: string) => { try { return d.storage?.getItem(k) ?? null; } catch { return null; } };
  const write = (k: string, v: string) => { try { d.storage?.setItem(k, v); } catch { /* unavailable */ } };
  const visits = (Number(read(VISITS_KEY)) || 0) + 1;
  write(VISITS_KEY, String(visits));
  const ios = /iPhone|iPad|iPod/.test(d.userAgent);
  let installed = d.standalone;
  let deferred: PromptEvent | null = null;
  const listeners = new Set<() => void>();
  const notify = () => { for (const l of listeners) l(); };

  d.win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    if (installed) return;
    deferred = e as PromptEvent;
    notify();
  });
  d.win.addEventListener('appinstalled', () => { installed = true; deferred = null; notify(); });

  const mode = (): InstallMode => (installed ? 'none' : deferred ? 'prompt' : ios ? 'ios' : 'none');
  return {
    mode,
    showBanner: (context) => mode() !== 'none' && read(INSTALL_DISMISSED_KEY) !== '1' && (context === 'share' || visits >= 2),
    async install() {
      const e = deferred;
      if (!e) return;
      deferred = null;
      await e.prompt();
      const choice = await e.userChoice;
      if (choice.outcome === 'accepted') installed = true;
      notify();
    },
    dismiss() { write(INSTALL_DISMISSED_KEY, '1'); notify(); },
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
