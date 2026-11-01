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

const say = (key, error = false) => { $('#msg').textContent = key ? t(key) : ''; $('#msg').classList.toggle('error', error); };

// what was typed, as an origin (a bare host name gets https://), or null
function originOf(text) {
  let v = text.trim();
  if (!v) return null;
  if (!/^[a-z]+:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    return /^https?:$/.test(u.protocol) && /^([a-z0-9-]+\.)*[a-z0-9-]+$|^\[[0-9a-f:.]+\]$/i.test(u.hostname) ? u.origin : null;
  } catch { return null; }
}

// a tabcat dashboard there: its web app manifest names it
async function isTabcat(origin) {
  const r = await fetch(`${origin}/manifest.webmanifest`, { cache: 'no-store' });
  if (!r.ok) return false;
  return (await r.json().catch(() => ({}))).name === 'tabcat';
}

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const origin = originOf($('#address').value);
  if (!origin) return say('connectBadUrl', true);
  const pattern = `${new URL(origin).protocol}//${new URL(origin).hostname}/*`; // (permissions go by host: any port)
  // (asked first, straight from the click: the browser only lets a click ask)
  if (!(await chrome.permissions.request({ origins: [pattern] }).catch(() => false))) return say('connectDenied', true);
  say('connectChecking');
  $('#go').disabled = true;
  let ok;
  try { ok = await isTabcat(origin); } catch { ok = null; }
  if (!ok) {
    $('#go').disabled = false;
    if (origin !== settings.server) await chrome.permissions.remove({ origins: [pattern] }).catch(() => {});
    return say(ok === null ? 'connectUnreachable' : 'connectNotTabcat', true);
  }
  const r = await chrome.runtime.sendMessage({ cmd: 'connectServer', args: { origin } });
  if (r?.error) { $('#go').disabled = false; $('#msg').textContent = r.error; $('#msg').classList.add('error'); return; }
  window.close();
});
$('#cancel').addEventListener('click', () => window.close());
