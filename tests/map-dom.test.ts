import { expect, test } from 'vitest';
import { createPulse } from '../src/map/pulse';
import { renderStarfield } from '../src/map/starfield';

test('pulse has a ring and a dot', () => {
  const p = createPulse();
  expect(p.className).toBe('pulse');
  expect(p.querySelector('.pulse__ring')).not.toBeNull();
  expect(p.querySelector('.pulse__dot')).not.toBeNull();
});

test('starfield is deterministic, 1–2 px, 25–75 % opacity', () => {
  const a = document.createElement('div');
  const b = document.createElement('div');
  renderStarfield(a, 50, 11);
  renderStarfield(b, 50, 11);
  expect(a.children).toHaveLength(50);
  expect(a.innerHTML).toBe(b.innerHTML);
  for (const s of a.children) {
    const el = s as HTMLElement;
    expect(['1px', '2px']).toContain(el.style.width);
    expect(Number(el.style.opacity)).toBeGreaterThanOrEqual(0.25);
    expect(Number(el.style.opacity)).toBeLessThanOrEqual(0.75);
  }
});
