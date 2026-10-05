export type NavTab = 'globe' | 'search' | 'favorites';
export interface MobileNavDeps { onGlobe(): void; onSearch(): void; onFavorites(): void; onLearn(): void }
export interface MobileNav { set(tab: NavTab): void; setLearning(on: boolean): void }

// Phone bottom menu: Globe / Search / Favorites / Learn (Learn opens the language list, it is not a tab).
export function createMobileNav(buttons: HTMLButtonElement[], d: MobileNavDeps): MobileNav {
  const actions: Record<string, () => void> = { globe: d.onGlobe, search: d.onSearch, favorites: d.onFavorites, learn: d.onLearn };
  for (const b of buttons) b.addEventListener('click', () => actions[b.dataset.nav ?? '']?.());
  const nav: MobileNav = {
    set(tab) {
      for (const b of buttons) {
        const on = b.dataset.nav === tab;
        b.classList.toggle('is-active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      }
    },
    setLearning(on) { buttons.find((b) => b.dataset.nav === 'learn')?.classList.toggle('is-learning', on); },
  };
  nav.set('globe');
  return nav;
}
