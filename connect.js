// "Connect to a server": the address of a tabcat dashboard the user's own server hosts. Connecting asks
// the browser to let tabcat work there (only a click in an extension page may ask), checks that a tabcat
// dashboard answers, then the extension links up with it (see connectServer in background.js) and opens it.
import * as S from './lib/store.js';
import { t } from './lib/i18n.js';
import { localizePage, applyLook, fitWindow } from './lib/page.js';

const $ = (s) => document.querySelector(s);
const settings = await S.loadSettings();
localizePage(settings.language);
applyLook(settings, { keep: true });
document.title = 'tabcat';
$('#address').focus();

fitWindow(); // (the window as tall as what it holds, in this language)
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
  // the extension links up with it: should that fail (rarely: the leave taken back meanwhile, the extension
  // reloaded under this window…), each in its own words
  let r;
  try { r = await chrome.runtime.sendMessage({ cmd: 'connectServer', args: { origin } }); } catch (err) { r = { error: String(err?.message || err) }; }
  if (!r || r.error) {
    $('#go').disabled = false;
    const e = r?.error || '';
    return say(e === 'not-allowed' ? 'connectDenied' : e === 'bad-origin' ? 'connectBadUrl' : 'connectFailed', true);
  }
  window.close();
});
$('#cancel').addEventListener('click', () => window.close());
