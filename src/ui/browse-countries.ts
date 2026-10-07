import type { I18n } from '../i18n/i18n';
import type { CountryLink } from '../seo/country';

// "Browse by country": links from the app to the static country pages (/radio/...).
export function renderBrowseCountries(i18n: I18n, countries: CountryLink[]): HTMLElement {
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
  return section;
}
