export function hitTest<T>(points: { x: number; y: number; r: number; item: T }[], x: number, y: number, slop = 6): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const p of points) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= p.r + slop && d < bestD) { best = p.item; bestD = d; }
  }
  return best;
}
