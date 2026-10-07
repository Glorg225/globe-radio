import { escapeHtml } from '../../src/ui/html';

// lastmod: snapshot timestamp (ISO); only the date is published.
export function sitemapXml(urls: string[], lastmod: string): string {
  const day = lastmod.slice(0, 10);
  const items = urls.map((u) => `  <url><loc>${escapeHtml(u)}</loc>${day ? `<lastmod>${day}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</urlset>\n`;
}

export function robotsTxt(siteUrl: string): string {
  return `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;
}
