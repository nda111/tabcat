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

// Is tabcat's extension here and connected to this server? (Its content script runs on a server's pages only
// once connected: then it answers a 'probe'. No answer soon: not connected, or no extension.)
// (It answers at once: a short wait is enough. Should an answer come later, on a slow machine, `late` runs.)
export function connected(late = () => {}, wait = 200) {
  return new Promise((done) => {
    let settled = false;
    const t = setTimeout(() => { settled = true; done(false); }, wait);
    function on(e) {
      if (e.source !== window || e.data?.source !== 'tabcat-ext' || e.data.event !== 'probe') return;
      removeEventListener('message', on);
      const here = e.data.data?.server === location.origin;
      if (!settled) { clearTimeout(t); settled = true; done(here); } else if (here) late();
    }
    addEventListener('message', on);
    setTimeout(() => removeEventListener('message', on), 5000);
    postMessage({ source: 'tabcat-page', cmd: 'probe' }, location.origin);
  });
}

// Not connected: the steps to connect, in place of the form, as the dashboard's own notice has them (connecting
// loads the page again). The text is the dashboard's, its links included (trusted: from strings.js).
export function showNotConnected(card) {
  const html = (tag, attrs, markup) => { const el = h(tag, attrs); el.innerHTML = markup; return el; };
  card.classList.add('notice');
  card.replaceChildren(
    h('h1', {}, t('notConnTitle')),
    h('p', {}, t('notConnNeed')),
    h('ol', { class: 'steps' }, html('li', {}, t('notConnStoreHtml')), h('li', {}, t('notConnConnect'))),
    html('p', { class: 'manual' }, t('notConnManualHtml')),
    h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn primary', onclick: () => location.reload() }, t('notConnRetry'))));
  for (const a of card.querySelectorAll('a')) Object.assign(a, { target: '_blank', rel: 'noopener' });
  // (a page can't open chrome:// addresses: that one is copied instead, as on the dashboard)
  for (const a of card.querySelectorAll('a[data-copy]')) a.addEventListener('click', (e) => { e.preventDefault(); navigator.clipboard?.writeText(a.getAttribute('href')); });
}

// Every password field gets a button to show what's typed, or hide it again: all the page's fields at once (a
// password and its repeat go together). The eye shows how it is now: slashed while hidden, plain once shown.
const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="slash" d="M4 4l16 16"/></svg>';
export function passwordToggles(root = document) {
  const fields = [...root.querySelectorAll('input[type=password]')];
  const buttons = fields.map((input) => {
    const wrap = h('span', { class: 'pw' });
    // (a field sized in its row, as on the admin page: its wrapper takes the size)
    if (input.style.cssText) { wrap.style.cssText = input.style.cssText; input.style.cssText = ''; }
    input.replaceWith(wrap);
    // (out of the Tab order: Tab goes from a password field on to the next field, its repeat)
    const b = h('button', { type: 'button', class: 'pw-eye', tabindex: '-1', 'aria-pressed': 'false', title: t('showPassword'), 'aria-label': t('showPassword') });
    b.innerHTML = EYE;
    wrap.append(input, b);
    return b;
  });
  let shown = false;
  for (const b of buttons) b.addEventListener('click', () => {
    shown = !shown;
    for (const input of fields) input.type = shown ? 'text' : 'password';
    for (const x of buttons) {
      x.classList.toggle('shown', shown);
      x.setAttribute('aria-pressed', String(shown));
      x.title = x.ariaLabel = t(shown ? 'hidePassword' : 'showPassword');
      x.firstChild.animate([{ transform: 'scale(.8)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.34, 1.56, .64, 1)' });
    }
  });
}
passwordToggles();
