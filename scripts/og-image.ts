import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

// One-off generator for the link preview image (1200×630) in the site's dark/amber style.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g" cx="0.34" cy="0.3" r="0.8"><stop offset="0" stop-color="#1E2C55"/><stop offset="0.55" stop-color="#111A3A"/><stop offset="1" stop-color="#070B1A"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0A0F1E"/>
  <circle cx="930" cy="315" r="250" fill="url(#g)" stroke="#2A3768" stroke-width="2"/>
  ${[[860, 240], [990, 300], [900, 390], [1040, 200], [820, 330], [960, 450], [1080, 360]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#FFB547" opacity="0.9"/>`).join('')}
  <g transform="translate(90 170)" fill="none" stroke="#FFB547" stroke-width="7" stroke-linecap="round">
    <circle cx="45" cy="45" r="40"/><ellipse cx="45" cy="45" rx="18" ry="40"/><path d="M8 32h74M8 58h74"/>
  </g>
  <text x="90" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="700" fill="#EEF1F8">Радио планеты</text>
  <text x="90" y="400" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#A3ADC8">Живое радио со всего мира на глобусе</text>
</svg>`;

const png = new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
writeFileSync('public/og.png', png);
console.log(`public/og.png ${png.length} bytes`);
