import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

// Home-screen icons: the amber globe logo on the dark theme background (run once: npm run icons).
function icon(size: number, logoShare: number, radius: number): Buffer {
  const s = size * logoShare;
  const o = (size - s) / 2;
  const k = s / 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#0A0F1E"/>
  <g transform="translate(${o} ${o}) scale(${k})" fill="none" stroke="#FFB547" stroke-width="1.6" stroke-linecap="round">
    <circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17M3.5 15h17"/>
  </g>
</svg>`;
  return new Resvg(svg).render().asPng();
}

mkdirSync('public/icons', { recursive: true });
const files: [string, Buffer][] = [
  ['icon-192.png', icon(192, 0.7, 42)],
  ['icon-512.png', icon(512, 0.7, 112)],
  // Maskable: the logo stays inside the 80% safe zone, the background fills the whole square.
  ['maskable-512.png', icon(512, 0.5, 0)],
  ['apple-touch-icon.png', icon(180, 0.66, 0)],
];
for (const [name, png] of files) writeFileSync(`public/icons/${name}`, png);
console.log(`public/icons: ${files.map(([n]) => n).join(', ')}`);
