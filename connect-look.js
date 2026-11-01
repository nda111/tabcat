// The connect window's look (theme, accent) before its first paint, from the address background.js opens it
// with: connect.js reads the settings again, but only after the page has shown (in the default orange).
// (A classic script in the head: extension pages allow no inline scripts.)
{
  const q = new URLSearchParams(location.search), root = document.documentElement;
  const theme = q.get('theme'), accent = q.get('accent'), hue = q.get('hue');
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  if (accent === 'mono') root.dataset.accent = 'mono';
  else if (accent && accent !== 'orange' && /^\d+$/.test(hue || '')) { root.dataset.accent = accent; root.style.setProperty('--hue', hue); }
}
