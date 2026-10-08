import type { I18n } from '../i18n/i18n';
import type { CountryLink } from '../seo/country';

// "Browse by country": links from the app to the static country pages (/radio/...).
// styles: biggest styles as buttons that switch the style mode on (#40).
export function renderBrowseCountries(i18n: I18n, countries: CountryLink[], styles?: { ids: { id: string; name: string }[]; current?: string | null; onPick(id: string): void }): HTMLElement {
  const section = document.createElement('section');
  section.className = 'browse';
  const title = document.createElement('p');
  title.className = 'section-label';
  title.textContent = i18n.t('browse.title');
  const list = document.createElement('ul');
  list.className = 'browse__chips';
  for (const c of countries) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'browse__chip';
    a.href = c.path;
    a.textContent = c.name;
    li.append(a);
    list.append(li);
  }
  const all = document.createElement('a');
  all.className = 'browse__all';
  all.href = 'radio/';
  all.textContent = i18n.t('browse.all');
  section.append(title, list, all);
  if (styles?.ids.length) {
    const label = document.createElement('p');
    label.className = 'section-label browse__styles-title';
    label.textContent = i18n.t('browse.styles');
    const row = document.createElement('div');
    row.className = 'browse__chips';
    for (const s of styles.ids) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'browse__chip browse__style';
      b.textContent = s.name;
      b.classList.toggle('is-active', s.id === styles.current);
      b.setAttribute('aria-pressed', String(s.id === styles.current));
      b.addEventListener('click', () => styles.onPick(s.id));
      row.append(b);
    }
    section.append(label, row);
  }
  return section;
}
