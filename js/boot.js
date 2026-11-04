// Run first, before the page is drawn (see index.html): kept apart from the page itself, as the page's
// Content-Security-Policy runs no script written into it
// Chrome's offer to install the page can come before app.js runs: kept for it
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.installPrompt = e; });
// Before anything is drawn: the last theme / colour seen (so the page doesn't flash the defaults), and
// the page kept hidden until the language, panel widths and the rest are applied (app.js lifts this;
// the timeout is a safety net).
try {
  const look = JSON.parse(localStorage.getItem('tabcat:look') || 'null');
  const root = document.documentElement;
  if (look?.theme && look.theme !== 'auto') root.dataset.theme = look.theme;
  if (look?.fs) root.style.setProperty('--fs', look.fs); // (the text size as last shown: no jump once settings come)
  const accent = look?.accent || 'purple', hue = look?.accent ? look.hue : 300; // (a first visit: the default, purple)
  if (accent === 'mono') root.dataset.accent = 'mono';
  else if (accent !== 'orange' && hue != null) { root.dataset.accent = accent; root.style.setProperty('--hue', hue); }
} catch { /* storage unavailable */ }
document.documentElement.classList.add('booting');
// Back or forward from here to the server's own pages (account, admin): the browser fades this page out as it
// goes (see @view-transition in app.css), as a click there does (leaveFor in app.js). Any other way, and
// coming here, no browser transition: the dashboard opens in its own way.
addEventListener('pageswap', (e) => {
  const vt = e.viewTransition;
  if (!vt) return;
  for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) p?.catch(() => {});
  const to = e.activation?.entry?.url;
  if (e.activation?.navigationType !== 'traverse' || !to || !['/login', '/setup', '/account', '/admin'].includes(new URL(to).pathname)) vt.skipTransition();
});
addEventListener('pagereveal', (e) => { const vt = e.viewTransition; if (vt) { for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) p?.catch(() => {}); vt.skipTransition(); } });
// (reloaded: the browser holds the page as it was until this one draws; it then comes as it ends up, not
// opening from nothing, which would blink. See show in app.js.)
// (but loaded again as another account, switched to in Account: not as it was, so the spinner at once, its
// colours turning to the account's, then the opening)
let switching = false;
try { switching = !!sessionStorage.getItem('tabcat:switching'); sessionStorage.removeItem('tabcat:switching'); } catch { /* storage unavailable */ }
if (switching) document.documentElement.classList.add('boot-now');
else if (performance.getEntriesByType?.('navigation')[0]?.type === 'reload') document.documentElement.classList.add('reloaded');
// (come from the server's own pages, which showed the spinner on the way: it shows at once, not after a moment)
// (kept, not taken: every dashboard tab loading meanwhile, the extension's reloads too, shows it at once)
// (and it goes on from where it was there, turning on, not starting over: its animations set back by how long it's been up)
try {
  const t0 = +localStorage.getItem('tabcat:bootNow');
  if (Date.now() - t0 < 5000) {
    document.documentElement.classList.add('boot-now');
    document.documentElement.style.setProperty('--boot-t', `${t0 - Date.now()}ms`);
  }
} catch { /* storage unavailable */ }
setTimeout(() => document.documentElement.classList.remove('booting'), 3000);
