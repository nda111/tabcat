// "Let this page use tabcat?": a page on this computer (localhost, 127.0.0.1) asking to be the dashboard. Any program
// running here may serve such a page, so none is linked up with the extension until the user says so, here: a window
// of the extension's own, which no web page can click for them. Allowed, the address is remembered (see
// originAllowed in background.js) and its pages loaded again.
import * as S from './lib/store.js';
import { setLang, getLang, t } from './lib/i18n.js';

const $ = (s) => document.querySelector(s);
const settings = await S.loadSettings();
setLang(settings.language);
document.documentElement.lang = getLang();
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
const origin = new URLSearchParams(location.search).get('origin') || '';
$('#origin').textContent = origin;
document.title = 'tabcat';
$('#go').focus();

// The window fits what it holds, in this language
(async () => {
  const w = await chrome.windows.getCurrent().catch(() => null);
  if (w?.type !== 'popup') return;
  await document.fonts.ready;
  const need = Math.ceil(document.body.getBoundingClientRect().height) + window.outerHeight - window.innerHeight;
  if (Math.abs(w.height - need) > 1) await chrome.windows.update(w.id, { height: need }).catch(() => {});
})();
addEventListener('keydown', (e) => { if (e.key === 'Escape') window.close(); });
$('#cancel').addEventListener('click', () => window.close());
$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await chrome.runtime.sendMessage({ cmd: 'allowOrigin', args: { origin } }).catch(() => {});
  window.close();
});
