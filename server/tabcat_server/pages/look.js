// The look (theme, accent) the dashboard last used on this server, before the page first paints (a classic
// script in the head: pages.js, a module, runs only after). With none kept: tabcat's own, purple (pages.css).
try {
  const look = JSON.parse(localStorage.getItem('tabcat:look') || '{}');
  const root = document.documentElement;
  if (look.theme === 'light' || look.theme === 'dark') root.dataset.theme = look.theme;
  if (look.accent === 'mono' || look.accent === 'orange') root.dataset.accent = look.accent;
  else if (look.hue != null && look.accent) { root.dataset.accent = look.accent; root.style.setProperty('--hue', look.hue); }
} catch { /* storage unavailable: tabcat's own */ }
