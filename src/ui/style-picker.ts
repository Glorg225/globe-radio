import type { GenreGroup } from '../data/genres';
import type { I18n } from '../i18n/i18n';

export interface StyleChoice { id: string; name: string; group: GenreGroup; stations: number }
export interface StylePickerProps { styles(): Promise<StyleChoice[] | null>; current(): string | null; onPick(id: string): void }

const GROUPS: [GenreGroup, string][] = [['genre', 'style.group.genre'], ['format', 'style.group.format'], ['decade', 'style.group.decade']];

// Header "Style" button: a dialog with the styles in three groups and their station counts.
export function createStylePicker(i18n: I18n, button: HTMLButtonElement, p: StylePickerProps): { update(): void; close(): void } {
  let pop: HTMLElement | null = null;
  let token = 0;
  const onOutside = (e: MouseEvent) => {
    if (pop && !pop.contains(e.target as Node) && !button.contains(e.target as Node)) close();
  };
  // Keyboard users tab out of the dialog: close it as a click outside would.
  const onFocusIn = (e: FocusEvent) => {
    if (pop && !pop.contains(e.target as Node) && e.target !== button) close();
  };

  function close(returnFocus = false) {
    token++;
    if (!pop) return;
    pop.remove();
    pop = null;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside);
    document.removeEventListener('focusin', onFocusIn);
    if (returnFocus) button.focus();
  }

  function render(host: HTMLElement, styles: StyleChoice[]) {
    host.replaceChildren();
    for (const [group, key] of GROUPS) {
      const list = styles.filter((s) => s.group === group && s.stations > 0);
      if (!list.length) continue;
      const heading = document.createElement('p');
      heading.className = 'style-pop__group';
      heading.textContent = i18n.t(key);
      host.append(heading);
      for (const s of list) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'learn-pop__item style-pop__item';
        item.classList.toggle('is-selected', s.id === p.current());
        const name = document.createElement('span');
        name.textContent = s.name;
        const count = document.createElement('span');
        count.className = 'learn-pop__count';
        count.textContent = i18n.t('stations.count', { count: s.stations });
        item.append(name, count);
        item.addEventListener('click', () => { close(true); p.onPick(s.id); });
        host.append(item);
      }
    }
  }

  async function open() {
    pop = document.createElement('div');
    pop.className = 'learn-pop style-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', i18n.t('style.picker'));
    const body = document.createElement('div');
    body.className = 'learn-pop__list';
    const msg = document.createElement('p');
    msg.className = 'learn-pop__empty';
    msg.textContent = i18n.t('style.loading');
    body.append(msg);
    pop.append(body);
    pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(true); } });
    button.insertAdjacentElement('afterend', pop);
    // Under its button (the button sits at the right of the header), kept inside the header's width.
    const room = (button.offsetParent as HTMLElement | null)?.clientWidth ?? 0;
    if (room) pop.style.insetInlineStart = `${Math.max(8, Math.min(button.offsetLeft, room - pop.offsetWidth - 8))}px`;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('focusin', onFocusIn);
    const my = ++token;
    const styles = await p.styles();
    if (my !== token || !pop) return;
    if (!styles) { msg.textContent = i18n.t('style.error'); return; }
    render(body, styles);
    body.querySelector<HTMLButtonElement>('.is-selected, button')?.focus();
  }

  button.addEventListener('click', () => (pop ? close() : void open()));

  return {
    update() {
      const id = p.current();
      button.classList.toggle('is-active', !!id);
      button.setAttribute('aria-pressed', String(!!id));
    },
    close: () => close(),
  };
}
