export function dotStyle(pop: number, maxPop: number): { size: number; opacity: number } {
  const t = maxPop > 0 ? Math.min(1, Math.log1p(Math.max(0, pop)) / Math.log1p(maxPop)) : 0;
  return { size: Math.round((3 + 4 * t) * 10) / 10, opacity: Math.round((0.45 + 0.55 * t) * 100) / 100 };
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.trim().replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
