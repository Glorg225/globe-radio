import { escapeHtml } from '../ui/html';

// Second line of the map tooltip (places only): local time, languages, styles; and the country flag.
export interface MapLabelDetail { flag: string | null; text: string }

// Inner HTML of the tooltip: the title (place and station count), then a muted second line.
export function tooltipContent(title: string, detail: MapLabelDetail | null): string {
  const flag = detail?.flag ? `<img class="map-tooltip__flag" src="${escapeHtml(detail.flag)}" alt="" width="16" height="12">` : '';
  const second = detail?.text ? `<span class="map-tooltip__detail">${escapeHtml(detail.text)}</span>` : '';
  return `<span class="map-tooltip__title">${flag}${escapeHtml(title)}</span>${second}`;
}

export function tooltipHtml(title: string, detail: MapLabelDetail | null): string {
  return `<div class="map-tooltip">${tooltipContent(title, detail)}</div>`;
}
