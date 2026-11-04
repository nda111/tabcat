// What the extension's own small pages (the toolbar popup, connect.html, allow.html) set up alike: their words in the
// language set, the look set (theme, accent), and, opened as a small window, its height fitted to what it holds.
import * as S from './store.js';
import { setLang, getLang, t } from './i18n.js';

export function localizePage(language) {
  setLang(language);
  document.documentElement.lang = getLang();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
}

// (as set: what showed before the first paint (see popup-look.js) replaced, not only added to; `keep`, only added to:
// a window opened with its look in its address (connect-look.js) keeps it where the settings say nothing else)
export function applyLook(settings, { keep = false } = {}) {
  const root = document.documentElement, hue = S.ACCENT_HUES[settings.accent];
  if (settings.theme !== 'auto') root.dataset.theme = settings.theme; else if (!keep) delete root.dataset.theme;
  if (settings.accent === 'mono') { root.dataset.accent = 'mono'; root.style.removeProperty('--hue'); } // (no hue: see popup.css)
  else if (hue != null && settings.accent !== 'orange') { root.dataset.accent = settings.accent; root.style.setProperty('--hue', hue); }
  else if (!keep) { delete root.dataset.accent; root.style.removeProperty('--hue'); }
  return hue;
}

// (opened as a small window, not a tab: as tall as what it holds, in this language, once the fonts are in)
export async function fitWindow() {
  const w = await chrome.windows.getCurrent().catch(() => null);
  if (w?.type !== 'popup') return;
  await document.fonts.ready;
  const need = Math.ceil(document.body.getBoundingClientRect().height) + window.outerHeight - window.innerHeight;
  if (Math.abs(w.height - need) > 1) await chrome.windows.update(w.id, { height: need }).catch(() => {});
}
