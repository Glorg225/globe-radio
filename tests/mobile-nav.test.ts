import { expect, test, vi } from 'vitest';
import { createMobileNav } from '../src/ui/mobile-nav';

const make = () => {
  document.body.innerHTML = ['globe', 'search', 'favorites', 'learn'].map((n) => `<button data-nav="${n}"><span class="mobile-nav__bar"></span></button>`).join('');
  const buttons = [...document.querySelectorAll('button')] as HTMLButtonElement[];
  const d = { onGlobe: vi.fn(), onSearch: vi.fn(), onFavorites: vi.fn(), onLearn: vi.fn() };
  return { buttons, d, nav: createMobileNav(buttons, d) };
};

test('starts on the globe; set marks one tab as current', () => {
  const { buttons, nav } = make();
  expect(buttons[0].getAttribute('aria-current')).toBe('page');
  nav.set('favorites');
  expect(buttons[2].classList.contains('is-active')).toBe(true);
  expect(buttons[0].hasAttribute('aria-current')).toBe(false);
});

test('each button calls its action; learning marks the learn tab', () => {
  const { buttons, d, nav } = make();
  buttons.forEach((b) => b.click());
  expect([d.onGlobe, d.onSearch, d.onFavorites, d.onLearn].every((f) => f.mock.calls.length === 1)).toBe(true);
  nav.setLearning(true);
  expect(buttons[3].classList.contains('is-learning')).toBe(true);
});
