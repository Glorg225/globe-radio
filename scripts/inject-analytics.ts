import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { consentSnippet } from '../src/analytics/consent-snippet';

const MARKER = '<!-- analytics -->';

// Replaces the analytics marker in every built HTML page (the static SEO pages) with the consent + GA4 snippet.
export function injectAnalytics(dir: string, id: string): number {
  let count = 0;
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!name.endsWith('.html')) continue;
      const html = readFileSync(path, 'utf8');
      if (!html.includes(MARKER)) continue;
      writeFileSync(path, html.replace(MARKER, consentSnippet(id)));
      count++;
    }
  };
  walk(dir);
  return count;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const id = process.env.VITE_GA_ID ?? '';
  if (!id) {
    console.log('inject-analytics: VITE_GA_ID is not set, skipping');
  } else {
    console.log(`inject-analytics: ${injectAnalytics('dist', id)} pages`);
  }
}
