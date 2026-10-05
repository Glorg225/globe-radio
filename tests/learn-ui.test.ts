import { beforeEach, expect, test, vi } from 'vitest';
import ru from '../locales/ru.json';
import { createI18n } from '../src/i18n/i18n';
import type { LanguageEntry } from '../src/learn/language-index';
import { createLearnBanner } from '../src/ui/learn-banner';
import { createLearnPicker } from '../src/ui/learn-picker';

const i18n = createI18n('ru', ru);
const langs: LanguageEntry[] = [
  { code: 'es', name: 'Испанский', stations: 5081, countries: 66 },
  { code: 'en', name: 'Английский', stations: 7111, countries: 138 },
  { code: 'pt', name: 'Португальский', stations: 911, countries: 17 },
];
let button: HTMLButtonElement;
let current: string | null;
let onPick: ReturnType<typeof vi.fn<(code: string) => void>>;
beforeEach(() => {
  document.body.innerHTML = '<header><button data-action="learn"><span>Учу язык</span></button></header><main></main>';
  button = document.querySelector('button')!;
  current = null;
  onPick = vi.fn((c: string) => { current = c; });
});
const open = () => createLearnPicker(i18n, button, { languages: () => langs, current: () => current, onPick });
const pop = () => document.querySelector('.learn-pop') as HTMLElement;

test('button opens a list with search, counts and aria-expanded', () => {
  open();
  button.click();
  expect(button.getAttribute('aria-expanded')).toBe('true');
  expect((pop().querySelector('input') as HTMLInputElement).placeholder).toBe('Найти язык');
  const rows = [...pop().querySelectorAll('.learn-pop__item')].map((r) => r.textContent);
  expect(rows[0]).toContain('Испанский');
  expect(rows[0]).toContain('5 081 станция');
  expect(document.activeElement).toBe(pop().querySelector('input'));
});

test('typing filters; nothing found shows a message', () => {
  open();
  button.click();
  const input = pop().querySelector('input')!;
  input.value = 'порт';
  input.dispatchEvent(new Event('input'));
  expect(pop().querySelectorAll('.learn-pop__item')).toHaveLength(1);
  input.value = 'клингонский';
  input.dispatchEvent(new Event('input'));
  expect(pop().textContent).toContain('Ничего не найдено');
});

test('arrows + Enter pick; Esc closes and returns focus to the button (review focus 4)', () => {
  open();
  button.click();
  const input = pop().querySelector('input')!;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(onPick).toHaveBeenCalledWith('en');
  expect(pop()).toBeNull();
  expect(document.activeElement).toBe(button);
  button.click();
  pop().querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(pop()).toBeNull();
  expect(document.activeElement).toBe(button);
  expect(button.getAttribute('aria-expanded')).toBe('false');
});

test('click outside closes; click on an item picks it', () => {
  open();
  button.click();
  document.querySelector('main')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  expect(pop()).toBeNull();
  button.click();
  (pop().querySelectorAll('.learn-pop__item')[2] as HTMLButtonElement).click();
  expect(onPick).toHaveBeenCalledWith('pt');
});

test('update(): active language turns the button teal with "Учу язык: испанский"', () => {
  const picker = open();
  current = 'es';
  picker.update();
  expect(button.classList.contains('is-learning')).toBe(true);
  expect(button.textContent).toContain('Учу язык: испанский');
  current = null;
  picker.update();
  expect(button.classList.contains('is-learning')).toBe(false);
  expect(button.textContent).toContain('Учу язык');
});

test('selected language is highlighted in the list', () => {
  current = 'pt';
  open();
  button.click();
  expect(pop().querySelector('.learn-pop__item.is-selected')!.textContent).toContain('Португальский');
});

test('banner shows language, stations and countries, and turns the mode off', () => {
  const host = document.createElement('div');
  host.hidden = true;
  const onOff = vi.fn();
  const b = createLearnBanner(host, i18n, onOff);
  b.show(langs[0]);
  expect(host.hidden).toBe(false);
  expect(host.textContent).toContain('Режим «Учу язык»');
  expect(host.textContent).toContain('Испанский · 5 081 станция в 66 странах');
  (host.querySelector('button') as HTMLButtonElement).click();
  expect(onOff).toHaveBeenCalled();
  b.show(null);
  expect(host.hidden).toBe(true);
});
