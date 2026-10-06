type VisualViewportLike = EventTarget & { height: number; offsetTop: number };

// The on-screen keyboard covers the bottom of the layout on iOS (and Android without resizes-content):
// expose its height as --kb so fixed popups (search results, language list) can end above it.
export function bindKeyboardInset(win: { innerHeight: number; visualViewport?: VisualViewportLike | null }, el: HTMLElement): void {
  const vv = win.visualViewport;
  if (!vv) return;
  const apply = () => el.style.setProperty('--kb', `${Math.max(0, Math.round(win.innerHeight - vv.height - vv.offsetTop))}px`);
  apply();
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
}
