// Escape text before interpolating it into an innerHTML template (text or quoted attribute).
// Any string not authored in this file - translations, station data - must go through it.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
