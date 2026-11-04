// "Let this page use tabcat?": a page on this computer (localhost, 127.0.0.1) asking to be the dashboard. Any program
// running here may serve such a page, so none is linked up with the extension until the user says so, here: a window
// of the extension's own, which no web page can click for them. Allowed, the address is remembered (see
// originAllowed in background.js) and its pages loaded again.
import * as S from './lib/store.js';
import { localizePage, applyLook, fitWindow } from './lib/page.js';

const $ = (s) => document.querySelector(s);
const settings = await S.loadSettings();
localizePage(settings.language);
applyLook(settings, { keep: true });
const origin = new URLSearchParams(location.search).get('origin') || '';
$('#origin').textContent = origin;
document.title = 'tabcat';
$('#go').focus();

fitWindow(); // (the window as tall as what it holds, in this language)
addEventListener('keydown', (e) => { if (e.key === 'Escape') window.close(); });
$('#cancel').addEventListener('click', () => window.close());
$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await chrome.runtime.sendMessage({ cmd: 'allowOrigin', args: { origin } }).catch(() => {});
  window.close();
});
