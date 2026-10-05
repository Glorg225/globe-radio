import { beforeEach, expect, test } from 'vitest';
import ru from '../locales/ru.json';
import { createI18n } from '../src/i18n/i18n';
import { renderShell } from '../src/ui/shell';

let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
});

test('renders all regions with localized labels', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.header.textContent).toContain('Радио планеты');
  expect(refs.header.querySelector('input[type=search]')!.getAttribute('placeholder')).toBe('Станция, город или страна');
  expect(refs.header.textContent).toContain('Удиви меня');
  expect(refs.header.textContent).toContain('Учу язык');
  expect(refs.header.querySelector('[aria-label="Установить на устройство"]')).not.toBeNull();
  const seg = refs.header.querySelectorAll('[role=group] button');
  expect([...seg].map((b) => b.textContent)).toEqual(['3D', 'Карта']);
  expect(seg[0].getAttribute('aria-pressed')).toBe('true');
  expect(refs.left.textContent).toContain('Избранное');
  expect(refs.placeCard.textContent).toContain('Карточка места');
  expect(refs.stage.textContent).toContain('Radio Browser');
  expect(refs.status.getAttribute('role')).toBe('status');
  expect(refs.player).toBeInstanceOf(HTMLElement);
});

test('buttons whose label collapses on narrow screens keep an aria-label', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.header.querySelector('[data-action=surprise]')!.getAttribute('aria-label')).toBe('Удиви меня');
  expect(refs.header.querySelector('[data-action=learn]')!.getAttribute('aria-label')).toBe('Учу язык');
});

test('every button has an accessible name', () => {
  renderShell(root, createI18n('ru', ru));
  for (const b of root.querySelectorAll('button')) {
    const name = b.textContent!.trim() || b.getAttribute('aria-label');
    expect(name, b.outerHTML).toBeTruthy();
  }
});

test('translated strings are escaped, not parsed as HTML', () => {
  const evil = { ...ru, 'app.name': '<img src=x onerror=alert(1)>', 'header.search.placeholder': 'a"b<c' };
  const refs = renderShell(root, createI18n('ru', evil));
  expect(root.querySelector('img')).toBeNull();
  expect(refs.header.textContent).toContain('<img src=x onerror=alert(1)>');
  expect(refs.header.querySelector('input')!.getAttribute('placeholder')).toBe('a"b<c');
});

test('exposes map, stars, panel body, zoom and view buttons', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.map.classList.contains('stage__map')).toBe(true);
  expect(refs.stars.classList.contains('stage__stars')).toBe(true);
  expect(refs.panelBody.textContent).toContain('Выберите точку на глобусе');
  expect(refs.zoomIn.getAttribute('aria-label')).toBe('Приблизить');
  expect(refs.zoomOut.getAttribute('aria-label')).toBe('Отдалить');
  expect(refs.viewButtons.map((b) => b.dataset.view)).toEqual(['globe', 'map']);
  expect(refs.closePanel.getAttribute('aria-label')).toBe('Закрыть список');
  expect(refs.stage.textContent).toContain('GeoNames');
});

test('exposes the learn button and an empty banner slot under the header', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.learnButton.dataset.action).toBe('learn');
  expect(refs.banner.hidden).toBe(true);
  expect(refs.banner.previousElementSibling).toBe(refs.header);
});

test('tabs, search input and surprise button are exposed', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.tabs.map((b) => b.dataset.tab)).toEqual(['here', 'favorites', 'history']);
  expect(refs.searchInput.type).toBe('search');
  expect(refs.surpriseButton.dataset.action).toBe('surprise');
});

test('offline banner slot and root are exposed', () => {
  const refs = renderShell(root, createI18n('ru', ru));
  expect(refs.netBanner.hidden).toBe(true);
  expect(refs.root).toBe(root);
});
