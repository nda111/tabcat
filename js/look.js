// The dashboard's last theme and colour, before a page of its own (404.html) first paints, as index.html does with
// boot.js (a classic script: run in the head, no module wait)
try {
  const look = JSON.parse(localStorage.getItem('tabcat:look') || 'null');
  const root = document.documentElement;
  if (look?.theme && look.theme !== 'auto') root.dataset.theme = look.theme;
  const accent = look?.accent || 'purple', hue = look?.accent ? look.hue : 300;
  if (accent === 'mono') root.dataset.accent = 'mono';
  else if (accent !== 'orange' && hue != null) { root.dataset.accent = accent; root.style.setProperty('--hue', hue); }
} catch { /* storage unavailable */ }
