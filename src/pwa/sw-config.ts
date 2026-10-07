// Service worker scope rules: the installed app must never answer for static SEO pages,
// the 404 page or station data with the globe shell (index.html).
export const SW_NAVIGATE_DENYLIST: RegExp[] = [/\/radio(\/|$)/, /\/404\.html$/, /\/data\//, /\/sitemap\.xml$/, /\/robots\.txt$/];

// Not precached: data is fetched network-first, SEO pages are plain HTML for search engines.
export const SW_GLOB_IGNORES = ['data/**', 'radio/**', '404.html', 'sitemap.xml', 'robots.txt', 'og.png'];
