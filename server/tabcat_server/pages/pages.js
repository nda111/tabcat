// What the server's pages share: the language and look the dashboard last used on this server (it keeps
// them in this origin's storage), the text in it, and calling the server's API.
import { STRINGS } from './strings.js';

const store = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

// the language: the dashboard's setting ('auto': the browser's), else the browser's
const LANGS = Object.keys(STRINGS);
function pickLang() {
  const set = store('tabcat:lang');
  if (set && set !== 'auto' && LANGS.includes(set)) return set;
  for (const l of navigator.languages || [navigator.language]) {
    const hit = LANGS.find((x) => x.toLowerCase() === l.toLowerCase()) || LANGS.find((x) => x.split('-')[0] === l.split('-')[0]);
    if (hit) return hit;
  }
  return 'en';
}
export const lang = pickLang();
document.documentElement.lang = lang;
export function t(key, vars = {}) {
  const s = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
for (const el of document.querySelectorAll('[data-t-placeholder]')) el.placeholder = t(el.dataset.tPlaceholder);

// (the look: look.js, before the first paint)

export const $ = (s, root = document) => root.querySelector(s);
export const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter((x) => x != null && x !== false));
  return el;
};

// The API: JSON both ways; a failure is an Error carrying the status, its message in the page's language
const KNOWN = { 401: 'errWrong', 429: 'errMany' };
export async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(`/api/${path}`, {
    method, credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = r.headers.get('content-type')?.includes('json') ? await r.json().catch(() => null) : null;
  if (!r.ok) {
    const detail = data?.detail || r.statusText;
    const key = /turned off/.test(detail) ? 'errOff' : /closed/.test(detail) ? 'errClosed' : /invitation/.test(detail) ? 'errInvite'
      : /taken/.test(detail) ? 'errTaken' : /bad username|too short/.test(detail) ? 'errBad' : KNOWN[r.status];
    const err = new Error(key ? t(key) : t('errGeneric', { detail }));
    err.status = r.status;
    throw err;
  }
  return data;
}

// a form's message line
export function say(el, text, kind = '') {
  el.textContent = text || '';
  el.className = `msg ${kind}`;
}

export const date = (s) => s ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s * 1000)) : t('never');
export const bytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
