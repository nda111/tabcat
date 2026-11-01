// "Connect to a server": the address of a tabcat dashboard the user's own server hosts. Connecting asks
// the browser to let tabcat work there (only a click in an extension page may ask), checks that a tabcat
// dashboard answers, then the extension links up with it (see connectServer in background.js) and opens it.
import * as S from './lib/store.js';
import { setLang, getLang, t } from './lib/i18n.js';

const $ = (s) => document.querySelector(s);
const settings = await S.loadSettings();
setLang(settings.language);
document.documentElement.lang = getLang();
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
if (settings.theme !== 'auto') document.documentElement.dataset.theme = settings.theme;
const hue = S.ACCENT_HUES[settings.accent];
if (settings.accent === 'mono') document.documentElement.dataset.accent = 'mono';
else if (hue != null && settings.accent !== 'orange') {
  document.documentElement.dataset.accent = settings.accent;
  document.documentElement.style.setProperty('--hue', hue);
}
document.title = `tabcat · ${t('connectTitle')}`;
$('#address').focus();

// The window fits what it holds, in this language (opened as a small window: not when it's a tab)
(async () => {
  const w = await chrome.windows.getCurrent().catch(() => null);
  if (w?.type !== 'popup') return;
  await document.fonts.ready; // (the line breaks are the fonts')
  const frame = window.outerHeight - window.innerHeight;
  const need = Math.ceil(document.body.getBoundingClientRect().height) + frame;
  if (Math.abs(w.height - need) > 1) await chrome.windows.update(w.id, { height: need }).catch(() => {});
})();
// Esc closes it, as Cancel does
addEventListener('keydown', (e) => { if (e.key === 'Escape') window.close(); });

const say = (key, error = false) => { $('#msg').textContent = key ? t(key) : ''; $('#msg').classList.toggle('error', error); };

// what was typed, as the origins to try: as typed, or, with no http:// or https://, https first, then http
function originsOf(text) {
  const v = text.trim();
  if (!v) return null;
  const typed = /^[a-z]+:\/\//i.test(v);
  const out = [];
  for (const full of typed ? [v] : [`https://${v}`, `http://${v}`]) {
    try {
      const u = new URL(full);
      if (/^https?:$/.test(u.protocol) && /^([a-z0-9-]+\.)*[a-z0-9-]+$|^\[[0-9a-f:.]+\]$/i.test(u.hostname)) out.push(u.origin);
    } catch { /* not an address */ }
  }
  return out.length ? out : null;
}

// a tabcat dashboard there: its web app manifest names it
async function isTabcat(origin) {
  const r = await fetch(`${origin}/manifest.webmanifest`, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
  if (!r.ok) return false;
  return (await r.json().catch(() => ({}))).name === 'tabcat';
}

// opened from a tabcat dashboard on a server (see background.js): its address, ready to connect
const given = new URLSearchParams(location.search).get('address');
if (given) $('#address').value = given.replace(/^https?:\/\//, '');

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const origins = originsOf($('#address').value);
  if (!origins) return say('connectBadUrl', true);
  // (permissions go by host, any port, both schemes, one pattern each as the manifest's optional ones are;
  // asked first, straight from the click: only a click may ask)
  const patterns = ['https', 'http'].map((p) => `${p}://${new URL(origins[0]).hostname}/*`);
  if (!(await chrome.permissions.request({ origins: patterns }).catch(() => false))) return say('connectDenied', true);
  say('connectChecking');
  $('#go').disabled = true;
  let origin = null, reached = false;
  for (const o of origins) {
    try { if (await isTabcat(o)) { origin = o; break; } reached = true; } catch { /* not reached */ }
  }
  if (!origin) {
    $('#go').disabled = false;
    if (!settings.server || new URL(settings.server).hostname !== new URL(origins[0]).hostname) await chrome.permissions.remove({ origins: patterns }).catch(() => {});
    return say(reached ? 'connectNotTabcat' : 'connectUnreachable', true);
  }
  const r = await chrome.runtime.sendMessage({ cmd: 'connectServer', args: { origin } });
  if (r?.error) { $('#go').disabled = false; $('#msg').textContent = r.error; $('#msg').classList.add('error'); return; }
  window.close();
});
$('#cancel').addEventListener('click', () => window.close());
