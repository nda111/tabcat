// Dashboard strings. English (locales/en.js) is the source and the fallback for any missing key; the
// other languages load on demand. The language setting ('auto' or a code) is shared with the extension.
//
// A message is a string, or { one, few, many, other } chosen by Intl.PluralRules for vars.n.
// '{name}' placeholders are filled from the vars passed to t(). Keys ending in '.html' hold markup
// (our own text only, never user data).

import en from './locales/en.js';

export const LANGS = {
  en: 'English', ko: '한국어', ja: '日本語', 'zh-CN': '简体中文',
  es: 'Español', de: 'Deutsch', fr: 'Français', 'pt-BR': 'Português (Brasil)',
};

let lang = 'en';
let dict = en;
let rules = new Intl.PluralRules('en');
const loaded = { en };

// 'auto' (or an unknown code) follows the browser's preferred languages
export function resolveLang(setting) {
  if (Object.hasOwn(LANGS, setting)) return setting;
  for (const tag of navigator.languages || [navigator.language]) {
    const t = String(tag).toLowerCase();
    const hit = Object.keys(LANGS).find((l) => l.toLowerCase() === t)
      || (t.startsWith('zh') ? 'zh-CN' : t.startsWith('pt') ? 'pt-BR' : Object.keys(LANGS).find((l) => l === t.split('-')[0]));
    if (hit) return hit;
  }
  return 'en';
}

// Loads the dictionary for a setting; resolves with the language code now in use.
export async function setLang(setting) {
  const code = resolveLang(setting);
  if (!loaded[code]) {
    try { loaded[code] = (await import(`./locales/${code}.js`)).default; } catch { loaded[code] = {}; }
  }
  lang = code;
  dict = loaded[code];
  rules = new Intl.PluralRules(code);
  return code;
}

export const getLang = () => lang;

export function t(key, vars = {}) {
  let v = dict[key] ?? en[key];
  if (v == null) return key;
  if (typeof v === 'object') v = v[rules.select(vars.n ?? 0)] ?? v.other;
  return v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// Static page text: data-i18n (text), data-i18n-html (markup) and
// data-i18n-attr="title:key; aria-label:key" (attributes).
export function translateDom(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
}

// A random "Adjective Noun" name from the language's word lists. Nouns may carry a gender
// (['Loutre', 'f']) and adjectives a form per gender ({ m, f, n }); `order` puts the noun first.
export function randomName(pick = (list) => list[Math.floor(Math.random() * list.length)]) {
  const words = dict.names || en.names;
  const [noun, gender] = [].concat(pick(words.nouns));
  const a = pick(words.adjectives);
  const adj = typeof a === 'string' ? a : a[gender] ?? a.m;
  return words.order === 'noun-adj' ? `${noun} ${adj}` : `${adj}${words.joiner ?? ' '}${noun}`;
}
