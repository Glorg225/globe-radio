// Google Analytics 4 with Consent Mode v2 (basic): nothing is sent and gtag.js is not loaded
// until the visitor presses Accept. Self-contained (inline style + script) so the same snippet
// works in the app's index.html and in the static SEO pages. Production is English-only,
// so the banner text lives here rather than in the locale files.
const STYLE = `.consent-bar{position:fixed;z-index:50;left:16px;right:16px;bottom:16px;max-width:560px;margin:0 auto;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px 14px;border-radius:14px;background:var(--surface-card,#151C38);border:1px solid var(--border-popover,#34407A);color:var(--text,#EEF1F8);font:14px/1.4 'Golos Text',system-ui,sans-serif}
.consent-bar p{flex:1 1 240px;margin:0}
.consent-bar button{height:36px;padding:0 14px;border-radius:10px;font:inherit;font-weight:600;cursor:pointer}
.consent-bar__accept{border:0;background:var(--accent,#FFB547);color:var(--on-accent,#1A1206)}
.consent-bar__reject{border:1px solid var(--border-popover,#34407A);background:transparent;color:var(--text,#EEF1F8)}`;

function script(id: string): string {
  return `(function(){
var ID=${JSON.stringify(id)},KEY='consent',loaded=false,bar=null;
window.dataLayer=window.dataLayer||[];
function gtag(){window.dataLayer.push(arguments);}
window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
gtag('js',new Date());
gtag('config',ID);
function load(){if(loaded)return;loaded=true;var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+ID;document.head.appendChild(s);}
function read(){try{return localStorage.getItem(KEY);}catch(e){return null;}}
function save(v){try{localStorage.setItem(KEY,v);}catch(e){}}
function wipe(){document.cookie.split(';').forEach(function(c){var n=c.split('=')[0].trim();if(n==='_ga'||n.indexOf('_ga_')===0){document.cookie=n+'=; Max-Age=0; path=/';}});}
function apply(v){if(v==='granted'){window['ga-disable-'+ID]=false;gtag('consent','update',{analytics_storage:'granted'});load();}else if(v==='denied'){gtag('consent','update',{analytics_storage:'denied'});if(loaded){window['ga-disable-'+ID]=true;wipe();try{location.reload();}catch(e){}}}}
function hide(){if(bar){bar.remove();bar=null;}}
function choose(v){save(v);apply(v);hide();}
function button(text,cls,v){var b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.addEventListener('click',function(){choose(v);});return b;}
function show(){if(bar)return;bar=document.createElement('div');bar.className='consent-bar';bar.setAttribute('role','region');bar.setAttribute('aria-label','Cookie consent');
var p=document.createElement('p');p.textContent='We use cookies for anonymous visit statistics (Google Analytics). Nothing is collected unless you accept.';
bar.appendChild(p);bar.appendChild(button('Accept','consent-bar__accept','granted'));bar.appendChild(button('Reject','consent-bar__reject','denied'));document.body.appendChild(bar);}
window.globeConsent={open:show};
var v=read();
if(v==='granted')apply(v);
if(v!=='granted'&&v!=='denied'){if(document.body)show();else document.addEventListener('DOMContentLoaded',show);}
})();`;
}

export function consentSnippet(id: string): string {
  if (!id) return '';
  return `<style>${STYLE}</style>\n<script>${script(id)}</script>`;
}

// Build step for index.html: the snippet goes high in <head>, right after the title.
export function withAnalytics(html: string, id: string): string {
  return id ? html.replace('</title>', `</title>\n${consentSnippet(id)}`) : html;
}
