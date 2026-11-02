// The look (theme, accent) the dashboard last used on this server, before the page first paints (a classic
// script in the head: pages.js, a module, runs only after). With none kept: tabcat's own, purple (pages.css).
try {
  const look = JSON.parse(localStorage.getItem('tabcat:look') || '{}');
  const root = document.documentElement;
  if (look.theme === 'light' || look.theme === 'dark') root.dataset.theme = look.theme;
  if (look.accent === 'mono' || look.accent === 'orange') root.dataset.accent = look.accent;
  else if (look.hue != null && look.accent) { root.dataset.accent = look.accent; root.style.setProperty('--hue', look.hue); }
} catch { /* storage unavailable: tabcat's own */ }

// Between the server's own pages, the page left fades out (see pages.css); to the dashboard, which opens in its
// own way, it just goes. (Cut short, say by a quick click on: nothing to report.)
const OWN = ['/login', '/setup', '/account', '/admin'];
addEventListener('pageswap', (e) => {
  const vt = e.viewTransition;
  if (!vt) return;
  for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) p?.catch(() => {});
  const to = e.activation?.entry?.url;
  if (!to || !OWN.includes(new URL(to).pathname)) vt.skipTransition();
});
addEventListener('pagereveal', (e) => { const vt = e.viewTransition; if (vt) for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) p?.catch(() => {}); });

// (should a page's script fail, it shows anyway after a while: see reveal in pages.js)
setTimeout(() => document.body?.removeAttribute('data-checking'), 4000);

// Reloaded: the browser holds the page as it was until this one draws, so it comes as it ends up, not rising in
// (rising from nothing, it would blink: there, then gone, then back). Coming from elsewhere, it rises in.
if (performance.getEntriesByType?.('navigation')[0]?.type === 'reload') document.documentElement.classList.add('reloaded');
