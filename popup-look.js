// The popup's look (theme, accent) before its first paint: as it last showed (kept by popup.js in the
// extension's own storage, which a page reads at once), else tabcat's own purple. popup.js reads the settings
// again, but only after the popup has shown. (A classic script in the head: extension pages allow no inline ones.)
{
  let look = null;
  try { look = JSON.parse(localStorage.getItem('tabcat:popupLook')); } catch { /* none kept */ }
  look ||= { theme: 'auto', accent: 'purple', hue: 300 };
  const root = document.documentElement;
  if (look.theme === 'light' || look.theme === 'dark') root.dataset.theme = look.theme;
  if (look.accent === 'mono') root.dataset.accent = 'mono';
  else if (look.hue != null && look.accent !== 'orange') { root.dataset.accent = look.accent; root.style.setProperty('--hue', look.hue); }
}
