export interface MenuItem { label: string; onClick(): void }

let open: { anchor: HTMLElement; close(): void } | null = null;

// Small popup menu (mini-player "more"); pressing the same button again closes it.
export function openMoreMenu(anchor: HTMLElement, label: string, items: MenuItem[]): { close(): void } {
  const wasOpen = open;
  wasOpen?.close();
  if (wasOpen?.anchor === anchor) return { close() {} };
  const menu = document.createElement('div');
  menu.className = 'more-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', label);
  const buttons = items.map((it) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.textContent = it.label;
    b.addEventListener('click', () => { close(); it.onClick(); });
    menu.append(b);
    return b;
  });
  const onKey = (e: KeyboardEvent) => {
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { close(); anchor.focus(); return; }
    if (e.key === 'Tab') { close(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    }
  };
  const onOutside = (e: MouseEvent) => { if (!menu.contains(e.target as Node) && !anchor.contains(e.target as Node)) close(); };
  function close() {
    if (open?.close === close) open = null;
    menu.remove();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('mousedown', onOutside);
  }
  open = { anchor, close };
  anchor.insertAdjacentElement('afterend', menu);
  document.addEventListener('keydown', onKey);
  document.addEventListener('mousedown', onOutside);
  buttons[0]?.focus();
  return { close };
}
