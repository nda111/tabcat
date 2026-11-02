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
for (const el of document.querySelectorAll('[data-t-title]')) { el.title = t(el.dataset.tTitle); el.setAttribute('aria-label', el.title); }

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
  // (no answer at all: the server unreachable, or starting again; said so, not left silent)
  const r = await fetch(`/api/${path}`, {
    method, credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).catch(() => { throw Object.assign(new Error(t('errOffline')), { status: 0 }); });
  const data = r.headers.get('content-type')?.includes('json') ? await r.json().catch(() => null) : null;
  if (!r.ok) {
    const detail = data?.detail || r.statusText;
    const key = /turned off/.test(detail) ? 'errOff' : /closed/.test(detail) ? 'errClosed' : /invitation/.test(detail) ? 'errInvite'
      : /taken/.test(detail) ? 'errTaken' : /bad username|too short/.test(detail) ? 'errBad' : /last admin/.test(detail) ? 'errLastAdmin'
      : /current password/.test(detail) ? 'errCurrent' : /file there already/.test(detail) ? 'errDbExists' : /not a usable path/.test(detail) ? 'errDbPath'
      : /where it is/.test(detail) ? 'errDbSame' : /not an image/.test(detail) ? 'errPhoto' : /name is too long/.test(detail) ? 'errNameLong' : /wrong code/.test(detail) ? 'errCode' : /took too long/.test(detail) ? 'errTicket' : /server computer/.test(detail) ? 'dbOnlyHere' : /not open to this address/.test(detail) ? 'adminHereTitle' : KNOWN[r.status];
    const err = new Error(key ? t(key) : t('errGeneric', { detail }));
    err.status = r.status;
    err.data = data; // (more than a message: e.g. where to turn something on)
    throw err;
  }
  return data;
}

// a form's message line. A new message fades in. Where the line keeps its room (class 'keep'), that's all;
// elsewhere the line opens to its height as one comes and closes as it goes, what's below gliding with it.
const BOX = ['height', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'];
const box = (el) => { const cs = getComputedStyle(el); return Object.fromEntries(BOX.map((k) => [k, cs[k]])); };
const shut = Object.fromEntries(BOX.map((k) => [k, '0px']));
export function say(el, text, kind = '') {
  text = text || '';
  const keep = el.classList.contains('keep') ? ' keep' : '';
  const was = el.textContent;
  el.closing?.cancel();
  el.closing = null;
  if (was === text) { el.className = `msg ${kind}${keep}`; return; }
  const inRow = !!el.closest('.row');
  if (!keep && !inRow && was && !text) { // (closing: the old message shrinks away first)
    const from = box(el);
    el.style.overflow = 'hidden';
    const a = el.closing = el.animate([{ ...from, opacity: 1 }, { ...shut, opacity: 0 }], { duration: 220, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
    a.finished.then(() => { el.closing = null; el.textContent = ''; el.className = `msg ${kind}`; el.style.overflow = ''; a.cancel(); }, () => { el.style.overflow = ''; });
    return;
  }
  const from = was ? null : box(el);
  el.textContent = text;
  el.className = `msg ${kind}${keep}`;
  if (!text) return;
  if (!keep && !inRow && from) { // (opening)
    const to = box(el);
    el.style.overflow = 'hidden';
    el.animate([{ ...shut, opacity: 0 }, { ...to, opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)' })
      .finished.finally(() => { el.style.overflow = ''; }).catch(() => {});
  } else el.animate([{ opacity: 0, transform: 'translateY(-3px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
}

// A short note at the bottom (copied, saved): it rises in, and goes after a while or on a click, as the
// dashboard's toasts
export function toast(text) {
  let stack = document.getElementById('toast');
  if (!stack) { stack = h('div', { id: 'toast', 'aria-live': 'polite' }); document.body.append(stack); }
  const item = h('div', { class: 'toast-item', onclick: () => away(true) }, text);
  stack.append(item);
  item.animate([{ opacity: 0, transform: 'translateY(10px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.34, 1.2, .64, 1)' });
  const timer = setTimeout(() => away(false), 3000);
  let gone = false;
  function away(clicked) {
    if (gone) return;
    gone = true;
    clearTimeout(timer);
    item.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: clicked ? 'scale(.9)' : 'translateY(8px)' }],
      { duration: 170, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
      const before = new Map([...stack.children].map((el) => [el, el.getBoundingClientRect().top]));
      item.remove();
      for (const el of stack.children) {
        const dy = before.get(el) - el.getBoundingClientRect().top;
        if (Math.abs(dy) > .5) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)' });
      }
    });
  }
}

// Change something that changes an element's width (its text, its shape), and let the width glide there
export function morph(el, change, duration = 280) {
  const from = el.getBoundingClientRect().width;
  change();
  const to = el.getBoundingClientRect().width;
  if (Math.abs(from - to) > .5) el.animate([{ width: `${from}px` }, { width: `${to}px` }], { duration, easing: 'cubic-bezier(.22, 1, .36, 1)' });
}

// The device, read from the browser's own description of itself: "Chrome on Windows"
export function deviceName(agent) {
  const browser = /Edg\//.test(agent) ? 'Edge' : /Whale\//.test(agent) ? 'Whale' : /OPR\//.test(agent) ? 'Opera' : /SamsungBrowser/.test(agent) ? 'Samsung Internet'
    : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : '';
  const os = /Windows/.test(agent) ? 'Windows' : /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android'
    : /Mac OS X|Macintosh/.test(agent) ? 'macOS' : /CrOS/.test(agent) ? 'ChromeOS' : /Linux/.test(agent) ? 'Linux' : '';
  return browser && os ? t('deviceOn', { browser, os }) : browser || os || t('unknownDevice');
}

// A record of the security record: what happened, said in words; a failure marked
export const eventLabel = (e) => t(`ev_${e.kind}`);
// (its detail, said in words where it's a known one: an unknown account, by 2FA, how many codes are left…)
export function eventDetail(e) {
  const [k, v] = (e.detail || '').split(':');
  const known = { unknown: 'evdUnknown', suspended: 'evdSuspended', '2fa': 'evd2fa', invite: 'evdInvite', admin: 'evdAdmin', user: 'evdUser', on: 'evdOn', off: 'evdOff', left: 'evdLeft', days: 'evdDays', n: 'evdHeld' };
  // (a sign-in tried with a username that's no account: which one)
  if (e.tried && !e.username) return t('evTried', { name: e.tried });
  return known[k] ? t(known[k], { n: v }) : (e.kind === 'settings_changed' || e.kind === 'db_moved' || e.kind === 'session_ended' || e.kind === 'server_updated' ? e.detail : '');
}
export const eventBad = (e) => ['login_fail', 'login_locked', 'login_refused', 'twofa_fail', 'password_wrong', 'rate_limited'].includes(e.kind);

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
    // (the text turns from dots to letters, or back, fading through and drawing together)
    for (const input of fields) {
      input.type = shown ? 'text' : 'password';
      if (input.value) input.animate([{ color: 'transparent', letterSpacing: shown ? '.12em' : '-.08em' }, { color: getComputedStyle(input).color, letterSpacing: 'normal' }],
        { duration: 240, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    }
    for (const x of buttons) {
      x.classList.toggle('shown', shown);
      x.setAttribute('aria-pressed', String(shown));
      x.title = x.ariaLabel = t(shown ? 'hidePassword' : 'showPassword');
      x.firstChild.animate([{ transform: 'scale(.8)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.34, 1.56, .64, 1)' });
    }
  });
}
passwordToggles();

// Going to the dashboard: the page fades out first, and the dashboard opens in its own way (between the server's
// own pages, the browser fades them: see pages.css). `replace`: in place of this page in the history.
// The dashboard takes a moment to come (its files, then the extension's data): meanwhile its loading spinner
// (the logo in a running ring) shows here at once, and the dashboard shows its own in the same place without
// its usual wait (told so through this origin's storage, for a few seconds: the extension may open it in a tab of its own), so one spinner seems to stay up until the board comes.
const RING = '<div class="boot-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="46"/><circle class="arc" cx="50" cy="50" r="46"/></svg><span class="logo"></span></div>';
export function go(url, replace = false) {
  const wrap = document.querySelector('.wrap');
  const toDashboard = new URL(url, location.href).pathname === '/';
  const nav = () => {
    if (toDashboard) {
      try { localStorage.setItem('tabcat:bootNow', String(Date.now())); } catch { /* storage unavailable: it waits as usual */ }
      const boot = h('div', { class: 'boot', role: 'status' });
      boot.innerHTML = RING;
      document.body.append(boot);
      boot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
    }
    if (replace) location.replace(url); else location.assign(url);
  };
  if (!wrap) return nav();
  wrap.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' })
    .finished.then(nav, nav);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href="/"]');
  if (!a || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  go('/');
});
// (back here, the browser may show the page as it was left: faded)
// Back or forward to a page the browser kept as it was: it rises in again, as when it first came (not faded, as
// it was left for the dashboard; no spinner)
addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  for (const a of document.querySelector('.wrap')?.getAnimations() || []) a.cancel();
  document.querySelector('body > .boot')?.remove();
  [...document.querySelectorAll('.wrap > *')].forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'translateY(10px) scale(.99)' }, { opacity: 1, transform: 'none' }],
    { duration: 420, delay: Math.min(i, 5) * 50, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' }));
});

// The page shows (rising in) only once what it shows is there: its data (each page's script calls this when it
// has it) and its fonts. The web fonts' stylesheet comes without holding the page up, so it's waited for first,
// then the fonts it brings: else they'd swap in mid-way, the text jumping. Not more than `cap` ms, though.
export async function reveal(cap = 600) {
  const link = document.querySelector('link[href*="fonts.googleapis"]');
  const sheet = link && link.media !== 'all' ? new Promise((r) => { link.addEventListener('load', r, { once: true }); link.addEventListener('error', r, { once: true }); }) : null;
  await Promise.race([(async () => { await sheet; await document.fonts.ready; })(), new Promise((r) => setTimeout(r, cap))]);
  document.body.removeAttribute('data-checking');
}
if (document.body.hasAttribute('data-auto-reveal')) reveal(); // (a page with nothing to fetch)

// A round (i) beside a heading: under the pointer, what it explains shows; a click or a tap opens it too (for
// touch, which has no pointer to rest), again or anywhere else, or Esc, closes it
document.addEventListener('click', (e) => {
  const dot = e.target.closest?.('.info-dot');
  for (const d of document.querySelectorAll('.info-dot.open')) if (d !== dot) d.classList.remove('open');
  if (dot && !e.target.closest('.info-tip')) dot.classList.toggle('open');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') for (const d of document.querySelectorAll('.info-dot.open')) d.classList.remove('open');
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('info-dot')) { e.preventDefault(); e.target.classList.toggle('open'); }
});

// ---------- the dashboard's feel ----------

// Scrolling with give at the ends and a slim scrollbar: the dashboard's own (its file, on this server)
import('/js/scroll-feel.js').then(({ scrollFeel }) => scrollFeel(document.documentElement, { inner: true })).catch(() => {});

// A dialog in place of the browser's confirm(): resolves true (OK) or false. `input`: a phrase to type first
// (OK waits for it). It springs in and fades out.
export function modal({ title, text = '', ok, danger = false, input = null, password = false }) {
  return new Promise((done) => {
    // (`input`: a phrase to type out first; `password`: the password too, which it then resolves with, or null)
    const phrase = input ? h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: input }) : null;
    const pass = password ? h('input', { type: 'password', autocomplete: 'current-password', placeholder: t('currentPassword') }) : null;
    const go = h('button', { type: 'submit', class: `btn ${danger ? 'danger' : 'primary'}`, disabled: !!(input || password) }, ok);
    const form = h('form', { method: 'dialog' }, h('h2', {}, title), text ? h('p', {}, text) : null, phrase, pass,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => close(false) }, t('cancel')), go));
    const dlg = h('dialog', { class: 'modal' }, form);
    const ready = () => { go.disabled = (phrase && phrase.value.trim() !== input) || (pass && !pass.value); };
    // (a letter typed in small where the phrase has it capital comes out capital: "2fa" → "2FA")
    phrase?.addEventListener('input', () => {
      const v = phrase.value, at = phrase.selectionStart;
      const fixed = [...v].map((c, i) => (input[i] && c !== input[i] && c.toUpperCase() === input[i] ? input[i] : c)).join('');
      if (fixed !== v) { phrase.value = fixed; phrase.setSelectionRange(at, at); }
    });
    for (const f of [phrase, pass]) f?.addEventListener('input', ready);
    form.addEventListener('submit', (e) => { e.preventDefault(); if (!go.disabled) close(true); });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(false); });
    let closing = false;
    function close(yes) {
      if (closing) return;
      closing = true;
      dlg.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }], { duration: 140, easing: 'ease-in' })
        .finished.then(() => { dlg.remove(); done(password ? (yes ? pass.value : null) : yes); });
    }
    document.body.append(dlg);
    dlg.showModal();
    dlg.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.34, 1.4, .64, 1)' });
    (phrase || pass || go).focus();
  });
}

// Number fields: − / + beside the value; the wheel over it steps it too; a step slides the new value in from
// the side it came. Changes are announced as a 'change' (once a burst of steps settles). `zero`: what 0 means,
// said in its place (as the dashboard's "Off").
export function stepper(input, { zero = null } = {}) {
  const wrap = h('div', { class: 'stepper' });
  input.replaceWith(wrap);
  const zeroLabel = zero ? h('span', { class: 'step-zero' }, zero) : null;
  let timer = null;
  const changed = () => { clearTimeout(timer); timer = setTimeout(() => input.dispatchEvent(new Event('change', { bubbles: true })), 400); };
  const sync = () => {
    down.disabled = input.min !== '' && +input.value <= +input.min;
    up.disabled = input.max !== '' && +input.value >= +input.max;
    if (zero) wrap.classList.toggle('zero', input.value !== '' && +input.value === 0);
  };
  const step = (dir) => {
    const before = input.value;
    if (dir > 0) input.stepUp(); else input.stepDown();
    if (input.value === before) return;
    sync();
    const shows = wrap.classList.contains('zero') && document.activeElement !== input ? zeroLabel : input;
    shows.animate([{ transform: `translateY(${dir * -7}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.34, 1.32, .64, 1)' });
    changed();
  };
  const button = (dir, label) => h('button', { type: 'button', class: 'step-btn', tabindex: '-1', 'aria-hidden': 'true',
    onpointerdown: (e) => { e.preventDefault(); step(dir); } }, h('span', {}, label));
  const down = button(-1, '−'), up = button(1, '+');
  let acc = 0;
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    acc += e.deltaY;
    if (Math.abs(acc) < 40) return;
    step(acc < 0 ? 1 : -1);
    acc = 0;
  }, { passive: false });
  input.addEventListener('input', sync);
  wrap.append(input, ...(zeroLabel ? [zeroLabel] : []), down, up);
  sync();
  return { sync };
}

// Open or close a part of the page in place: its height glides, it fades in or out (what's below glides with it)
export function fold(el, open) {
  if (open === !el.hidden) return Promise.resolve();
  el.getAnimations().forEach((a) => a.cancel());
  el.hidden = false;
  const h = el.offsetHeight;
  el.style.overflow = 'hidden';
  const frames = [{ height: '0px', opacity: 0, marginTop: '0px' }, { height: `${h}px`, opacity: 1 }];
  const a = el.animate(open ? frames : frames.reverse(), { duration: open ? 300 : 220, easing: open ? 'cubic-bezier(.22, 1, .36, 1)' : 'cubic-bezier(.4, 0, .2, 1)' });
  return a.finished.then(() => { el.style.overflow = ''; if (!open) el.hidden = true; }, () => { el.style.overflow = ''; });
}

// Rows that come, go and move glide (FLIP): `change` rebuilds `list`'s children; the ones there before move from
// where they were, new ones grow in; the box they're in grows or shrinks to fit, rather than jumping
export async function flip(list, change) {
  const keyed = (el) => el.dataset.key;
  const before = new Map([...list.children].map((el) => [keyed(el), el.getBoundingClientRect()]));
  const card = list.closest('.card'), from = card?.offsetHeight;
  await change();
  if (!before.size) return; // (the first rows, as the page loads: they come with it, not one by one after)
  const to = card?.offsetHeight;
  if (card && Math.abs(from - to) > .5) {
    card.style.overflow = 'clip';
    card.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 300, easing: 'cubic-bezier(.22, 1, .36, 1)' })
      .finished.finally(() => { card.style.overflow = ''; }).catch(() => {});
  }
  for (const el of list.children) {
    const was = before.get(keyed(el));
    if (!was) { el.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)' }); continue; }
    const now = el.getBoundingClientRect(), dy = was.top - now.top;
    if (Math.abs(dy) > .5) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  }
}

// A random password, easy to read out (no 0/O, 1/l/I)
export function randomPassword(n = 14) {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint32Array(n))].map((x) => abc[x % abc.length]).join('');
}
