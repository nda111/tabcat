import * as B from './bridge.js';
import * as T from './tree.js';
import { renderMarkdown, toggleTask } from './markdown.js';
import { typesetMath, mathReady } from './math.js';
import { searchEmoji, favoriteEmoji, recordEmoji } from './emoji.js';
import { icon, hydrateIcons } from './icons.js';
import { LANGS, setLang, getLang, t, translateDom, randomName } from './i18n.js';
import { sampleWorkspaces } from './sample.js';

const tr = t; // for code where `t` is a tab or a drop target

const $ = (sel, root = document) => root.querySelector(sel);

let state = null;
let settings = { closeOnSave: true, groupTabs: true, checkUpdates: true, autoSuspendMinutes: 0, theme: 'auto', accent: 'purple', language: 'auto', columns: 5 };

// Accent colours for Settings > Color, in rainbow order (hue in oklch); orange is the original.
// (mono has no hue: the other theme's background, see app.css)
const ACCENTS = { red: 25, orange: 55, yellow: 90, lime: 125, green: 150, teal: 185, sky: 225, blue: 262, purple: 300, pink: 350, mono: null };
// Group colours are Chrome's tab group colours, so a tab group opened from a group looks like its card:
// [light theme, dark theme] as Chrome draws them, and the name to show (lime / teal / sky from before
// these map to the nearest).
const GROUP_COLORS = {
  red: ['#d93025', '#f28b82', 'accent.red'], orange: ['#fa903e', '#fcad70', 'accent.orange'],
  yellow: ['#f9ab00', '#fdd663', 'accent.yellow'], green: ['#188038', '#81c995', 'accent.green'],
  cyan: ['#007b83', '#78d9ec', 'accent.teal'], blue: ['#1a73e8', '#8ab4f8', 'accent.blue'],
  purple: ['#a142f4', '#d7aefb', 'accent.purple'], pink: ['#d01884', '#ff8bcb', 'accent.pink'],
};
const OLD_GROUP_COLORS = { lime: 'green', teal: 'cyan', sky: 'blue' };
const groupColor = (c) => GROUP_COLORS[c] || GROUP_COLORS[OLD_GROUP_COLORS[c]] || null;
let ui = loadUi();          // per-device view state: selected workspace / category, panel visibility
let editingNoteId = null;
let drag = null;            // { kind:'node', id, type } | { kind:'tab', tabIds } | { kind:'window', windowId } | { kind:'external' }
let pendingRender = false;
let pendingTabsRender = false;
let currentWindowId = null; // browser window that hosts this dashboard

const EMOJIS = ['🐱', '📁', '📂', '📌', '⭐', '🔥', '💡', '📚', '🧪', '💼', '🏠', '🎮', '🎵', '🎬', '🛒', '✈️',
  '💻', '🧠', '📝', '📊', '🔧', '🎨', '📰', '💬', '🔒', '🌱', '❤️', '✅', '🚀', '📥', '🗂️', '🏷️'];

// [key, input type, required]; labels are the 'field.<key>' strings
const FIELDS = {
  workspace: [['name', 'text', true], ['symbol', 'emoji'], ['description', 'textarea']],
  category: [['name', 'text', true]],
  group: [['name', 'text', true], ['symbol', 'emoji'], ['color', 'color'], ['note', 'textarea']],
  folder: [['name', 'text', true], ['symbol', 'emoji']],
  link: [['url', 'url', true], ['name', 'text', true], ['icon', 'icon'], ['description', 'textarea']],
};

/* ================= utilities ================= */

function loadUi() {
  const base = { ws: null, cat: {}, wsCollapsed: false, tabsCollapsed: false, wsWidth: null, tabsWidth: null };
  try {
    const saved = JSON.parse(localStorage.getItem('tabcat:ui') || '{}');
    if (saved.tabsHidden) saved.tabsCollapsed = true; // the old "hide tabs panel" toggle
    delete saved.tabsHidden;
    return { ...base, ...saved };
  } catch { return base; }
}
function saveUi() {
  try { localStorage.setItem('tabcat:ui', JSON.stringify(ui)); } catch { /* storage unavailable */ }
}

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

const plus = () => icon('plus');

function btn(label, title, fn) {
  // Rapid clicks must not reach a parent's double-click-to-edit handler.
  return h('button', {
    class: 'icon-btn', title, type: 'button',
    onclick: (e) => { e.stopPropagation(); fn(e); },
    ondblclick: (e) => e.stopPropagation(),
  }, label);
}

// "a · b · c" as unbreakable chunks: a narrow container wraps between chunks, never inside one.
function chunks(parts) {
  return parts.flatMap((t, i) => [i ? ' ' : null, h('span', { class: 'chunk' }, t, i < parts.length - 1 ? ' ·' : '')])
    .filter(Boolean);
}

// A count that rolls when it changes: the old number slides out and the new one in (up as it grows, down
// as it shrinks). `key` names the count across redraws; a redraw in the middle of a roll carries it on.
const ROLL = 300;
const counts = new Map(); // key -> { n, prev, at }
function rollNum(key, n) {
  const now = performance.now();
  let c = counts.get(key);
  if (!c || c.n !== n) counts.set(key, c = { n, prev: c ? c.n : null, at: c ? now : -Infinity });
  const cur = h('span', { class: 'num-now' }, n);
  const el = h('span', { class: 'num' }, cur);
  const into = now - c.at;
  if (c.prev != null && into < ROLL) {
    const up = n > c.prev;
    const old = h('span', { class: 'num-old', 'aria-hidden': 'true' }, c.prev);
    el.append(old);
    const opts = { duration: ROLL, easing: 'cubic-bezier(.22, 1, .36, 1)', delay: -into, fill: 'backwards' };
    cur.animate([{ transform: `translateY(${up ? 60 : -60}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], opts);
    old.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${up ? -60 : 60}%)`, opacity: 0 }], { ...opts, fill: 'forwards' })
      .finished.then(() => old.remove(), () => {});
  }
  return el;
}
// a counted message (e.g. "4 tabs") with its number rolling (see rollNum)
function counted(key, msg, n) {
  const s = t(msg, { n });
  const i = s.indexOf(String(n));
  return i < 0 ? s : [s.slice(0, i), rollNum(key, n), s.slice(i + String(n).length)];
}

// A node's symbol (or `fallback`): emoji as text, a letter/digit as a small badge, the logo in the
// accent colour. `fallback` may be an icon element: shown (muted, as a line icon) when there is no symbol.
function symbolEl(symbol, fallback = '') {
  if (!symbol && fallback instanceof Node) return h('span', { class: 'sym sym-icon' }, fallback);
  const s = symbol || fallback;
  if (T.isLogoSymbol(s)) return h('span', { class: 'sym sym-logo', role: 'img', 'aria-label': 'tabcat' }, h('span', { class: 'logo' }));
  return T.isLetterSymbol(s)
    ? h('span', { class: 'sym sym-letter' }, h('span', { class: 'sym-glyph' }, s))
    : h('span', { class: 'sym' }, s);
}

// A button without a tooltip; its label stays available to screen readers.
function noTip(el) {
  el.setAttribute('aria-label', el.title);
  el.removeAttribute('title');
  el.dataset.noTip = ''; // and don't fall through to a parent's tooltip
  return el;
}

function iconImg(url, icon) {
  const fallback = T.faviconFor(url);
  const img = h('img', { class: 'fav', alt: '', loading: 'lazy', draggable: 'false' });
  const show = (src) => { if (src.startsWith('chrome-extension:')) img.crossOrigin = 'anonymous'; img.src = src; }; // (readable: see blankFavicon)
  show(icon || fallback);
  img.addEventListener('error', () => {
    if (img.src !== fallback) show(fallback);
    else if (img.src !== T.BLANK_ICON) show(T.BLANK_ICON);
  });
  img.addEventListener('load', () => {
    if (!img.src.startsWith('chrome-extension:') || img.classList.contains('fav-blank')) return;
    blankFavicon().then((blank) => {
      if (blank && img.naturalWidth === blank.w && favSig(img) === blank.sig) { img.classList.add('fav-blank'); img.src = CLEAR_PIXEL; }
    });
  });
  return img;
}
// Chrome's own icon for a site it has no favicon of yet (a grey globe) is drawn in the accent colour
// instead (.fav-blank). It's told apart by its pixels, learnt once from a site no one has visited.
const CLEAR_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const sigCanvas = Object.assign(document.createElement('canvas'), { width: 16, height: 16 });
function favSig(img) {
  const g = sigCanvas.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, 16, 16);
  g.drawImage(img, 0, 0, 16, 16);
  try {
    const d = g.getImageData(0, 0, 16, 16).data;
    let sig = 0;
    for (let i = 0; i < d.length; i++) sig = (sig * 31 + d[i]) >>> 0;
    return sig;
  } catch { return null; } // (not readable: left as it is)
}
let blankLearnt = null;
function blankFavicon() {
  blankLearnt ||= (async () => {
    const img = Object.assign(new Image(), { crossOrigin: 'anonymous', src: T.faviconFor('https://tabcat.invalid/') });
    await img.decode();
    const sig = favSig(img);
    return sig == null ? null : { w: img.naturalWidth, sig };
  })().catch(() => null);
  return blankLearnt;
}

function highlight(text, q) {
  text = String(text || '');
  if (!q) return text;
  const out = [];
  const lower = text.toLowerCase();
  let i = 0, j;
  while ((j = lower.indexOf(q, i)) !== -1) {
    out.push(text.slice(i, j), h('mark', {}, text.slice(j, j + q.length)));
    i = j + q.length;
  }
  out.push(text.slice(i));
  return out;
}

// Toasts stack above the search button, newest at the bottom: a new one rises in under the others,
// which slide up; past TOAST_MAX the oldest is pushed up and out. Each fades out after its timeout.
const TOAST_MAX = 3;
const TOAST_GAP = 6;

function toast(msg, actionLabel, action) {
  const stack = $('#toast');
  stack.hidden = false;
  const before = toastRects();
  const item = h('div', { class: 'toast-item' }, h('span', {}, msg));
  if (actionLabel) item.append(h('button', { onclick: () => { dismissToast(item); action(); } }, actionLabel));
  stack.append(item);
  const live = [...stack.children].filter((el) => !el.classList.contains('leaving'));
  for (const old of live.slice(0, Math.max(0, live.length - TOAST_MAX))) pushOutToast(old, before.get(old), item);
  slideToasts(before);
  item.animate([{ opacity: 0, transform: 'translateY(10px) scale(.98)' }, { opacity: 1, transform: 'none' }],
    { duration: 280, easing: 'cubic-bezier(.34, 1.2, .64, 1)' });
  item.timer = setTimeout(() => dismissToast(item), 6000);
}

const toastRects = () => new Map([...$('#toast').children].map((el) => [el, el.getBoundingClientRect()]));

// FLIP the toasts still in the stack from where they were.
function slideToasts(before) {
  for (const el of $('#toast').children) {
    const was = before.get(el);
    if (!was || el.classList.contains('leaving')) continue;
    const now = el.getBoundingClientRect();
    const dx = was.left - now.left, dy = was.top - now.top;
    if (Math.abs(dx) + Math.abs(dy) < 1) continue;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 300, easing: SPRING });
  }
}

// Over the limit: lift the oldest out of the flow where it was and push it up out of sight.
function pushOutToast(el, was, pusher) {
  clearTimeout(el.timer);
  el.classList.add('leaving');
  el.style.position = 'absolute'; // out of the flow first: the stack shrinks, then place it against that
  const box = $('#toast').getBoundingClientRect();
  Object.assign(el.style, { left: `${was.left - box.left}px`, top: `${was.top - box.top}px`, width: `${was.width}px` });
  const lift = pusher.getBoundingClientRect().height + TOAST_GAP;
  el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${-lift}px)` }],
    { duration: 300, easing: SPRING, fill: 'forwards' }).finished.catch(() => {}).then(() => el.remove());
}

// Timed out (or acted on): fade out where it is, then the ones above close the gap.
function dismissToast(el) {
  if (el.classList.contains('leaving')) return;
  clearTimeout(el.timer);
  el.classList.add('leaving');
  el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }],
    { duration: 160, easing: 'ease-in', fill: 'forwards' })
    .finished.catch(() => {}).then(() => {
      const before = toastRects();
      el.remove();
      slideToasts(before);
    });
}

// Run an extension call, surfacing failures as a toast.
async function run(promise) {
  try { return await promise; } catch (err) {
    // (the extension went away under the page: see reloadWhenIdle, not its own English message)
    if (/extension is not available/.test(err.message)) reloadWhenIdle();
    else toast(err.message);
    return undefined;
  }
}

// The extension went away under the page (reloaded or updated: the page's link to it can't come back):
// load the page again, which links up with it anew, or waits on the notice if it is really gone. Not
// in the middle of an edit (a dialog, a note): a toast says so, and the page reloads once that's done.
let reloading = false;
function reloadWhenIdle() {
  if (reloading) return;
  reloading = true;
  const busy = () => document.querySelector('dialog[open]') || document.activeElement?.matches('input, textarea, select, [contenteditable]');
  if (busy()) toast(t('toast.extReloaded'));
  const attempt = () => (busy() ? setTimeout(attempt, 500) : location.reload());
  setTimeout(attempt, 300); // (a moment for the updated extension to start)
}
const apply = (...ops) => run(B.apply(...ops));

function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  const hue = ACCENTS[settings.accent];
  if (settings.accent === 'mono') { root.dataset.accent = 'mono'; root.style.removeProperty('--hue'); }
  else if (hue == null || settings.accent === 'orange') { delete root.dataset.accent; root.style.removeProperty('--hue'); }
  else { root.dataset.accent = settings.accent; root.style.setProperty('--hue', hue); }
  tintFavicon();
  // remembered for the next visit's first paint (see the script in index.html)
  try { localStorage.setItem('tabcat:look', JSON.stringify({ theme: settings.theme, accent: settings.accent, hue })); } catch { /* storage unavailable */ }
}

// The tab's icon: the logo in the accent colour (a pinned dashboard tab shows nothing else), as .logo
// draws it on the page: the stripes keep their shading and the eyes and nose stay white.
const logo = Object.assign(new Image(), { src: 'icons/logo.svg' });
const favCanvas = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
// A CSS colour as [r, g, b] (the canvas resolves oklch and the rest)
function rgbOf(color) {
  const g = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  g.fillStyle = color;
  g.fillRect(0, 0, 1, 1);
  return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}
function drawFavicon(rgb) {
  const g = favCanvas.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, 64, 64);
  g.drawImage(logo, 0, 0, 64, 64);
  g.globalCompositeOperation = 'color'; // the accent's hue and saturation over the logo's lightness
  g.fillStyle = `rgb(${rgb.join(' ')})`;
  g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = 'destination-in'; // back to the logo's shape
  g.drawImage(logo, 0, 0, 64, 64);
  $('#favicon').href = favCanvas.toDataURL();
}
// A new accent fades in over .16s, as on the page (redrawn each frame; a hidden tab just takes it)
let favRgb = null;
let favRun = 0;
function tintFavicon() {
  if (!logo.complete) return void logo.addEventListener('load', tintFavicon, { once: true });
  const to = rgbOf(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  const from = favRgb;
  const run = ++favRun;
  if (!from || document.hidden || from.every((v, i) => v === to[i])) return void drawFavicon(favRgb = to);
  const t0 = performance.now();
  const step = (now) => {
    if (run !== favRun) return; // a newer accent took over
    const k = Math.min(1, (now - t0) / 160);
    const e = k * k * (3 - 2 * k);
    drawFavicon(favRgb = from.map((v, i) => Math.round(v + (to[i] - v) * e)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// (the accent differs between light and dark)
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tintFavicon);

const currentWs = () => state.workspaces.find((w) => w.id === ui.ws) || state.workspaces[0] || null;
function currentCat(ws = currentWs()) {
  if (!ws) return null;
  return ws.categories.find((c) => c.id === ui.cat[ws.id]) || ws.categories[0] || null;
}
function select(wsId, catId) {
  selected.clear();
  pickedItems.clear();
  pickedGroup = null;
  if (wsId) ui.ws = wsId;
  if (wsId && catId) ui.cat[wsId] = catId;
  saveUi();
  render();
}

/* ================= rendering ================= */

function render() {
  if (!state) return;
  if (drag || document.activeElement?.classList.contains('note-edit')) { pendingRender = true; return; }
  pendingRender = false;
  const before = snapshotLayout();
  const wsChanged = before.ws && before.ws !== currentWs()?.id;
  const catChanged = before.board && before.board !== currentCat()?.id;
  renderSidebar();
  renderHead();
  if (wsChanged) switchCats(); else renderCats();
  if (catChanged || boardSwitch) switchBoard(); // groups: old ones leave, then the new ones arrive
  else renderBoard();
  animateLayout(before);
  restoreHover();
}

/* ---------- motion ---------- */

// iOS-like springs: a little overshoot, then settle.
const SPRING = 'cubic-bezier(.34, 1.32, .64, 1)';
// Moves settle with only a hint of overshoot: SPRING's overshoot grows with the distance travelled.
const GLIDE = 'cubic-bezier(.22, 1.06, .36, 1)';
const MOVABLE = '#board [data-id], #ws-list [data-id], #cat-bar [data-id]';

// Switching workspace, the category bar: the column stepper stays put, the old category buttons
// fade out where they were, the new ones settle in from just above, and "+" glides to its new place.
function switchCats() {
  const bar = $('#cat-bar');
  const oldTabs = [...bar.querySelectorAll('.cat-tab')];
  const ghosts = oldTabs.map((tab) => {
    const r = tab.getBoundingClientRect();
    const g = tab.cloneNode(true);
    g.removeAttribute('data-id');
    Object.assign(g.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', pointerEvents: 'none', zIndex: '15' });
    return g;
  });
  const addBefore = bar.querySelector(':scope > .cat-add')?.getBoundingClientRect();
  renderCats();
  document.body.append(...ghosts);
  ghosts.forEach((g) => g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out', fill: 'forwards' })
    .finished.catch(() => {}).then(() => g.remove()));
  [...bar.querySelectorAll('.cat-tab')].forEach((tab, i) => tab.animate(
    [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }],
    { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)', delay: 60 + Math.min(i, 8) * 30, fill: 'backwards' }));
  const add = bar.querySelector(':scope > .cat-add');
  if (add && addBefore) {
    const dx = addBefore.left - add.getBoundingClientRect().left;
    if (Math.abs(dx) > 1) add.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 380, easing: SPRING });
  }
}

// Switching category / workspace: the current groups leave as if deleted, then the new
// category's groups arrive as if added (a little staggered). Renders during the switch just wait
// for it, then the latest state is drawn.
let boardSwitch = null;
function switchBoard() {
  if (boardSwitch) return; // already leaving; the timer draws the latest state
  const old = [...document.querySelectorAll('#board .group, #board .add-group')];
  // start from each card's current opacity: hidden New group cards stay at 0
  old.forEach((el) => el.animate([{ opacity: getComputedStyle(el).opacity, transform: 'none' }, { opacity: 0, transform: 'scale(.92)' }],
    { duration: 150, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' }));
  boardSwitch = setTimeout(() => {
    boardSwitch = null;
    renderBoard();
    // the groups, or an empty category's grey New group card
    [...document.querySelectorAll('#board .group, #board.empty-cat .col:first-child .add-group')].forEach((el, i) => el.animate(
      [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }],
      { duration: 340, easing: SPRING, delay: Math.min(i, 10) * 25, fill: 'backwards' }));
  }, old.length ? 150 : 0);
}

// Where every movable element was before a re-render (FLIP: First).
function snapshotLayout() {
  const rects = new Map();
  for (const el of document.querySelectorAll(MOVABLE)) {
    const r = el.getBoundingClientRect();
    if (r.width) rects.set(el.dataset.id, r);
  }
  return { rects, board: $('#board').dataset.parent, ws: $('#ws-list .ws-item.active')?.dataset.id };
}

// After a re-render, slide each element from its old place to its new one, and pop in new ones
// (FLIP: Last, Invert, Play). Nested elements move relative to their moving parent.
function animateLayout(before) {
  if (!before) return;
  const wsChanged = before.ws !== currentWs()?.id; // (switchCats() handles the category bar itself)
  const held = holdNote();
  const card = holdCard();
  const opening = holdExpanding();
  // (expanding is kept until the moves are worked out, so the contents opening up aren't popped in too)
  try { animateMoves(before, wsChanged); } finally { expanding = null; openExpanded(opening); turnOpen(); growNote(held); growCard(card); }
}

function animateMoves(before, wsChanged = false) {
  const played = new Set(); // ids animated in this pass
  const sameBoard = before.board === $('#board').dataset.parent;
  const deltas = new Map();
  const els = [...document.querySelectorAll(MOVABLE)];
  for (const el of els) {
    const prev = before.rects.get(el.dataset.id);
    if (!prev) continue;
    const r = el.getBoundingClientRect();
    if (r.width) deltas.set(el, [prev.left - r.left, prev.top - r.top, prev.width, r.width]);
  }
  // still popping in from a moment ago: its rect is scaled, not moved, so let resumeRunning continue it
  const popping = (el) => { const r = running.get(el.dataset.id); return r && 'opacity' in r.keyframes[0] && performance.now() - r.start < r.opts.duration; };
  for (const el of els) {
    if (el.matches('.add-group') || popping(el)) continue; // (the New group card is only measured)
    const d = deltas.get(el);
    if (wsChanged && el.matches('.cat-tab')) continue; // the whole bar eases in instead
    if (!d && before.rects.size && el.matches('.ws-item, .cat-tab')) {
      // a new workspace / category: springs into the list (the board may have switched to it)
      play(played, el, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: SPRING }, true);
      continue;
    }
    if (!d) {
      // a new link / folder inside a group or folder that was already there: pop in, drawn on top
      // (not when it only became visible because its group / folder is being expanded)
      const holder = el.parentElement.closest('[data-id]');
      if (expanding && el.parentElement.closest(`[data-id="${CSS.escape(expanding)}"]`)) continue;
      if (sameBoard && holder && el.closest('#board') && before.rects.has(holder.dataset.id)) {
        play(played, el, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: SPRING }, true);
        continue;
      }
      if (sameBoard && before.rects.size && el.closest('#board') && !holder) {
        const card = el.matches('.group') && before.rects.get(`add:${el.closest('.col')?.dataset.col}`);
        const r = el.getBoundingClientRect();
        if (card && Math.abs(card.top - r.top) < 30) {
          // created on the New group card: appears out of the card - fades in with a little spring
          // and grows from the card's height (the same height when tabs were dropped on it)
          el.style.overflow = 'hidden';
          el.style.transformOrigin = 'top center';
          const anim = el.animate([
            { opacity: 0, height: `${card.height}px`, transform: `translate(0, ${card.top - r.top}px) scale(.92)` },
            { opacity: 1, height: `${r.height}px`, transform: 'none' },
          ], { duration: 380, easing: SPRING });
          raiseWhile(el, anim);
          anim.finished.catch(() => {}).then(() => { el.style.overflow = ''; el.style.transformOrigin = ''; });
        } else {
          play(played, el, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: SPRING });
        }
      }
      continue;
    }
    const parent = el.parentElement.closest('[data-id]');
    const pd = (parent && deltas.get(parent)) || [0, 0];
    const dx = d[0] - pd[0], dy = d[1] - pd[1];
    // group cards also ease to their new width (e.g. after the column count changed)
    const resize = el.matches('#board .group') && Math.abs(d[2] - d[3]) > 1;
    if (Math.abs(dx) + Math.abs(dy) < 1 && !resize) continue;
    const from = { transform: `translate(${dx}px, ${dy}px)` }, to = { transform: 'none' };
    if (resize) { from.width = `${d[2]}px`; to.width = `${d[3]}px`; }
    play(played, el, [from, to], { duration: 420, easing: GLIDE }, movingIds.has(el.dataset.id)); // what the user moved passes over the rest
  }
  resumeRunning(played);
}

// Ids the user just moved (drag & drop): their slide is drawn above everything else on the board.
let movingIds = new Set();
function markMoving(ids) {
  const marked = (movingIds = new Set(ids));
  setTimeout(() => { if (movingIds === marked) movingIds = new Set(); }, 1500);
}

// Element animations keyed by data-id, so a re-render right after (e.g. a new workspace, then
// switching to it) continues them on the new elements instead of cutting them off.
const running = new Map(); // id -> { keyframes, opts, start, raise }
function play(played, el, keyframes, opts, raise = false) {
  played.add(el.dataset.id);
  running.set(el.dataset.id, { keyframes, opts, start: performance.now(), raise });
  const anim = el.animate(keyframes, opts);
  if (raise) raiseWhile(el, anim);
}
function resumeRunning(played) {
  const now = performance.now();
  for (const [id, r] of running) {
    const t = now - r.start;
    if (t >= r.opts.duration) { running.delete(id); continue; }
    if (played.has(id)) continue;
    const el = document.querySelector(`${MOVABLE.split(', ').map((sel) => sel.replace('[data-id]', `[data-id="${CSS.escape(id)}"]`)).join(', ')}`);
    if (!el) continue;
    const anim = el.animate(r.keyframes, r.opts);
    anim.currentTime = t;
    if (r.raise) raiseWhile(el, anim);
  }
}

function raiseWhile(el, anim) {
  el.style.position ||= 'relative';
  el.style.zIndex = '50';
  anim.finished.catch(() => {}).then(() => { el.style.zIndex = ''; if (el.style.position === 'relative') el.style.position = ''; });
}

// Re-lay the category bar and board (e.g. a new column count), sliding groups to their new places.
function relayoutBoard() {
  const before = snapshotLayout();
  renderCats();
  renderBoard();
  animateLayout(before);
}

// Shrink-and-fade elements about to be deleted, so the removal is visible before the re-render.
// It also closes up the space it took (and a group's gap), so the re-render that removes it moves nothing.
function animateOut(ids) {
  const els = ids.map((id) => document.querySelector(`#board [data-id="${CSS.escape(id)}"], #ws-list [data-id="${CSS.escape(id)}"], #cat-bar [data-id="${CSS.escape(id)}"]`)).filter(Boolean);
  const opts = { duration: 230, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' };
  return Promise.all(els.map((el) => {
    const r = el.getBoundingClientRect();
    el.style.overflow = 'hidden';
    const across = el.closest('#cat-bar'); // tabs sit in a row: close up the width instead
    // close up the padding and the row's gap too, or what is left of them jumps shut on removal
    const shut = across
      ? { width: '0px', paddingLeft: '0px', paddingRight: '0px', marginRight: `-${parseFloat(getComputedStyle(across).columnGap) || 0}px` }
      : { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginBottom: '0px' };
    const anims = [el.animate([
      { opacity: 1, transform: 'none', [across ? 'width' : 'height']: `${across ? r.width : r.height}px` },
      { opacity: 0, transform: 'scale(.96)', ...shut },
    ], opts)];
    const gap = el.matches('.group') && [el.previousElementSibling, el.nextElementSibling].find((x) => x?.matches('.gap-slot'));
    if (gap) anims.push(gap.animate([{ height: '14px' }, { height: '0px' }], opts));
    return Promise.all(anims.map((a) => a.finished));
  })).catch(() => {});
}

// Re-rendering replaces the nodes under the mouse, and the browser only re-applies :hover after the
// mouse moves, so hover-only controls blink. Mirror the hover chain as a .hover class until then.
let pointer = null;
document.addEventListener('mousemove', (e) => {
  pointer = [e.clientX, e.clientY];
  document.body.classList.remove('after-drag');
  for (const el of document.querySelectorAll('.hover')) el.classList.remove('hover');
}, { passive: true });
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) pointer = null; });

const HOVER_STOP = '.columns, .col, #board, #ws-list, #cat-bar, #ws-head, #tabs-panel, #sidebar, dialog, body, html';
function restoreHover() {
  if (tipEl && !tipEl.offsetParent) hideTip(); // its element was re-rendered away or hidden
  if (!pointer) return;
  const top = document.elementFromPoint(...pointer);
  // (not over the tour, which nothing redraws: there a .hover would only switch its glides off)
  if (top?.closest('#tour')) return;
  // (up to the panel it is in, not the panel or the page: .hover * stops transitions in all it holds,
  // and on the page itself that restyled every element of a big board on each change)
  for (let el = top; el && !el.matches(HOVER_STOP); el = el.parentElement) el.classList.add('hover');
}

function renderSidebar() {
  const cur = currentWs();
  $('#ws-list').replaceChildren(...state.workspaces.map((ws) =>
    h('li', {
      class: 'ws-item' + (ws === cur ? ' active' : ''), draggable: 'true', dataset: { id: ws.id, type: 'workspace' },
      title: ws.description ? `${ws.name}\n${ws.description}` : ws.name,
      onclick: () => select(ws.id),
      ondblclick: () => editNode(ws),
      oncontextmenu: (e) => nodeMenu(e, ws),
    },
    symbolEl(ws.symbol, '🗃️'),
    h('span', { class: 'name' }, ws.name),
    h('span', { class: 'count' }, T.countLinks(ws)))),
    // collapsed rail: "new workspace" sits at the end of the list (expanded, it is beside the heading)
    h('li', { class: 'ws-add', dataset: { railTitle: t('new.workspace') }, onclick: addWorkspace }, icon('plus', 17)));
  applyRailTitles();
}

function renderHead() {
  const ws = currentWs();
  const head = $('#ws-head');
  if (!ws) { head.replaceChildren(h('h1', {}, t('head.none'))); return; }
  // symbol, name and description together open the workspace's editor; the space beside them is where
  // search opens
  head.replaceChildren(h('div', { class: 'ws-title', onclick: () => editNode(ws) },
    h('h1', {}, ws.symbol && symbolEl(ws.symbol), ws.name),
    ws.description && h('span', { class: 'desc' }, ws.description)));
  head.oncontextmenu = (e) => nodeMenu(e, ws);
}

// Another category picked: its underline slides over from the one picked before (a stand-in line glides
// along the bar while the new button's own line waits).
function slideCatLine(bar, from) {
  const tab = bar.querySelector('.cat-tab.active');
  if (!tab) return;
  bar.querySelector(':scope > .cat-line')?.remove();
  const line = h('div', { class: 'cat-line' });
  line.style.top = `${tab.offsetTop + tab.offsetHeight - 2}px`;
  bar.append(line);
  tab.classList.add('line-away');
  line.animate([{ left: `${from.left}px`, width: `${from.width}px` }, { left: `${tab.offsetLeft}px`, width: `${tab.offsetWidth}px` }],
    { duration: 320, easing: GLIDE, fill: 'forwards' })
    .finished.catch(() => {}).then(() => {
      tab.style.transition = 'none'; // (its own line back at once, under the stand-in, not fading in)
      tab.classList.remove('line-away');
      void tab.offsetWidth;
      tab.style.transition = '';
      line.remove();
    });
}

function renderCats() {
  const ws = currentWs();
  const bar = $('#cat-bar');
  if (!ws) { bar.replaceChildren(); return; }
  const cur = currentCat(ws);
  const was = bar.querySelector('.cat-tab.active');
  const from = was && bar.dataset.ws === ws.id && was.dataset.id !== cur?.id && { left: was.offsetLeft, width: was.offsetWidth };
  bar.dataset.ws = ws.id;
  bar.replaceChildren(
    ...ws.categories.map((c) => h('div', {
      class: 'cat-tab' + (c === cur ? ' active' : ''), draggable: 'true', dataset: { id: c.id, type: 'category' },
      onclick: () => select(ws.id, c.id),
      ondblclick: () => editNode(c),
      oncontextmenu: (e) => nodeMenu(e, c),
    }, c.name, h('span', { class: 'count' }, T.countLinks(c)))),
    Object.assign(btn(plus(), t('new.category'), () => addCategory(ws)), { className: 'icon-btn cat-add' }));
  if (from) requestAnimationFrame(() => slideCatLine(bar, from)); // (once the column control is back in front)
  // the column stepper sits at the bar's start, so it never moves as tabs come and go
  if (cur) bar.prepend(columnControl(), h('span', { class: 'bar-split' }));
}

// Board column count (a setting; stepper at the right end of the category bar).
const boardColumns = () => Math.min(MAX_COLUMNS, Math.max(1, settings.columns || 5));
async function setColumns(v) {
  const s = await run(B.call('saveSettings', { columns: Math.min(MAX_COLUMNS, Math.max(1, v)) }));
  if (s) { settings = s; fillSettings(); relayoutBoard(); }
}

// Scrolling over the control (icon, buttons, count or the gaps between) steps it: up adds a column. A trackpad's small deltas add up to a step;
// steps taken before the last save came back count from the pending value.
let wheelAcc = 0, wheelCols = null, wheelTimer = null;
function wheelColumns(e) {
  e.preventDefault();
  wheelHint(e); // (the control may have been redrawn under a still pointer)
  wheelAcc += e.deltaY;
  if (Math.abs(wheelAcc) < 40) return;
  const from = wheelCols ?? boardColumns();
  const to = Math.min(MAX_COLUMNS, Math.max(1, from + (wheelAcc < 0 ? 1 : -1)));
  nudgeWheelHint(wheelAcc < 0 ? -1 : 1);
  wheelAcc = 0;
  if (to === from) return;
  wheelCols = to;
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => { wheelCols = null; }, 500);
  setColumns(to);
}

// The badge rides along with the pointer, centred above it (clear of the count, which hides the pointer
// so the number stays readable): it shows while the pointer is over the buttons, the count or the gaps.
// A wheel step nudges its wheel that way.
const wheelBadge = $('#wheel-hint');
// (a popover, so it shows over the Settings dialog too: shown again as it turns on, to come out on top)
function wheelHint(e) {
  const ctl = e.target.closest?.('.col-ctl, .stepper');
  const on = !!ctl && !e.target.closest('.col-ctl > .ico');
  if (on && !wheelBadge.classList.contains('on')) {
    if (wheelBadge.matches(':popover-open')) wheelBadge.hidePopover();
    wheelBadge.showPopover();
  }
  wheelBadge.classList.toggle('on', on);
  if (ctl) wheelBadge.classList.toggle('below', ctl.matches('.stepper')); // (Settings: clear of the label above)
  if (ctl) wheelBadge.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
}
function hideWheelHint() { wheelBadge.classList.remove('on'); }
// (dir -1: scrolled up, adding a column: the wheel rolls and the up arrow nudges up)
function nudgeWheelHint(dir) {
  wheelBadge.querySelector('.wheel').animate([{ transform: `translateY(${dir * 2}px)` }, { transform: 'none' }], { duration: 260, easing: SPRING });
  wheelBadge.querySelector(dir < 0 ? '.up' : '.down').animate([{ translate: `0 ${dir * 2.5}px` }, { translate: '0 0' }], { duration: 260, easing: SPRING });
}
for (const type of ['blur', 'dragstart']) window.addEventListener(type, hideWheelHint);

function columnControl() {
  const n = boardColumns();
  const set = setColumns;
  // the icon has the tooltip; over the rest a wheel badge follows the pointer instead (see wheelHint)
  const step = (name, label, fn, disabled) => {
    const b = Object.assign(btn(icon(name, 13), null, fn), { disabled });
    b.setAttribute('aria-label', label);
    return b;
  };
  return h('div', {
    class: 'col-ctl', role: 'group', 'aria-label': t('cols.title'), 'aria-description': t('cols.scroll'), 'data-no-tip': true,
    onwheel: wheelColumns, onpointermove: wheelHint, onpointerleave: hideWheelHint,
  },
    Object.assign(icon('columns', 15), { title: t('cols.title') }),
    step('minus', t('cols.fewer'), () => set(n - 1), n <= 1),
    h('span', { class: 'col-n' }, n),
    step('plus', t('cols.more'), () => set(n + 1), n >= MAX_COLUMNS));
}

function renderBoard() {
  const board = $('#board');
  const shown = board.dataset.parent;
  delete board.dataset.parent;
  const ws = currentWs();
  if (!ws) {
    board.replaceChildren(h('div', { class: 'empty' }, h('p', {}, t('board.noWs')),
      h('button', { class: 'btn primary', onclick: addWorkspace }, plus(), t('board.createWs'))));
    return;
  }
  const cat = currentCat(ws);
  if (!cat) {
    board.replaceChildren(h('div', { class: 'empty' }, h('p', {}, t('board.noCats')),
      h('button', { class: 'btn primary', onclick: () => addCategory(ws) }, plus(), t('board.createCat'))));
    return;
  }
  board.dataset.parent = cat.id;
  const n = visibleColumns();
  board.dataset.cols = n;
  board.classList.toggle('empty-cat', !cat.groups.length);
  const cols = layoutColumns(cat, n);
  // each column: groups with clickable gaps between them ("new group here"), then a tail whose
  // New group card shows when the pointer is below the column's last group
  const here = () => currentCat(currentWs());
  const content = (list, i) => [
    ...list.flatMap((g, k) => [
      k > 0 && h('div', {
        class: 'gap-slot', dataset: { before: g.id },
        onclick: () => addGroup(here(), columnOf(here(), ...groupAt(here(), g.id)), { beforeId: g.id }),
      }),
      cachedGroup(g),
    ]),
    h('div', { class: 'col-tail' },
      h('div', {
        class: 'add-group', dataset: { col: i, id: `add:${i}` },
        onclick: (e) => { const end = columnEnd(here(), e.currentTarget.closest('.col')); addGroup(here(), end.column, { afterId: end.afterId }); },
      }, icon('plus', 28))),
  ].filter(Boolean);
  // The same category again (a change in it): the columns stay and only what changed in them is swapped,
  // so the cards that didn't change stay where they are and the browser doesn't style and lay out the
  // whole board again (on a big board, most of a render). Another category: built afresh.
  const columns = board.querySelector(':scope > .columns');
  if (shown === cat.id && columns?.children.length === cols.length) {
    cols.forEach((list, i) => syncChildren(columns.children[i], content(list, i)));
  } else {
    board.replaceChildren(h('div', { class: 'columns' }, cols.map((list, i) => h('div', { class: 'col', dataset: { col: i } }, content(list, i)))));
  }
  sizeAddCards(board);
  for (const id of groupCache.keys()) if (!cat.groups.some((g) => g.id === id)) groupCache.delete(id);
  // keep the selection to groups still on this board
  for (const id of selected) if (!cat.groups.some((g) => g.id === id)) selected.delete(id);
  document.body.classList.toggle('select-mode', selected.size > 0);
  for (const id of pickedItems) if (!board.querySelector(`.item[data-id="${CSS.escape(id)}"]`)) pickedItems.delete(id);
  if (!pickedItems.size) pickedGroup = null;
  document.body.classList.toggle('item-select', pickedItems.size > 0);
  typesetMath(board);
}

// Makes `kids` the children of `parent`, in order, moving only what is out of place (children already
// in place aren't touched, so the browser keeps their style and layout).
function syncChildren(parent, kids) {
  const keep = new Set(kids);
  for (const child of [...parent.children]) if (!keep.has(child)) child.remove(); // (first, or they'd push the rest along)
  kids.forEach((kid, i) => { if (parent.children[i] !== kid) parent.insertBefore(kid, parent.children[i] || null); });
}

// A group's element is reused while nothing it shows has changed: on a big board rebuilding every
// card on each change was most of a render. Not while an animation is on it (or held by fill), so a
// card that was animated out never comes back half-faded.
const groupCache = new Map(); // id -> { key, el }
function cachedGroup(g) {
  if (preview?.id === g.id) g = { ...g, ...preview.fields };
  let key = `${JSON.stringify(g)}|${editingNoteId === g.id}|${selected.has(g.id)}|${[...pickedItems]}|${getLang()}`;
  if (preview && preview.id !== g.id && key.includes(`"id":"${preview.id}"`)) key += JSON.stringify(preview.fields); // (an item in it)
  const c = groupCache.get(g.id);
  if (c && c.key === key && !c.el.getAnimations({ subtree: true }).length) return c.el;
  const el = renderGroup(g);
  groupCache.set(g.id, { key, el });
  return el;
}

// The New group card is as tall as a new empty group, and as tall as a group with one link while
// tabs are dragged onto it (that is what it will become). Both are measured on hidden samples.
// The samples only change with the column width and the language, so they are measured again only then
// (measuring lays out the whole board a second time).
let addCardsKey = '';
function sizeAddCards(board) {
  const col = board.querySelector('.col');
  if (!col) return;
  const key = `${col.getBoundingClientRect().width}|${getLang()}`;
  if (key === addCardsKey && board.style.getPropertyValue('--empty-group-h')) return;
  addCardsKey = key;
  const sample = (items) => renderGroup({ id: '', type: 'group', name: 'Sample', symbol: '', note: '', collapsed: false, items });
  const link = { id: '', type: 'link', url: 'https://example.com', name: 'Sample', icon: '', description: '' };
  const probes = [sample([]), sample([link])];
  const box = h('div', { style: 'position:absolute; visibility:hidden; pointer-events:none; left:0; top:0' }, probes);
  box.style.width = col.getBoundingClientRect().width + 'px';
  board.append(box);
  board.style.setProperty('--empty-group-h', probes[0].getBoundingClientRect().height + 'px');
  board.style.setProperty('--one-group-h', probes[1].getBoundingClientRect().height + 'px');
  box.remove();
}

/* ---------- board columns ---------- */

const MAX_COLUMNS = 8;

// The board always shows the set number of columns; a narrow window scrolls sideways instead.
const visibleColumns = () => boardColumns();

// Stored column of a group (unplaced groups go round-robin by position).
const columnOf = (cat, g, i) => Math.min(g.column ?? i % boardColumns(), MAX_COLUMNS - 1);

// Visible column i holds stored column i; dropping into it stores i.
const storedColumn = (cat, n, i) => i;

// Groups per column, keeping the category's order within each column. Groups placed in columns
// beyond the current count (it was lowered) stack, column by column, under the last one, and
// return to their column when the count goes back up.
function layoutColumns(cat, n) {
  const all = Array.from({ length: MAX_COLUMNS }, () => []);
  cat.groups.forEach((g, i) => all[columnOf(cat, g, i)].push(g));
  return [...all.slice(0, n - 1), all.slice(n - 1).flat()];
}


// Parts of a group header that keep their own click behaviour (the rest toggles collapse).
const HEAD_KEEP = '.name, .node-sym, button, textarea, input';

let taskTicked = null; // { id, line, done, at } of the task last (un)ticked in a note
function renderGroup(g) {
  const editing = editingNoteId === g.id;
  let note = null;
  if (editing) {
    note = h('textarea', { class: 'note-edit', placeholder: t('note.placeholder') });
    note.value = g.note || '';
    note.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); note.blur(); }
    });
    note.addEventListener('blur', () => saveNote(g.id, g.note, note.value));
  } else if (g.note) {
    note = h('div', { class: 'note', html: renderMarkdown(g.note), title: t('note.clickTip') });
    // a task just ticked (or unticked) animates in the card drawn for the new note, carrying on from
    // where it was in any card drawn for it before (the click's own redraw, then the extension's)
    const tick = taskTicked?.id === g.id && performance.now() - taskTicked.at < 600 && taskTicked;
    const li = tick && note.querySelector(`input[data-line="${tick.line}"]`)?.closest('li');
    if (li) {
      li.classList.add(tick.done ? 'ticking' : 'unticking');
      li.style.setProperty('--since', `${tick.at - performance.now()}ms`);
    }
    note.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      if (e.target.matches('input[type=checkbox]')) {
        e.preventDefault();
        taskTicked = { id: g.id, line: +e.target.dataset.line, done: e.target.checked, at: performance.now() };
        apply({ op: 'patch', id: g.id, fields: { note: toggleTask(g.note, +e.target.dataset.line) } });
        return;
      }
      startNoteEdit(g.id);
    });
  }
  // header: a big symbol on the left; beside it the name line (name, count, actions, collapse)
  // above a row of add buttons
  // an empty group is just its header: nothing to expand, so no collapse toggle either
  const empty = !g.items.length && !g.note && !editing;
  return h('div', {
    class: 'group' + (empty ? ' empty-group' : g.collapsed ? ' collapsed' : '') + (selected.has(g.id) ? ' selected' : ''),
    // (dataset would turn a null into the string "null": the colour goes in only when there is one)
    dataset: { id: g.id, type: 'group', ...(groupColor(g.color) && { color: g.color }) },
    style: groupColor(g.color) ? `--g: ${groupColor(g.color)[0]}; --g-dark: ${groupColor(g.color)[1]}` : null,
    // while groups are selected, a click anywhere on a card (de)selects it (its buttons and links are inert)
    onclick: (e) => { if (selected.size && !e.target.closest('.group-head')) toggleSelected(g.id); },
  },
    h('div', {
      class: 'group-head', draggable: 'true',
      // empty header space toggles the group; the name and symbol edit it on double-click
      onclick: (e) => {
        // Ctrl/⌘/Shift-click, or any click while groups are selected: (de)select
        if (e.ctrlKey || e.metaKey || e.shiftKey || selected.size) return void toggleSelected(g.id);
        if (!empty && !e.target.closest(HEAD_KEEP)) toggleCollapse(g);
      },
      ondblclick: (e) => { if (e.target.closest('.name, .node-sym')) editNode(g); },
      oncontextmenu: (e) => nodeMenu(e, g),
    },
    g.symbol && h('div', { class: 'node-sym' }, symbolEl(g.symbol)), // no symbol: the name and tools take the room
    h('div', { class: 'node-info' },
      h('div', { class: 'node-line' },
        h('span', { class: 'name' }, g.name),
        h('span', { class: 'count' }, T.countLinks(g)),
        !empty && Object.assign(btn(icon('chevron'), t(g.collapsed ? 'act.expand' : 'act.collapse'), () => toggleCollapse(g)), { className: 'icon-btn collapse-btn' })),
      // always-visible tools: add buttons | divider | everything else
      h('div', { class: 'node-tools' },
        btn(icon('linkPlus'), t('act.addLink'), () => addLink(g.id)),
        btn(icon('folderPlus'), t('act.addFolder'), () => addFolder(g.id)),
        h('span', { class: 'tools-split' }),
        btn(icon('note'), t('act.editNote'), () => startNoteEdit(g.id)),
        btn(icon('open'), t('act.openAll'), () => openAll(g)),
        btn(icon('more'), t('act.more'), (e) => nodeMenu(e, g))))),
    h('div', { class: 'group-body' },
      note,
      renderItems(g.items, g.id, 0)));
}

// `depth`: folders enclosing this list (0 directly in a group).
function renderItems(items, parentId, depth) {
  return h('ul', { class: 'items', dataset: { parent: parentId } },
    items.map((n) => (n.type === 'folder' ? renderFolder(n, depth + 1) : renderLink(n))));
}

function renderLink(l) {
  if (preview?.id === l.id) l = { ...l, ...preview.fields };
  return h('li', { class: 'item link' + (pickedItems.has(l.id) ? ' picked' : ''), draggable: 'true', dataset: { id: l.id, type: 'link' } },
    h('div', {
      class: 'link-row', title: [l.name || l.url, l.url, l.description].filter(Boolean).join('\n'),
      onclick: (e) => { if (!itemClick(e, l)) openLink(l, e); },
      onauxclick: (e) => { if (e.button === 1) { e.preventDefault(); openLink(l, { ctrlKey: true }); } },
      oncontextmenu: (e) => nodeMenu(e, l),
    },
    iconImg(l.url, l.icon),
    h('span', { class: 'name' }, l.name || l.url),
    l.description && h('span', { class: 'desc' }, l.description),
    h('span', { class: 'head-actions' },
      btn(icon('edit'), t('act.edit'), () => editNode(l)),
      btn(icon('close'), 'Delete', () => deleteNode(l)))));
}

// One compact row (folders sit among links): chevron, symbol, name, count; the action buttons
// appear on hover and take no space otherwise.
function renderFolder(f, depth) {
  if (preview?.id === f.id) f = { ...f, ...preview.fields };
  return h('li', { class: 'item folder' + (f.collapsed ? ' collapsed' : '') + (pickedItems.has(f.id) ? ' picked' : ''), dataset: { id: f.id, type: 'folder' } },
    h('div', {
      class: 'folder-head', draggable: 'true',
      // click toggles; editing lives in the buttons/menu so rapid clicks never open the editor
      onclick: (e) => { if (!itemClick(e, f)) toggleCollapse(f); },
      ondblclick: (e) => e.stopPropagation(),
      oncontextmenu: (e) => nodeMenu(e, f),
    },
    h('span', { class: 'twisty' }, icon('chevron', 13)),
    symbolEl(f.symbol, icon('folder', 15)), // a folder's default: the line folder icon (no emoji, so none in its tab group)
    h('span', { class: 'node-line' },
      h('span', { class: 'name' }, f.name),
      h('span', { class: 'count' }, T.countLinks(f))),
    h('span', { class: 'head-actions' },
      btn(icon('linkPlus'), t('act.addLink'), () => addLink(f.id)),
      depth < T.MAX_FOLDER_DEPTH && btn(icon('folderPlus'), t('act.addSubfolder'), () => addFolder(f.id)),
      h('span', { class: 'tools-split' }),
      btn(icon('edit'), t('act.editFolder'), () => editNode(f)),
      btn(icon('open'), t('act.openAll'), () => openAll(f)),
      btn(icon('more'), t('act.more'), (e) => nodeMenu(e, f)))),
    renderItems(f.items, f.id, depth));
}

/* ---------- search ---------- */

/* ---------- search ---------- */

// A search field floating at the bottom of the board; results open above it. Arrows move,
// Enter opens a link / reveals a group, Esc or a click elsewhere closes.
const searchBox = $('#search-box');
const search = $('#search');
let hits = [];
let hit = -1;

function openSearch() {
  searchBox.classList.add('open');
  search.focus();
  search.select();
  renderSearchResults();
}
function closeSearch() {
  if (!searchBox.classList.contains('open')) return;
  searchBox.classList.remove('open');
  search.value = '';
  search.blur();
  $('#search-results').hidden = true;
}

function renderSearchResults() {
  const q = search.value.trim().toLowerCase();
  const out = $('#search-results');
  hits = [];
  hit = -1;
  out.hidden = !q;
  if (!q || !state) return;
  const links = [], containers = [];
  T.walk(state.workspaces, (n, anc) => {
    const path = anc.map((a) => a.name).join(' › ');
    if (n.type === 'link') {
      if ([n.name, n.url, n.description].some((x) => (x || '').toLowerCase().includes(q))) links.push({ n, anc, path });
    } else if ([n.name, n.note, n.description].some((x) => (x || '').toLowerCase().includes(q))) {
      containers.push({ n, anc, path });
    }
  });
  const row = (item, lead, sub, act) => {
    const el = h('div', {
      class: 'result',
      onclick: (e) => { closeSearch(); act(e); },
      onmousemove: () => setHit(hits.indexOf(el), false),
    }, lead, h('span', { class: 'result-text' },
      h('span', { class: 'name' }, highlight(item.n.name || item.n.url, q)),
      h('span', { class: 'path' }, sub)));
    hits.push(el);
    return el;
  };
  const linkRows = links.slice(0, 100).map((it) =>
    row(it, iconImg(it.n.url, it.n.icon), [it.path, it.path && ' · ', highlight(it.n.url, q)], (e) => openLink(it.n, e)));
  const contRows = containers.slice(0, 100).map((it) =>
    row(it, symbolEl(it.n.symbol, it.n.type === 'folder' ? icon('folder', 15) : { workspace: '🗃️', category: '🏷️', group: '🗂️' }[it.n.type]),
      [t(`type.${it.n.type}`), it.path && ' · ' + it.path], () => reveal(it.n, it.anc)));
  const section = (title, rows) => (rows.length ? [h('h4', {}, title), ...rows] : []);
  const body = [...section(t('search.links', { n: links.length }), linkRows), ...section(t('search.containers', { n: containers.length }), contRows)];
  out.replaceChildren(...(body.length ? body : [h('p', { class: 'search-empty muted' }, t('search.none'))]),
    h('div', { class: 'search-foot muted small' }, t('search.foot')));
  setHit(0);
}

function setHit(i, scroll = true) {
  hits[hit]?.classList.remove('active');
  hit = hits.length ? (i + hits.length) % hits.length : -1;
  hits[hit]?.classList.add('active');
  if (scroll) hits[hit]?.scrollIntoView({ block: 'nearest' });
}

search.addEventListener('input', renderSearchResults);
search.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); setHit(hit + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setHit(hit - 1); }
  else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    hits[hit]?.dispatchEvent(new MouseEvent('click', { ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey }));
  }
});
search.addEventListener('focus', () => { if (!searchBox.classList.contains('open')) openSearch(); });
search.addEventListener('blur', () => closeSearch()); // losing focus springs it back to the magnifier
// once it is back to a circle, a short squish gives the close the same bounce as the open
searchBox.addEventListener('transitionend', (e) => {
  if (e.propertyName === 'width' && !searchBox.classList.contains('open')) searchBox.classList.add('settle');
});
searchBox.addEventListener('animationend', () => searchBox.classList.remove('settle'));
// keep focus in the field while a result is clicked
$('#search-results').addEventListener('pointerdown', (e) => e.preventDefault());
document.addEventListener('pointerdown', (e) => { if (!searchBox.contains(e.target)) closeSearch(); });

function reveal(node, anc) {
  const ws = node.type === 'workspace' ? node : anc[0];
  const cat = node.type === 'category' ? node : anc[1];
  select(ws.id, cat?.id);
  const target = anc[2] || node;
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-id="${CSS.escape(target.id)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('flash'); // (a reused card may still have it)
    void el.offsetWidth; // restart the animation
    el.classList.add('flash');
    const done = (e) => { if (e.target === el) { el.classList.remove('flash'); el.removeEventListener('animationend', done); } };
    el.addEventListener('animationend', done);
  });
}

/* ---------- open tabs panel ---------- */

let lastTabs = null; // the windows and tabs last drawn (what closing tabs can open again)
async function renderTabs() {
  if (drag) { pendingTabsRender = true; return; }
  pendingTabsRender = false;
  const seq = ++tabsRenderSeq;
  const data = await run(B.call('getTabs'));
  if (!data || seq !== tabsRenderSeq) return; // a newer render is on its way
  lastTabs = data;
  currentWindowId = data.currentWindowId;
  const wins = data.windows.sort((a, b) => (b.id === currentWindowId) - (a.id === currentWindowId));
  // same rules as the extension: suspendTabs skips active/pinned/audible/non-web tabs,
  // closeDuplicates matches URLs ignoring the #fragment
  const canSuspend = (t) => !t.active && !t.discarded && !t.pinned && !t.audible && /^https?:/.test(t.url);
  const all = wins.flatMap((w) => w.tabs);
  const sleeping = all.filter((t) => t.discarded).length;
  const suspendable = all.filter(canSuspend).length;
  const seen = new Set();
  let dupes = 0;
  for (const t of all) {
    const key = (t.url || '').replace(/#.*$/, '');
    if (key && seen.has(key)) dupes++;
    else seen.add(key);
  }

  const others = wins.filter((w) => w.id !== currentWindowId);
  const shut = new Set((ui.winCollapsed || []).filter((id) => wins.some((w) => w.id === id))); // (closed windows forgotten)
  if (shut.size !== (ui.winCollapsed || []).length) { ui.winCollapsed = [...shut]; saveUi(); }
  const blocks = wins.map((w) => {
    const name = windowName(w, others);
    const collapsed = shut.has(w.id);
    return h('div', { class: 'win' + (collapsed ? ' collapsed' : ''), dataset: { window: w.id } },
      h('div', { class: 'win-head', draggable: 'true', onclick: (e) => { if (!e.target.closest('button')) toggleWin(w.id); } },
        Object.assign(btn(icon('chevron', 14), t(collapsed ? 'act.expand' : 'act.collapse'), () => toggleWin(w.id)), { className: 'icon-btn win-twisty' }),
        h('span', { class: 'grow' }, chunks([name, counted(`win:${w.id}`, 'count.tabs', w.tabs.length)])),
        h('span', { class: 'win-count' }, rollNum(`rail:${w.id}`, w.tabs.length)),
        // (sleep, save, close: the same slots as a tab row's wake, save, close below)
        w.tabs.some(canSuspend) && btn(icon('suspend'), t('win.suspend'), () => suspend({ windowId: w.id })),
        w.tabs.length > 0 && btn(icon('save'), t(w.id === currentWindowId ? 'win.saveThis' : 'win.save'), () => saveWindow(w.id)),
        noTip(btn(icon('close'), t('win.close'), () => closeWindow(w, others)))),
      !collapsed && h('div', { class: 'win-tabs' }, w.tabs.map((t) => h('div', {
        class: 'tab-row' + (t.active ? ' active' : '') + (t.discarded ? ' discarded' : '') + (pickedTabs.has(t.id) ? ' picked' : ''),
        draggable: 'true', dataset: { tab: t.id, url: t.url },
        title: [t.title || t.url, t.url, t.discarded ? tr('tab.suspended') : ''].filter(Boolean).join('\n'),
        onclick: (e) => {
          if (e.shiftKey) return void toggleTab(t.id); // Shift-click selects instead of switching
          clearTabs();
          run(B.call('activateTab', { tabId: t.id }));
        },
        oncontextmenu: (e) => showMenu(e, tabsMenu(pickedTabs.has(t.id) ? [...pickedTabs] : [t.id])),
      },
      iconImg(t.url, /^(https?:|data:)/.test(t.favIconUrl) ? t.favIconUrl : ''),
      h('span', { class: 'name' }, t.title || t.url),
      t.discarded && h('span', { class: 'muted' }, icon('suspend', 13)),
      t.discarded && canWake() && btn(icon('sun'), tr('tab.wake'), () => wakeTabs([t.id])),
      btn(icon('save'), tr('tab.save'), () => saveTabsTo([t.id])),
      noTip(btn(icon('close'), tr('tab.close'), () => { dropTabRows([t.id]); run(B.call('closeTabs', { tabIds: [t.id] })); }))))));
  });
  $('#tab-stats').replaceChildren(...chunks([counted('windows', 'count.windows', wins.length), counted('tabs', 'count.tabs', all.length),
    sleeping && counted('asleep', 'count.suspended', sleeping), dupes && counted('dupes', 'count.duplicates', dupes)].filter(Boolean)));
  // always shown (so the row never reshuffles); greyed out when there is nothing to do
  $('#btn-suspend').disabled = !suspendable;
  $('#btn-dedupe').disabled = !dupes;
  // Suspending (or waking) a tab replaces it with a new tab id: a row whose tab is gone takes over the new
  // tab with the same URL in the same window, so it stays in place instead of leaving and coming back.
  const shown = new Set([...document.querySelectorAll('#windows .tab-row')].map((r) => r.dataset.tab));
  const fresh = all.filter((t) => !shown.has(String(t.id)));
  for (const row of document.querySelectorAll('#windows .tab-row')) {
    if (all.some((t) => String(t.id) === row.dataset.tab)) continue;
    const winId = +row.closest('.win')?.dataset.window;
    const i = fresh.findIndex((t) => t.windowId === winId && t.url === row.dataset.url);
    if (i < 0) continue;
    const [t] = fresh.splice(i, 1);
    if (pickedTabs.delete(+row.dataset.tab)) pickedTabs.add(t.id);
    row.dataset.tab = t.id;
  }
  // which tabs were asleep, so a tab that falls asleep / wakes up eases to its new look (rows are redrawn)
  const wasAsleep = new Map([...document.querySelectorAll('#windows .tab-row')].map((r) => [r.dataset.tab, r.classList.contains('discarded')]));
  // closed tabs / windows shrink away first; the rest then slide to their new places, new ones pop in
  const live = new Set(all.map((t) => String(t.id)));
  const wins_ = new Set(wins.map((w) => String(w.id)));
  const gone = [...document.querySelectorAll('#windows .tab-row')].filter((r) => !live.has(r.dataset.tab))
    .concat([...document.querySelectorAll('#windows .win')].filter((w) => !wins_.has(w.dataset.window)));
  if (gone.length) {
    await Promise.all(gone.map((el) => {
      el.style.overflow = 'hidden';
      return el.animate([{ opacity: 1, height: `${el.getBoundingClientRect().height}px` }, { opacity: 0, height: '0px', paddingTop: '0px', paddingBottom: '0px', marginBottom: '0px' }],
        { duration: 200, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }).finished.catch(() => {});
    }));
    if (seq !== tabsRenderSeq) return;
  }
  for (const id of pickedTabs) if (!live.has(String(id))) pickedTabs.delete(id);
  const keyOf = (el) => (el.matches('.tab-row') ? `t${el.dataset.tab}` : `w${el.dataset.window}`);
  const hadRows = document.querySelectorAll('#windows .tab-row').length > 0;
  const before = new Map([...document.querySelectorAll('#windows .tab-row, #windows .win')].map((el) => [keyOf(el), el.getBoundingClientRect()]));
  $('#windows').replaceChildren(...blocks);
  // a window being expanded: its tabs are held shut while the rest is measured (so the windows below
  // get no slide of their own), then open up with them following
  let opening = null;
  if (winExpanding != null) {
    const body = document.querySelector(`#windows .win[data-window="${winExpanding}"] > .win-tabs`);
    winExpanding = null;
    if (body) {
      opening = { body, h: body.getBoundingClientRect().height };
      Object.assign(body.style, { height: '0px', overflow: 'hidden' });
    }
  }
  for (const el of document.querySelectorAll('#windows .tab-row, #windows .win')) {
    if (opening?.body.contains(el)) continue;
    const a = before.get(keyOf(el));
    if (!a) {
      if (hadRows && el.matches('.tab-row')) el.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: SPRING });
      continue;
    }
    const b = el.getBoundingClientRect();
    const parentMoved = el.matches('.tab-row') && before.get(keyOf(el.closest('.win')));
    const pdy = parentMoved ? parentMoved.top - el.closest('.win').getBoundingClientRect().top : 0;
    const dy = a.top - b.top - pdy;
    if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 360, easing: SPRING });
  }
  for (const row of document.querySelectorAll('#windows .tab-row')) {
    const was = wasAsleep.get(row.dataset.tab);
    const now = row.classList.contains('discarded');
    if (was == null || was === now) continue;
    for (const part of row.querySelectorAll(':scope > :is(img, .name)')) {
      part.animate([{ opacity: was ? 0.55 : 1 }, { opacity: now ? 0.55 : 1 }], { duration: 300, easing: 'ease' });
    }
    row.querySelector(':scope > .muted')?.animate([{ opacity: 0 }, { opacity: 0.55 }], { duration: 300, easing: 'ease' });
  }
  if (opening) {
    const { body, h } = opening;
    body.style.height = '';
    body.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 300, easing: GLIDE })
      .finished.catch(() => {}).then(() => { body.style.overflow = ''; });
    body.parentElement.querySelector('.win-twisty .ico')?.animate([{ transform: 'rotate(-90deg)' }, { transform: 'none' }], { duration: 200, easing: 'ease-out' });
  }
  restoreHover();
}

// Collapse / expand a window in the open tabs panel (remembered on this device while it is open). Its
// tabs close up first, then it is drawn collapsed; expanding opens them (see renderTabs).
let winExpanding = null;
async function toggleWin(id) {
  const shut = new Set(ui.winCollapsed || []);
  if (shut.has(id)) {
    shut.delete(id);
    winExpanding = id;
  } else {
    shut.add(id);
    const win = document.querySelector(`#windows .win[data-window="${id}"]`);
    const body = win?.querySelector(':scope > .win-tabs');
    win?.querySelector('.win-twisty .ico')?.animate([{ transform: 'none' }, { transform: 'rotate(-90deg)' }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
    if (body) {
      body.style.overflow = 'hidden';
      await body.animate([{ height: `${body.getBoundingClientRect().height}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: 220, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }).finished.catch(() => {});
    }
  }
  ui.winCollapsed = [...shut];
  saveUi();
  renderTabs();
}

// "This window" for the dashboard's own window; the rest read naturally for how many there are.
// `keys` names the strings to use: the plain names, or the "Close …?" questions.
function windowName(w, others, keys = ['win.this', 'win.other', 'win.nth']) {
  if (w.id === currentWindowId) return t(keys[0]);
  if (others.length === 1) return t(keys[1]);
  return t(keys[2], { n: others.indexOf(w) + 1 });
}

async function closeWindow(w, others) {
  const own = w.id === currentWindowId; // closing it closes this dashboard too
  if (w.tabs.length || own) {
    const n = w.tabs.length;
    if (!(await confirmDialog({
      title: windowName(w, others, ['win.closeThis', 'win.closeOther', 'win.closeNth']),
      text: t(n && own ? 'win.alsoBoth' : n ? 'win.alsoTabs' : 'win.alsoDash', { n }),
      ok: t('win.close'), danger: true,
    }))) return;
  }
  const urls = w.tabs.map((x) => x.url).filter(Boolean);
  await run(B.call('closeWindow', { windowId: w.id }));
  // (another window: Undo opens its tabs again in a new window; closing this one closes the dashboard too)
  if (!own && urls.length) toast(t('toast.windowClosed', { n: urls.length }), t('common.undo'), () => run(B.call('openUrls', { urls, newWindow: true })));
}

// Labelled action buttons, or icons only as soon as the labelled row would not fit (measured on an
// invisible copy, so the label slide animation never confuses the check).
// `width`: decide for this row width instead of the current one (opening the panel: its final width,
// so the labels unfold along with the opening rather than once it is nearly done)
function fitActions(width) {
  const row = $('.panel-actions');
  const probe = row.cloneNode(true);
  probe.classList.remove('icons-only');
  Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', left: '0', top: '0', width: 'max-content' });
  probe.querySelectorAll('.label').forEach((l) => { l.style.transition = 'none'; });
  row.parentElement.append(probe);
  const fits = probe.getBoundingClientRect().width <= (width ?? row.getBoundingClientRect().width) + 0.5;
  probe.remove();
  row.classList.toggle('icons-only', !fits);
}
// (not while the panel opens / closes: the in-between widths would flip it midway; settled after)
new ResizeObserver(() => { if (!$('#tabs-panel').classList.contains('panel-anim')) fitActions(); }).observe($('.panel-actions'));

/* ---------- open-tab selection ---------- */

// Tabs picked in the open-tabs panel (Shift-click / Shift-drag a box, across windows). Dragging one
// of them moves them all; right-click, Delete and Esc act on them.
const pickedTabs = new Set();

function paintTabs() {
  for (const r of document.querySelectorAll('#windows .tab-row')) r.classList.toggle('picked', pickedTabs.has(+r.dataset.tab));
}
function toggleTab(id) {
  if (!pickedTabs.delete(id)) pickedTabs.add(id);
  paintTabs();
}
function clearTabs() {
  if (!pickedTabs.size) return;
  pickedTabs.clear();
  paintTabs();
}

$('#windows').addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !e.shiftKey || e.target.closest('button')) return;
  e.preventDefault(); // no native drag of the row under the pointer
  const base = new Set(pickedTabs);
  const x0 = e.clientX, y0 = e.clientY;
  const box = h('div', { id: 'marquee' });
  let moved = false;
  const onMove = (ev) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
    if (!moved) { moved = true; hideTip(); document.body.append(box); document.body.classList.add('selecting'); }
    const r = { left: Math.min(x0, ev.clientX), top: Math.min(y0, ev.clientY), right: Math.max(x0, ev.clientX), bottom: Math.max(y0, ev.clientY) };
    Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.right - r.left + 'px', height: r.bottom - r.top + 'px' });
    pickedTabs.clear();
    base.forEach((id) => pickedTabs.add(id));
    for (const row of document.querySelectorAll('#windows .tab-row')) {
      const c = row.getBoundingClientRect();
      if (c.left < r.right && c.right > r.left && c.top < r.bottom && c.bottom > r.top) {
        const id = +row.dataset.tab;
        if (base.has(id)) pickedTabs.delete(id); else pickedTabs.add(id); // Shift inverts, like elsewhere
      }
    }
    paintTabs();
  };
  const onUp = () => {
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerup', onUp);
    box.remove();
    document.body.classList.remove('selecting');
    if (moved) addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
  };
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
});

// a click anywhere outside the open-tab rows (and their menu) ends the tab selection
document.addEventListener('pointerdown', (e) => {
  if (pickedTabs.size && !e.target.closest('#windows .tab-row, #menu')) clearTabs();
}, true);

// waking suspended tabs (loading them again in the background); the logo as a symbol (an older
// extension refuses to store it)
const canWake = () => extFeatures.has('wakeTabs');
const canLogoSymbol = () => extFeatures.has('logoSymbol');
async function wakeTabs(ids) {
  const n = await run(B.call('wakeTabs', { tabIds: ids }));
  if (n) toast(t('toast.woken', { n }));
}

async function closePickedTabs(ids) {
  const closing = (lastTabs?.windows || []).flatMap((w) => w.tabs).filter((x) => ids.includes(x.id) && x.url);
  clearTabs();
  dropTabRows(ids);
  if (!(await run(B.call('closeTabs', { tabIds: ids })))) return;
  // Undo opens them again, each in its window if that is still open (at its end)
  if (closing.length) toast(t('toast.tabsClosed', { n: closing.length }), t('common.undo'), async () => {
    const open = new Set(((await run(B.call('getTabs'))) || { windows: [] }).windows.map((w) => w.id));
    for (const [win, tabs] of Map.groupBy(closing, (x) => (open.has(x.windowId) ? x.windowId : null))) {
      await run(B.call('openUrls', { urls: tabs.map((x) => x.url), ...(win ? { windowId: win } : {}) }));
    }
  });
}

// Closing tabs from the panel: their rows close up right away instead of waiting for the browser's tab
// event and the refreshed list (the redraw that follows finds them gone and leaves the rest in place).
function dropTabRows(ids) {
  for (const id of ids) {
    const row = document.querySelector(`#windows .tab-row[data-tab="${id}"]`);
    if (!row || row.classList.contains('closing')) continue;
    row.classList.add('closing');
    row.style.overflow = 'hidden';
    row.animate([{ opacity: 1, height: `${row.getBoundingClientRect().height}px` }, { opacity: 0, height: '0px', paddingTop: '0px', paddingBottom: '0px' }],
      { duration: 160, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }).finished.catch(() => {}).then(() => row.remove());
  }
}

function tabsMenu(ids) {
  const n = ids.length;
  // sleep only what is awake, wake only what is asleep (each entry shows only when it has tabs to act on)
  const asleep = ids.filter((id) => document.querySelector(`#windows .tab-row.discarded[data-tab="${id}"]`));
  const awake = ids.filter((id) => !asleep.includes(id));
  const cat = currentCat();
  return [
    cat && { icon: 'group', label: t('tabs.saveGroup', { n }), key: 'G', fn: async () => {
      clearTabs();
      await run(B.call('saveTabs', { tabIds: ids, close: settings.closeOnSave, newGroup: { categoryId: cat.id, name: suggestName('group'), column: 0 } }));
    } },
    awake.length > 0 && { icon: 'suspend', label: t('tabs.suspend', { n: awake.length }), key: 'S', fn: async () => {
      clearTabs();
      const done = await run(B.call('discardTabs', { tabIds: awake }));
      if (done != null) toast(t('toast.suspended', { n: done }));
    } },
    asleep.length > 0 && canWake() && { icon: 'sun', label: t('tabs.wake', { n: asleep.length }), key: 'U', fn: () => { clearTabs(); wakeTabs(asleep); } },
    { icon: 'windows', label: t('tabs.moveWindow'), key: 'W', fn: () => { clearTabs(); run(B.call('moveToNewWindow', { tabIds: ids })); } },
    pickedTabs.size > 0 && { icon: 'close', label: t('menu.clearSel'), key: 'X', fn: clearTabs },
    '-',
    { icon: 'trash', label: t('tabs.close', { n }), key: 'D', danger: true, fn: () => closePickedTabs(ids) },
  ];
}

let tabsTimer;
let tabsRenderSeq = 0;
function scheduleTabs() { clearTimeout(tabsTimer); tabsTimer = setTimeout(renderTabs, 80); }

/* ================= mutations ================= */

function openLink(l, e = {}) {
  if (e.shiftKey) run(B.call('openUrls', { urls: [l.url], newWindow: true }));
  else run(B.call('openUrls', { urls: [l.url], active: !(e.ctrlKey || e.metaKey) }));
}

async function openAll(node, newWindow = false) {
  const urls = T.collectLinks(node).map((l) => l.url);
  if (urls.length > 20 && !(await confirmDialog({ title: t('open.many', { n: urls.length }), ok: t('open.all') }))) return;
  // (an extension older than 0.2.6 ignores `groups` and opens `urls` as before)
  run(B.call('openUrls', { urls, newWindow, groups: settings.groupTabs !== false ? tabGroupsFor(node) : undefined }));
}

// "Open all" in tab groups: a group's links make one tab group named after it, in its colour; a
// folder's, one named after the folder in its group's colour; a category or workspace opens one tab
// group per group in it.
// (An emoji symbol leads the title. The extension remembers which group / folder a tab group came from,
// and renames / recolours it when that changes.)
function tabGroupsFor(node) {
  const set = (n, color) => ({
    id: n.id, title: T.textSymbol(n.symbol) ? `${T.textSymbol(n.symbol)} ${n.name}` : n.name,
    color: color || '', urls: T.collectLinks(n).map((l) => l.url),
  });
  if (node.type === 'group') return [set(node, node.color)];
  if (node.type === 'folder') return [set(node, T.locate(state, node.id)?.ancestors.find((a) => a.type === 'group')?.color)];
  const groups = node.type === 'workspace' ? node.categories.flatMap((c) => c.groups) : node.groups || [];
  return groups.map((g) => set(g, g.color)).filter((g) => g.urls.length);
}

// Collapse / expand a group or folder with its contents closing / opening smoothly.
let expanding = null; // id whose contents should open up on the next render
const contentsOf = (id) => {
  const el = document.querySelector(`#board [data-id="${CSS.escape(id)}"]`);
  return el && (el.matches('.group') ? el.querySelector(':scope > .group-body') : el.querySelector(':scope > .items'));
};
// The chevron of a group / folder: it turns as its contents open or close (the element is drawn anew in
// its new state, so a CSS transition never runs: the turn is played on the one there is at the time).
// The turn is played on the drawing inside the icon, not on the icon: the browser draws a turning
// element once and turns the picture, which blurs and pales the thin line until it stops; the drawing
// is drawn afresh each frame, sharp all the way.
const chevronOf = (id) => {
  const el = document.querySelector(`#board [data-id="${CSS.escape(id)}"]`);
  const path = el?.querySelector(el.matches('.group') ? ':scope > .group-head .collapse-btn .ico svg > *' : ':scope > .folder-head .twisty svg > *');
  if (path) Object.assign(path.style, { transformBox: 'fill-box', transformOrigin: 'center' });
  return path;
};
let turning = null; // id whose chevron turns open on the next render (see animateLayout)
async function toggleCollapse(node) {
  if (!node.collapsed) {
    chevronOf(node.id)?.animate([{ transform: 'none' }, { transform: 'rotate(-90deg)' }],
      { duration: 220, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }); // (with the contents closing)
    const body = contentsOf(node.id);
    if (body) {
      body.style.overflow = 'hidden';
      body.style.minHeight = '0'; // (nested lists keep a small min-height for dropping)
      await body.animate([{ height: `${body.getBoundingClientRect().height}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: 220, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }).finished.catch(() => {});
    }
  } else expanding = turning = node.id;
  apply({ op: 'patch', id: node.id, fields: { collapsed: !node.collapsed } });
}
// (called at the end of animateLayout)
// The contents of a group / folder being expanded are held shut while the layout is measured (like a
// note, see holdNote), so what is below gets no slide of its own: it just follows them as they open.
function holdExpanding() {
  if (!expanding) return null;
  const body = contentsOf(expanding);
  if (!body) return null;
  const h = body.getBoundingClientRect().height;
  Object.assign(body.style, { height: '0px', minHeight: '0', overflow: 'hidden' });
  return { body, h };
}
function turnOpen() {
  if (!turning) return;
  chevronOf(turning)?.animate([{ transform: 'rotate(-90deg)' }, { transform: 'none' }], { duration: 320, easing: GLIDE }); // (with the contents opening)
  turning = null;
}
function openExpanded(held) {
  if (!held) return;
  const { body, h } = held;
  body.style.height = '';
  body.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 320, easing: GLIDE })
    .finished.catch(() => {}).then(() => { body.style.overflow = ''; body.style.minHeight = ''; });
}

function startNoteEdit(id) {
  editingNoteId = id;
  const group = document.querySelector(`#board .group[data-id="${CSS.escape(id)}"]`);
  const note = group?.querySelector('.note');
  noteMorph = { id, height: note ? note.getBoundingClientRect().height : 0, edit: true, ghost: noteGhost(note),
    empty: group?.classList.contains('empty-group') };
  render();
  const ta = document.querySelector(`.group[data-id="${CSS.escape(id)}"] .note-edit`);
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}

// A note just saved: the rendered note grows / shrinks from the editor's height while its text fades in.
// It is held at the editor's height while the layout is measured, so nothing below it gets a FLIP
// slide on top of the height change (which would overshoot); they just follow the note.
// Opening the editor works the same way the other way round: the editor grows from the note.
// The old content (a copy laid over the new element) fades out while the new content fades in.
// In an empty group (no links, no note) the whole body opens / closes instead, as it shows or hides with the editor.
let noteMorph = null; // { id, height, edit, ghost, empty (opening an empty group), body (its height, closing) }

// A copy of the note / editor to fade out over its replacement (text only: no background or border).
function noteGhost(el) {
  if (!el) return null;
  const g = el.cloneNode(true);
  if (el.matches('textarea')) { g.value = el.value; g.readOnly = true; g.tabIndex = -1; g.scrollTop = el.scrollTop; }
  g.removeAttribute('title');
  g.classList.add('note-ghost');
  return g;
}
const NO_BOX = { paddingTop: '0px', paddingBottom: '0px', borderBottomWidth: '0px' };
// The same, for keyframes: a border between 0 and 1px is drawn 1px wide, so instead of thinning it a
// -1px margin takes its place back while it fades (else it stays until the end, then snaps shut).
const NO_RULE = { borderBottomColor: 'transparent', marginBottom: '-1px' };
function holdNote() {
  if (!noteMorph) return null;
  const held0 = noteMorph;
  const { id, height, edit } = noteMorph;
  const group = document.querySelector(`#board .group[data-id="${CSS.escape(id)}"]`);
  if (!group || !group.querySelector('.note-edit') !== !edit) return null; // not drawn yet
  noteMorph = null;
  const shut = !edit && group.classList.contains('empty-group');
  if (shut || (edit && held0.empty)) {
    const body = group.querySelector('.group-body');
    group.classList.remove('empty-group'); // keeps the body drawn while it closes (put back after)
    const from = shut ? held0.body : 0;
    Object.assign(body.style, { height: `${from}px`, overflow: 'hidden' });
    if (!shut) group.querySelector('.group-head').style.borderBottomWidth = '0px'; // (its rule comes with the body)
    const ghost = shut ? held0.ghost : null;
    if (ghost) {
      const r = body.getBoundingClientRect();
      Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${height}px` });
      document.body.append(ghost);
    }
    return { body, group, shut, from, ghost, note: group.querySelector('.note-edit') };
  }
  let note = group.querySelector(edit ? '.note-edit' : '.note');
  if (!note && !edit) {
    // the note was emptied: a blank stand-in closes up in its place, so nothing below jumps
    const body = group.querySelector('.group-body');
    if (!body) return null;
    note = h('div', { class: 'note-spacer' });
    body.prepend(note);
  }
  if (!note) return null;
  // held at nothing, padding and border too: else what is below is measured that much lower
  Object.assign(note.style, { height: `${height}px`, minHeight: '0', overflow: 'hidden' }, height ? {} : NO_BOX);
  const { ghost } = held0;
  if (ghost) {
    const r = note.getBoundingClientRect();
    Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${height}px` });
    document.body.append(ghost);
  }
  return { note, height, ghost };
}
function growNote(held) {
  if (!held) return;
  if (held.body) return growBody(held);
  const { note, height, ghost } = held;
  const grow = () => {
    Object.assign(note.style, { height: '', minHeight: '' }, height ? {} : { paddingTop: '', paddingBottom: '', borderBottomWidth: '' });
    const to = note.getBoundingClientRect().height;
    note.style.minHeight = '0'; // the editor's min-height would cut the start of the morph
    // from / to nothing (an empty note): padding and border go too, or the box would pop in at
    // their size; and no spring when closing up, as its dip below zero would just stall at zero
    const none = { height: '0px', paddingTop: '0px', paddingBottom: '0px', ...NO_RULE };
    const gone = note.matches('.note-spacer');
    note.animate([height ? { height: `${height}px` } : none, gone ? none : { height: `${to}px` }],
      { duration: gone ? 280 : 340, easing: gone ? 'cubic-bezier(.22, 1, .36, 1)' : SPRING })
      .finished.catch(() => {}).then(() => {
        if (note.matches('.note-spacer')) note.remove();
        else { note.style.overflow = ''; note.style.minHeight = ''; }
      });
    const fade = { duration: 240, easing: 'ease-out' };
    if (note.matches('textarea')) note.animate([{ color: 'transparent' }, { color: getComputedStyle(note).color }], fade);
    else for (const child of note.children) child.animate([{ opacity: 0 }, { opacity: 1 }], fade);
    ghost?.animate([{ opacity: 1, height: `${height}px` }, { opacity: 0, height: `${to}px` }], { ...fade, duration: 200, fill: 'forwards' })
      .finished.catch(() => {}).then(() => ghost.remove());
  };
  // math changes the note's size once typeset: keep holding until then, so the note goes straight
  // to its final size instead of shrinking to the raw TeX and growing back
  if (![...note.querySelectorAll('.math')].some((m) => !m.querySelector('mjx-container'))) return grow();
  for (const child of note.children) child.style.opacity = '0';
  mathReady().then(() => {
    for (const child of note.children) child.style.opacity = '';
    if (note.isConnected) grow();
  });
}

function growBody({ body, group, shut, from, ghost, note }) {
  body.style.height = '';
  group.querySelector('.group-head').style.borderBottomWidth = '';
  const to = shut ? 0 : body.getBoundingClientRect().height;
  const opts = shut ? { duration: 280, easing: 'cubic-bezier(.22, 1, .36, 1)' } : { duration: 340, easing: SPRING };
  const line = [{ marginBottom: '0px' }, NO_RULE]; // the header's rule over the body
  group.querySelector('.group-head').animate(shut ? line : line.reverse(), opts);
  body.animate([{ height: `${from}px` }, { height: `${to}px` }], opts).finished.catch(() => {}).then(() => {
    body.style.overflow = '';
    if (shut) group.classList.add('empty-group');
  });
  const fade = { duration: 240, easing: 'ease-out' };
  if (note) note.animate([{ color: 'transparent' }, { color: getComputedStyle(note).color }], fade);
  ghost?.animate([{ opacity: 1 }, { opacity: 0 }], { ...fade, duration: 200, fill: 'forwards' })
    .finished.catch(() => {}).then(() => ghost.remove());
}

function saveNote(id, before, after) {
  editingNoteId = null;
  const ta = document.querySelector(`.group[data-id="${CSS.escape(id)}"] .note-edit`);
  noteMorph = ta ? { id, height: ta.getBoundingClientRect().height, ghost: noteGhost(ta),
    body: ta.closest('.group-body').getBoundingClientRect().height } : null;
  if (after !== (before || '')) apply({ op: 'patch', id, fields: { note: after } });
  else render();
}

// Undo / redo of deletes and moves (Ctrl+Z / Ctrl+Shift+Z, and a delete toast's Undo): the whole state
// from before each one is kept (the last 50), and undoing puts it back (keeping the state it replaces for
// redo). Undoing an older one (from its toast) also undoes what came after it. The extension keeps the
// history, so every open dashboard shares it; with an older extension, this page keeps its own.
// `what` ({ verb: delete | move | merge, type, n }) names the change in the undo / redo toast, e.g.
// "그룹 3개 삭제를 취소했습니다."
const pageHistory = {
  past: [], future: [], seq: 0, // (past: what undo puts back; future: what redo does)
  async remember({ before, what }) {
    const id = ++this.seq;
    this.past.push({ id, before, what });
    if (this.past.length > 50) this.past.shift();
    this.future.length = 0;
    return id;
  },
  async undo({ id }) {
    const i = id == null ? this.past.length - 1 : this.past.findIndex((e) => e.id === id);
    if (i < 0) return null;
    const [entry] = this.past.splice(i);
    return this.swap(entry, this.future);
  },
  async redo() {
    const entry = this.future.pop();
    return entry ? this.swap(entry, this.past) : null;
  },
  async swap(entry, other) { // puts back entry's state, keeping the one it replaces in `other`
    const now = structuredClone(state);
    if (!(await apply({ op: 'replace', state: entry.before }))) return null;
    other.push({ id: ++this.seq, before: now, what: entry.what });
    return { what: entry.what };
  },
};
const undoHistory = (cmd, args = {}) => (extFeatures.has('sharedHistory') ? run(B.call(cmd, args)) : pageHistory[cmd](args));
// Returns the entry's id, for its toast's Undo
const remember = (before, what) => undoHistory('remember', { before, what });
async function undo(id = null, quiet = false) {
  const r = await undoHistory('undo', { id });
  if (r && !quiet) toast(undoText('undo', r.what));
}
async function redo() {
  const r = await undoHistory('redo');
  if (r) toast(undoText('redo', r.what));
}
// (a mix of links and folders counts as items)
const whatOf = (verb, nodes) => ({ verb, n: nodes.length, type: nodes.every((x) => x.type === nodes[0].type) ? nodes[0].type : 'item' });
function undoText(dir, what) {
  if (!what) return t(dir === 'undo' ? 'toast.undone' : 'toast.redone');
  if (!what.type) return t(`${dir}.${what.verb}`, { n: what.n }); // (merge, closeDupes, dedupe, save: one sentence each)
  const noun = what.n > 1 ? t(`noun.${what.type}N`, { n: what.n }) : t(`noun.${what.type}`);
  return t(`${dir}.${what.verb}`, { what: noun });
}

async function deleteNode(node) {
  const n = T.countLinks(node);
  if ((node.type === 'workspace' || node.type === 'category') && n > 0 &&
      !(await confirmDialog({
        title: t(`del.${node.type}`, { name: node.name }),
        text: t('del.links', { n }),
        ok: t('menu.delete'), danger: true,
      }))) return;
  const snapshot = structuredClone(state);
  await animateOut([node.id]);
  if (await apply({ op: 'remove', id: node.id })) {
    const entry = await remember(snapshot, whatOf('delete', [node]));
    toast(t('toast.deleted', { name: node.name || node.url }), t('common.undo'), () => undo(entry, true));
  }
}

const suspend = async (args) => {
  const n = await run(B.call('suspendTabs', args));
  if (n != null) toast(t('toast.suspended', { n }));
};

// Save tabs into `parentId`, or into the first group of the current category.
async function saveTabsTo(tabIds, parentId, index) {
  if (!parentId) {
    const cat = currentCat();
    if (!cat) return toast(t('toast.needCategory'));
    [parentId] = (await apply({ op: 'firstGroup', categoryId: cat.id })) || [];
    if (!parentId) return;
  }
  await run(B.call('saveTabs', { tabIds, parentId, index, close: settings.closeOnSave }));
}

async function saveWindow(windowId) {
  const id = await run(B.call('saveWindow', { windowId, newGroup: { categoryId: currentCat()?.id }, close: settings.closeOnSave }));
  // (the extension remembers it in the shared history: undo takes the group out and opens the tabs again)
  if (id && extFeatures.has('sharedHistory')) toast(t('toast.windowSaved'), t('common.undo'), () => undo(null, true));
  else toast(t(id ? 'toast.windowSaved' : 'toast.nothingToSave'));
}

/* ---------- confirm dialog ---------- */

// Styled replacement for window.confirm(). Resolves true only when the action button is used.
function confirmDialog({ title, text = '', ok = t('common.ok'), cancel = t('common.cancel'), danger = false }) {
  const dlg = $('#confirm');
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  $('#confirm-text').hidden = !text;
  const okBtn = $('#confirm-ok');
  okBtn.textContent = ok;
  $('#confirm-cancel').textContent = cancel;
  okBtn.classList.toggle('danger', danger);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      $('#confirm-form').removeEventListener('submit', onOk);
      $('#confirm-cancel').removeEventListener('click', onCancel);
      dlg.removeEventListener('close', onCancel);
      if (dlg.open) dlg.close();
      resolve(v);
    };
    const onOk = (e) => { e.preventDefault(); finish(true); };
    const onCancel = () => finish(false);
    $('#confirm-form').addEventListener('submit', onOk);
    $('#confirm-cancel').addEventListener('click', onCancel);
    dlg.addEventListener('close', onCancel);
    dlg.showModal();
    okBtn.focus();
  });
}

/* ---------- editor dialog ---------- */

// Symbol field: a square showing the emoji (clearable), a search box, and a grid that shows
// recent/common emoji when the box is empty and live search results while typing.
// `blankIcon`: shown faintly in the empty box (a folder's default icon), so an empty symbol reads as it.
function symbolField(label, input, err, blankIcon = null) {
  input.classList.add('sym-box');
  input.maxLength = 16;
  input.addEventListener('input', () => {
    const v = T.normalizeSymbol(input.value);
    if (v !== input.value) input.value = v;
  });
  const grid = h('div', { class: 'emoji-grid' });
  const status = h('div', { class: 'emoji-status muted small' });
  const search = h('input', { type: 'search', class: 'emoji-search', placeholder: t('emoji.search'), autocomplete: 'off' });
  const clear = h('button', { type: 'button', class: 'sym-clear', title: t('emoji.remove'), onclick: () => set('') }, icon('close', 11));
  const logoView = h('span', { class: 'sym-logo-view', 'aria-hidden': 'true' }, h('span', { class: 'logo' })); // (the box holds its code)
  const wrap = h('div', { class: 'sym-wrap' }, input, logoView, blankIcon && h('span', { class: 'sym-default', 'aria-hidden': 'true' }, blankIcon), clear);

  function set(em) {
    const old = input.value;
    const { fontSize, fontWeight, color } = getComputedStyle(input); // (before sync() restyles a letter)
    input.value = em;
    err.textContent = '';
    input.dispatchEvent(new Event('input', { bubbles: true })); // (syncs the grid; a live preview hears it too)
    if (em !== old) popSymbol(old, { fontSize, fontWeight, color });
    if (em && !T.isLogoSymbol(em)) recordEmoji(em);
  }
  // Picked or cleared (not typed): the old symbol shrinks away over the box while the new one springs
  // in, the box itself staying put. Both are copies laid over the box (inside the dialog, which sits
  // above the page) and scaled with a transform: animating the input's own font size made the glyph
  // bob as each size was laid out again. The copies are inputs too (bare: no border or fill), so the
  // glyph sits exactly where the box draws it. The box's own text is hidden while the new copy grows.
  let popping = null; // { anim, copy }
  const overBox = (text, look) => {
    if (T.isLogoSymbol(text)) { // the logo: drawn, not typed
      const copy = h('span', { class: 'sym-copy sym-logo-copy', 'aria-hidden': 'true', style: `left: ${input.offsetLeft}px; top: ${input.offsetTop}px` }, h('span', { class: 'logo' }));
      wrap.append(copy);
      return copy;
    }
    const copy = input.cloneNode();
    copy.removeAttribute('name');
    Object.assign(copy, { value: text, readOnly: true, tabIndex: -1 });
    copy.classList.add('sym-copy');
    copy.setAttribute('aria-hidden', 'true');
    Object.assign(copy.style, { left: `${input.offsetLeft}px`, top: `${input.offsetTop}px`, fontSize: look.fontSize, fontWeight: look.fontWeight, color: look.color });
    wrap.append(copy);
    return copy;
  };
  function popSymbol(old, was) {
    if (popping) { popping.anim.cancel(); popping.copy.remove(); popping = null; input.style.fontSize = ''; wrap.classList.remove('popping'); }
    if (input.value) {
      const copy = overBox(input.value, getComputedStyle(input));
      input.style.fontSize = '0px';
      wrap.classList.add('popping'); // (the box's own logo hides too)
      const anim = copy.animate([{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: SPRING });
      const mine = popping = { anim, copy };
      anim.finished.catch(() => {}).then(() => {
        if (popping !== mine) return;
        popping = null;
        copy.remove();
        input.style.fontSize = '';
        wrap.classList.remove('popping');
      });
    }
    if (!old) return;
    const copy = overBox(old, was);
    copy.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 130, easing: 'ease-in', fill: 'forwards' })
      .finished.catch(() => {}).then(() => copy.remove());
  }
  function sync() {
    wrap.classList.toggle('blank', !input.value);
    wrap.classList.toggle('is-logo', T.isLogoSymbol(input.value));
    input.classList.toggle('letter', T.isLetterSymbol(input.value));
    for (const b of grid.children) b.classList.toggle('selected', b.dataset.emoji === input.value);
  }
  function show(list, note = '') {
    grid.replaceChildren(...list.map((e) => h('button', {
      type: 'button', title: e.name || e.unicode, dataset: { emoji: e.unicode }, onclick: () => set(e.unicode),
      // Enter on a symbol (focused by the click that picked it) saves, rather than picking it again
      onkeydown: (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); set(e.unicode); input.form?.requestSubmit(); } },
    }, T.isLetterSymbol(e.unicode) || T.isLogoSymbol(e.unicode) ? symbolEl(e.unicode) : e.unicode)));
    status.textContent = note;
    sync();
  }

  // the logo first, in the accent colour (one: it follows the theme like the rest of the page)
  const defaults = () => [...(canLogoSymbol() ? [{ unicode: T.LOGO_SYMBOL, name: 'tabcat' }] : []), ...EMOJIS.map((unicode) => ({ unicode }))];
  async function showDefaults() {
    show(defaults());
    try {
      const recent = await favoriteEmoji(16);
      if (search.value.trim()) return;
      const seen = new Set();
      const all = defaults(), logo = all.filter((e) => T.isLogoSymbol(e.unicode)), rest = all.filter((e) => !T.isLogoSymbol(e.unicode));
      show([...logo, ...recent, ...rest].filter((e) => !seen.has(e.unicode) && seen.add(e.unicode)).slice(0, 40));
    } catch { /* offline: keep the built-in list */ }
  }

  let seq = 0;
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    const q = search.value.trim();
    if (!q) return void showDefaults();
    // a single letter or digit is offered as a letter symbol, ahead of any emoji matches
    const letter = /^[a-z0-9]$/i.test(q) ? [{ unicode: q.toUpperCase(), name: t('emoji.letter', { c: q.toUpperCase() }) }] : [];
    timer = setTimeout(async () => {
      const mine = ++seq;
      try {
        const found = [...letter, ...await searchEmoji(q)];
        if (mine === seq) show(found, found.length ? '' : t('emoji.none'));
      } catch {
        if (mine === seq) show(letter, t('emoji.offline'));
      }
    }, 120);
  });
  search.addEventListener('keydown', (e) => {
    // Enter picks the first match; with nothing to search, or the match already picked, it saves
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = grid.querySelector('button');
      if (!search.value.trim() || !first || first.dataset.emoji === input.value) input.form?.requestSubmit();
      else first.click();
    }
    if (e.key === 'Escape' && search.value) { e.preventDefault(); search.value = ''; showDefaults(); }
  });
  input.addEventListener('input', sync);
  showDefaults();

  // a div, not a label: clicks in the grid must not move focus to the symbol box
  return h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('field.symbolHint', { label })),
    h('div', { class: 'sym-row' }, wrap, search), grid, status);
}

const ICON_SIZE = 64;

// Downscales an uploaded image to a small square PNG data URL, so it stays cheap to store and sync.
function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, ICON_SIZE / Math.max(img.naturalWidth || ICON_SIZE, img.naturalHeight || ICON_SIZE));
      const w = Math.max(1, Math.round((img.naturalWidth || ICON_SIZE) * scale));
      const ht = Math.max(1, Math.round((img.naturalHeight || ICON_SIZE) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.max(w, ht);
      canvas.getContext('2d').drawImage(img, (canvas.width - w) / 2, (canvas.height - ht) / 2, w, ht);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

// Friendly two-word names for things created without a name ("Quiet Otter", "Amber Comet", ...),
// from the current language's word lists.
const NAMED_BY_DEFAULT = new Set(['workspace', 'category', 'group', 'folder']);

// A random name not already used by another item of the same type.
function suggestName(type) {
  const taken = new Set();
  if (state) T.walk(state.workspaces, (n) => { if (n.type === type) taken.add(n.name); });
  for (let i = 0; i < 50; i++) {
    const name = randomName();
    if (!taken.has(name)) return name;
  }
  return `${randomName()} ${Math.floor(Math.random() * 90) + 10}`;
}

// The group colour: round swatches like Settings > Color (in Chrome's tab group colours), after a plain
// one (the default card).
function colorField(label, input) {
  input.type = 'hidden';
  if (OLD_GROUP_COLORS[input.value]) input.value = OLD_GROUP_COLORS[input.value];
  const swatch = (name) => {
    const c = GROUP_COLORS[name];
    const tip = t(c ? c[2] : 'color.none');
    return h('label', { class: 'swatch' + (c ? ' group-swatch' : ' plain'), dataset: { accent: name || 'none' }, title: tip, style: c ? `--sw: ${c[1]}` : null }, // (the pastel shade, in either theme)
      h('input', { type: 'radio', name: 'group-color', value: name, 'aria-label': tip, checked: input.value === name, onchange: () => { input.value = name; input.dispatchEvent(new Event('input', { bubbles: true })); } }));
  };
  return h('div', { class: 'field' }, h('span', { class: 'field-label' }, label),
    h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': label }, swatch(''), ...Object.keys(GROUP_COLORS).map(swatch)), input);
}

// `onPreview(values)` (optional) hears the fields as they are edited, before any check.
// Another group with this name (ignoring case) and symbol? (The extension keeps them apart, so a tab
// group can be traced back to its group by its title.)
function groupClash(name, symbol, exceptId) {
  const key = `${name.trim().toLowerCase()}|${symbol}`;
  let clash = false;
  T.walk(state.workspaces, (n) => { if (n.type === 'group' && n.id !== exceptId && `${n.name.trim().toLowerCase()}|${n.symbol}` === key) clash = true; });
  return clash;
}

function openEditor(type, data = {}, title, onPreview = null) {
  const dlg = $('#editor');
  const form = $('#editor-form');
  const fields = $('#editor-fields');
  const err = $('#editor-error');
  $('#editor-title').textContent = title || t(`edit.${type}`);
  err.textContent = '';
  const inputs = {};
  // a new workspace / category / group / folder may be left unnamed: it gets the suggested name,
  // shown faintly in the empty field so you see what you'll get
  const suggestion = !data.id && NAMED_BY_DEFAULT.has(type) ? suggestName(type) : '';
  fields.replaceChildren(...FIELDS[type].map(([key, kind, required]) => {
    const label = t(`field.${key}`);
    if (key === 'name' && suggestion) required = false;
    const input = kind === 'textarea'
      ? h('textarea', {
        name: key, placeholder: t('field.ctrlEnter'),
        onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } },
      })
      : h('input', { name: key, type: 'text', required: required ? true : null, autocomplete: 'off' });
    input.value = data[key] || '';
    if (key === 'name' && suggestion) input.placeholder = suggestion;
    inputs[key] = input;
    if (kind === 'emoji') return symbolField(label, input, err, type === 'folder' ? icon('folder', 20) : null);
    if (kind === 'color') return colorField(label, input);
    if (kind === 'icon') {
      const preview = iconImg(data.url || '', data.icon || '');
      input.placeholder = t('icon.placeholder');
      input.addEventListener('input', () => { preview.src = input.value || T.faviconFor(inputs.url.value); });
      const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
      file.addEventListener('change', async () => {
        const f = file.files[0];
        file.value = '';
        if (!f) return;
        try {
          input.value = await imageToDataUrl(f);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          err.textContent = '';
        } catch { err.textContent = t('icon.bad'); }
      });
      const fieldBtn = (name, label, fn) => h('button', { class: 'btn field-btn', type: 'button', title: label, 'aria-label': label, onclick: fn }, icon(name, 16));
      return h('label', {}, label, h('div', { class: 'icon-preview' }, preview, input, file,
        fieldBtn('upload', t('icon.upload'), () => file.click()),
        fieldBtn('close', t('icon.clear'), () => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); })));
    }
    return h('label', {}, label + (required ? ' *' : ''), input);
  }));
  if (type === 'link') {
    inputs.url.placeholder = 'https://…';
    inputs.url.addEventListener('blur', () => {
      if (!inputs.name.value.trim() && inputs.url.value.trim()) inputs.name.value = T.normalizeUrl(inputs.url.value);
    });
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      form.removeEventListener('submit', onSubmit);
      form.removeEventListener('input', onInput);
      $('#editor-cancel').removeEventListener('click', onCancel);
      dlg.removeEventListener('close', onCancel);
      if (dlg.open) dlg.close();
      resolve(v);
    };
    const onCancel = () => finish(null);
    const onInput = () => {
      const v = {};
      for (const [k, el] of Object.entries(inputs)) v[k] = k === 'note' || k === 'description' ? el.value : el.value.trim();
      if (!v.name) v.name = data.name || suggestion; // (a cleared name shows the one it would keep)
      if ('symbol' in v) { v.symbol = T.normalizeSymbol(v.symbol); if (!T.isValidSymbol(v.symbol)) v.symbol = data.symbol || ''; }
      onPreview(v);
    };
    const onSubmit = (e) => {
      e.preventDefault();
      const v = {};
      for (const [k, el] of Object.entries(inputs)) v[k] = k === 'note' || k === 'description' ? el.value : el.value.trim();
      if ('url' in v) {
        v.url = T.normalizeUrl(v.url);
        if (!v.url) return void (err.textContent = t('err.urlRequired'));
        try { new URL(v.url); } catch { return void (err.textContent = t('err.urlInvalid')); }
        if (!v.name) v.name = v.url;
      }
      if (!v.name && suggestion) v.name = suggestion;
      if (!v.name) return void (err.textContent = t('err.nameRequired'));
      if ('symbol' in v) v.symbol = T.normalizeSymbol(v.symbol);
      if ('symbol' in v && !T.isValidSymbol(v.symbol)) return void (err.textContent = t('err.symbol'));
      if (type === 'group' && groupClash(v.name, v.symbol || '', data.id)) return void (err.textContent = t('err.groupClash'));
      finish(v);
    };
    form.addEventListener('submit', onSubmit);
    if (onPreview) form.addEventListener('input', onInput);
    $('#editor-cancel').addEventListener('click', onCancel);
    dlg.addEventListener('close', onCancel);
    dlg.showModal();
    (inputs.url && !data.url ? inputs.url : inputs.name).focus();
  });
}

const LIVE_EDIT = new Set(['group', 'folder', 'link']);
async function editNode(node) {
  if (!LIVE_EDIT.has(node.type)) {
    const v = await openEditor(node.type, node);
    if (v) apply({ op: 'patch', id: node.id, fields: v });
    return;
  }
  // a group, folder or link shows its edits on the board while the editor is open: Save keeps them,
  // Cancel / Esc puts it back as it was. (Not a link's URL until saved: every keystroke would fetch
  // another favicon.)
  const v = await openEditor(node.type, node, undefined, ({ url, ...fields }) => showPreview(node.id, fields));
  if (!v) return showPreview(node.id, null);
  showPreview(node.id, v);
  const seq = stateSeq;
  const ok = await apply({ op: 'patch', id: node.id, fields: v });
  // the saved state comes as its own message, maybe after the reply: hold the preview (which shows
  // the same) until it is here, so the card never flicks back to the old values in between
  if (ok && stateSeq === seq) await Promise.race([nextState(), new Promise((r) => setTimeout(r, 1500))]);
  showPreview(node.id, null);
}

// The group being edited: its edited fields, laid over the stored group when it is drawn.
let preview = null; // { id, fields }
let previewFrame = 0;
function showPreview(id, fields) {
  preview = fields ? { id, fields } : null;
  cancelAnimationFrame(previewFrame); // (typing: one redraw per frame)
  previewFrame = requestAnimationFrame(() => {
    // tab groups opened from it follow too (an older extension doesn't know the call: ignored)
    B.call('previewTabGroups', { id, fields }).catch(() => {});
    const was = document.querySelector(`#board .group[data-id="${CSS.escape(id)}"]`);
    cardMorph = was && { id, was, look: cardLook(was) };
    const item = document.querySelector(`#board .item[data-id="${CSS.escape(id)}"]`);
    const mark = item && itemMark(item);
    render();
    cardMorph = null;
    // a folder's symbol or a link's icon that changed springs in like a group's symbol
    const now = document.querySelector(`#board .item[data-id="${CSS.escape(id)}"]`);
    const el = now && now !== item && itemMark(now);
    if (el && el.key !== mark.key) el.el.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: SPRING });
  });
}
// the icon of a link row / the symbol of a folder row, and what it shows
function itemMark(item) {
  const el = item.querySelector(':scope > .link-row > img.fav, :scope > .folder-head > .sym');
  return el && { el, key: el.tagName === 'IMG' ? el.getAttribute('src') : el.textContent };
}

// A redrawn card eases from how it looked (see showPreview). Like a note (holdNote), it is held at
// its old height while the layout is measured, so the cards below get no slide of their own: they
// just follow it as it grows or shrinks.
let cardMorph = null; // { id, was, look }
function holdCard() {
  if (!cardMorph) return null;
  const { id, was, look } = cardMorph;
  cardMorph = null;
  const el = document.querySelector(`#board .group[data-id="${CSS.escape(id)}"]`);
  if (!el || el === was) return null; // not redrawn: nothing changed
  const to = el.getBoundingClientRect().height;
  if (Math.abs(to - look.height) >= 0.5) Object.assign(el.style, { height: `${look.height}px`, overflow: 'hidden' });
  return { el, look, to };
}

// What a card looked like (its height and the colours its group colour sets), so a redrawn card can
// ease from there: the height with the same glide as the cards below it, the colours with a fade.
const LOOK_PARTS = [[null, ['backgroundColor', 'borderColor']], ['.group-head', ['borderBottomColor']], ['.note', ['backgroundColor', 'borderBottomColor']]];
const headPart = (el, cls) => el.querySelector(`:scope > .group-head > .${cls}`);
function cardLook(el) {
  const sym = headPart(el, 'node-sym');
  return {
    sym: sym && { html: sym.innerHTML, rect: sym.getBoundingClientRect(), copy: sym.cloneNode(true) },
    infoLeft: headPart(el, 'node-info')?.getBoundingClientRect().left,
    height: el.getBoundingClientRect().height,
    parts: LOOK_PARTS.map(([sel, props]) => {
      const part = sel ? el.querySelector(sel) : el;
      const cs = part && getComputedStyle(part);
      return cs && Object.fromEntries(props.map((p) => [p, cs[p]]));
    }),
  };
}
function growCard(held) {
  if (!held) return;
  const { el, look, to } = held;
  LOOK_PARTS.forEach(([sel], i) => {
    const part = sel ? el.querySelector(sel) : el;
    if (part && look.parts[i]) part.animate([look.parts[i], {}], { duration: 240, easing: 'ease' });
  });
  // a new symbol springs in while the old one shrinks away where it was; when the symbol's column
  // opens or closes, the name and tools slide over instead of jumping
  const sym = headPart(el, 'node-sym');
  const old = look.sym;
  if (old && sym?.innerHTML !== old.html) {
    const { copy, rect } = old;
    copy.classList.add('sym-leaving');
    Object.assign(copy.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    document.body.append(copy);
    copy.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 130, easing: 'ease-in', fill: 'forwards' })
      .finished.catch(() => {}).then(() => copy.remove());
  }
  if (sym && sym.innerHTML !== old?.html) {
    sym.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: SPRING });
  }
  const info = headPart(el, 'node-info');
  const dx = info && look.infoLeft != null ? look.infoLeft - info.getBoundingClientRect().left : 0;
  if (Math.abs(dx) >= 0.5) info.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 280, easing: GLIDE });
  if (Math.abs(to - look.height) < 0.5) return;
  el.style.height = '';
  el.animate([{ height: `${look.height}px` }, { height: `${to}px` }], { duration: 420, easing: GLIDE })
    .finished.catch(() => {}).then(() => { el.style.overflow = ''; });
}

async function addWorkspace() {
  const v = await openEditor('workspace', {}, t('new.workspace'));
  if (!v) return;
  const node = { type: 'workspace', ...v, symbol: v.symbol || randomSymbol(), categories: [{ type: 'category', name: t('def.category') }] };
  const [id] = (await apply({ op: 'create', parentId: null, node })) || [];
  if (id) select(id);
}
// A new workspace left without a symbol gets one of these, preferring one no workspace has yet.
const WS_SYMBOLS = ['💼', '📚', '🏠', '✈️', '🎨', '🧪', '🎮', '🎵', '🌱', '🍳', '🏃', '📷', '🧭', '🛠️', '💡', '🚀', '🌙', '☕', '🐱', '📝', '🎬', '🧩', '🌊', '🍀'];
function randomSymbol() {
  const used = new Set(state.workspaces.map((w) => w.symbol));
  const free = WS_SYMBOLS.filter((x) => !used.has(x));
  const from = free.length ? free : WS_SYMBOLS;
  return from[Math.floor(Math.random() * from.length)];
}

async function addCategory(ws) {
  const v = await openEditor('category', {}, t('new.category'));
  if (!v) return;
  const [id] = (await apply({ op: 'create', parentId: ws.id, node: { type: 'category', ...v } })) || [];
  if (id) select(ws.id, id);
}

async function addNode(type, parentId, title, extra = {}) {
  const v = await openEditor(type, {}, title);
  if (v) apply({ op: 'create', parentId, node: { type, ...extra, ...v } });
}
// A new group in `column`: before group `beforeId`, or at the end of that column.
async function addGroup(cat, column = null, { beforeId = null, afterId = null } = {}) {
  const v = await openEditor('group', {}, t('new.group'));
  if (v) apply({ op: 'create', parentId: cat.id, index: columnIndex(cat, column, { beforeId, afterId }), node: { type: 'group', column, ...v } });
}
const addLink = (parentId) => addNode('link', parentId, t('new.link'));
const addFolder = (parentId) => addNode('folder', parentId, t('new.folder'));

/* ---------- context menu ---------- */

function showMenu(e, entries) {
  e.preventDefault();
  e.stopPropagation();
  const menu = $('#menu');
  if (menu.dataset.closing != null) { delete menu.dataset.closing; menu.getAnimations().forEach((a) => a.cancel()); }
  // each entry may have a one-letter shortcut (shown on the right; press it while the menu is open)
  menu.replaceChildren(...entries.filter(Boolean).map((it) => (it === '-' ? h('hr') :
    h('button', { class: it.danger ? 'danger' : '', dataset: { key: it.key || '' }, onclick: () => { hideMenu(); it.fn(); } },
      it.icon && icon(it.icon), h('span', { class: 'menu-label' }, it.label), it.key && h('kbd', {}, it.key)))));
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(e.clientX, innerWidth - r.width - 8) + 'px';
  menu.style.top = Math.min(e.clientY, innerHeight - r.height - 8) + 'px';
}
// Fade the menu out, then hide it (a menu reopened meanwhile cancels the fade).
function hideMenu() {
  const menu = $('#menu');
  if (menu.hidden || menu.dataset.closing != null) return;
  menu.dataset.closing = '';
  menu.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }],
    { duration: 100, easing: 'ease-in', fill: 'forwards' })
    .finished.then((a) => {
      if (menu.dataset.closing == null) return;
      delete menu.dataset.closing;
      menu.hidden = true;
      a.cancel();
    }, () => {});
}

function nodeMenu(e, node) {
  if (pickedItems.size > 1 && pickedItems.has(node.id)) return showMenu(e, itemsMenu());
  if (selected.size > 1 && selected.has(node.id)) return showMenu(e, groupsMenu());
  const n = T.countLinks(node);
  const open = n ? [{ icon: 'open', label: t('menu.openAll', { n }), key: 'O', fn: () => openAll(node) },
    { icon: 'window', label: t('menu.openAllWindow'), key: 'W', fn: () => openAll(node, true) }] : [];
  const del = { icon: 'trash', label: t('menu.delete'), key: 'D', danger: true, fn: () => deleteNode(node) };
  const edit = { icon: 'edit', label: t('menu.edit'), key: 'E', fn: () => editNode(node) };
  const menus = {
    workspace: [edit, { icon: 'category', label: t('new.category'), key: 'C', fn: () => addCategory(node) }, ...open,
      { icon: 'download', label: t('menu.export'), key: 'X', fn: () => exportData(node.id) }, '-', del],
    category: [edit, { icon: 'group', label: t('new.group'), key: 'G', fn: () => addGroup(node) }, ...open, '-', del],
    group: [edit, { icon: 'note', label: t('act.editNote'), key: 'N', fn: () => startNoteEdit(node.id) },
      { icon: 'link', label: t('act.addLink'), key: 'L', fn: () => addLink(node.id) }, { icon: 'folder', label: t('act.addFolder'), key: 'F', fn: () => addFolder(node.id) },
      { icon: 'tabs', label: t('menu.addWindowTabs'), key: 'T', fn: () => addWindowTabs(node.id) },
      ...open, { icon: 'sort', label: t('menu.sortName'), key: 'S', fn: () => sortItems(node) },
      { icon: 'dedupe', label: t('menu.dedupe'), key: 'U', fn: () => dedupeLinks(node) }, '-', del],
    folder: [edit, { icon: 'link', label: t('act.addLink'), key: 'L', fn: () => addLink(node.id) }, T.folderDepth(state, node.id) < T.MAX_FOLDER_DEPTH && { icon: 'folder', label: t('act.addSubfolder'), key: 'F', fn: () => addFolder(node.id) },
      ...open, { icon: 'sort', label: t('menu.sortName'), key: 'S', fn: () => sortItems(node) }, '-', del],
    link: [{ icon: 'open', label: t('menu.open'), key: 'O', fn: () => openLink(node) }, { icon: 'window', label: t('menu.openWindow'), key: 'W', fn: () => openLink(node, { shiftKey: true }) },
      edit, { icon: 'copy', label: t('menu.copyUrl'), key: 'C', fn: () => navigator.clipboard.writeText(node.url).then(() => toast(t('toast.urlCopied'))) }, '-', del],
  };
  showMenu(e, menus[node.type]);
}

async function addWindowTabs(groupId) {
  const data = await run(B.call('getTabs'));
  const win = data?.windows.find((w) => w.id === data.currentWindowId);
  if (win) await saveTabsTo(win.tabs.filter((t) => !t.pinned).map((t) => t.id), groupId);
}

function sortItems(node) {
  // folders first, then everything alphabetically
  const items = [...node.items].sort((a, b) =>
    (a.type === b.type ? (a.name || '').localeCompare(b.name || '') : a.type === 'folder' ? -1 : 1));
  apply({ op: 'patch', id: node.id, fields: { items } });
}

async function dedupeLinks(node) {
  let removed = 0;
  const seen = new Set();
  const prune = (items) => items.filter((n) => n.type === 'folder' ? (n.items = prune(n.items), true)
    : seen.has(n.url) ? (removed++, false) : (seen.add(n.url), true));
  const items = prune(structuredClone(node.items));
  const snapshot = structuredClone(state);
  if (removed && await apply({ op: 'patch', id: node.id, fields: { items } })) {
    const entry = await remember(snapshot, { verb: 'dedupe' });
    toast(t('toast.removedDupes', { n: removed }), t('common.undo'), () => undo(entry, true));
  } else toast(t('toast.removedDupes', { n: removed }));
}

/* ================= group selection ================= */

// Groups selected on the board (drag a rectangle over empty board space, or Ctrl/⌘-click a header).
// Delete removes them, Esc clears; selection is per view and never stored.
const selected = new Set();

function paintSelection() {
  for (const card of document.querySelectorAll('#board .group')) card.classList.toggle('selected', selected.has(card.dataset.id));
  document.body.classList.toggle('select-mode', selected.size > 0);
}
function toggleSelected(id) {
  if (pickedItems.size) clearItems();
  if (!selected.delete(id)) selected.add(id);
  paintSelection();
}
function clearSelection() {
  selected.clear();
  paintSelection();
}

// Rubber-band selection: starts on empty board space (not on a card, gap or button).
$('#board').addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !$('#board').dataset.parent) return;
  if (e.shiftKey && !e.target.closest('button, input, textarea, a, .note')) return smartBox(e);
  // (the New group card and the gaps add a group on a plain click, but pressing and moving
  // there starts a box selection like the rest of the empty board)
  if (e.target.closest('.group, button, input, textarea, a')) return;
  // plain: select what the box covers; Ctrl/⌘: add it; Shift: invert it
  const mode = e.shiftKey ? 'invert' : e.ctrlKey || e.metaKey ? 'add' : 'replace';
  const base = mode === 'replace' ? new Set() : new Set(selected);
  const x0 = e.clientX, y0 = e.clientY;
  const box = h('div', { id: 'marquee' });
  let moved = false;
  const onMove = (ev) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
    if (!moved) { moved = true; hideTip(); document.body.append(box); document.body.classList.add('selecting'); }
    const r = { left: Math.min(x0, ev.clientX), top: Math.min(y0, ev.clientY), right: Math.max(x0, ev.clientX), bottom: Math.max(y0, ev.clientY) };
    Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.right - r.left + 'px', height: r.bottom - r.top + 'px' });
    selected.clear();
    base.forEach((id) => selected.add(id));
    for (const card of document.querySelectorAll('#board .group')) {
      const c = card.getBoundingClientRect();
      if (!(c.left < r.right && c.right > r.left && c.top < r.bottom && c.bottom > r.top)) continue;
      const id = card.dataset.id;
      if (mode === 'invert' && base.has(id)) selected.delete(id);
      else selected.add(id);
    }
    paintSelection();
  };
  const onUp = () => {
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerup', onUp);
    box.remove();
    document.body.classList.remove('selecting');
    if (!moved && !base.size) { clearSelection(); clearItems(); } // a plain click on empty space deselects
    // a box selection must not also count as a click on what it started on (e.g. New group)
    if (moved) addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
  };
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
});

async function deleteSelected() {
  const groups = [...selected].map((id) => T.locate(state, id)?.node).filter(Boolean);
  if (!groups.length) return clearSelection();
  const links = groups.reduce((n, g) => n + T.countLinks(g), 0);
  const one = groups.length === 1;
  if (links && !(await confirmDialog({
    title: one ? t('del.group', { name: groups[0].name }) : t('del.groups', { n: groups.length }),
    text: t(one ? 'del.links' : 'del.groupsLinks', { n: links }),
    ok: t('menu.delete'), danger: true,
  }))) return;
  const snapshot = structuredClone(state);
  selected.clear();
  await animateOut(groups.map((g) => g.id));
  if (await apply(...groups.map((g) => ({ op: 'remove', id: g.id })))) {
    const entry = await remember(snapshot, whatOf('delete', groups));
    toast(one ? t('toast.deleted', { name: groups[0].name }) : t('toast.deletedGroups', { n: groups.length }), t('common.undo'), () => undo(entry, true));
  }
}

/* ================= item selection ================= */

// Links and folders selected inside one group: Shift-click toggles one; Shift-drag (or any drag on
// empty space in that group while something is picked) draws a box. The group of the first pick
// is the only one that can take part until the selection is cleared (Esc, or a click elsewhere).
const pickedItems = new Set();
let pickedGroup = null;

const groupOf = (id) => T.locate(state, id)?.ancestors.find((a) => a.type === 'group')?.id ?? null;

function paintItems() {
  for (const el of document.querySelectorAll('#board .item')) el.classList.toggle('picked', pickedItems.has(el.dataset.id));
  document.body.classList.toggle('item-select', pickedItems.size > 0);
}
function clearItems() {
  pickedItems.clear();
  pickedGroup = null;
  paintItems();
}
function toggleItem(id) {
  const gid = groupOf(id);
  if (pickedGroup && gid !== pickedGroup) return; // outside the group of the first pick
  if (selected.size) clearSelection();
  pickedGroup = gid;
  if (!pickedItems.delete(id)) pickedItems.add(id);
  if (!pickedItems.size) pickedGroup = null;
  paintItems();
}

// Click on a link / folder: returns true when it was a selection click (so it must not open / toggle).
function itemClick(e, node) {
  if (e.shiftKey || (pickedItems.size && groupOf(node.id) === pickedGroup)) { toggleItem(node.id); return true; }
  if (pickedItems.size) clearItems();
  return false;
}

// Shift-drag anywhere on the board: a box that works out what you mean as it grows. Its group is the one
// it starts in (or, started outside any, the first one the pointer enters). While the pointer is level
// with that group's links / folders (below the line under its header, above the card's bottom; how far
// sideways doesn't matter), the box picks those: the rows its height spans. Once the pointer leaves
// that band (down past the card, up past the header line) it selects the groups it covers. Shift inverts
// what the box covers, as with clicks; `add` (a plain drag in the group of the current pick) adds it.
function smartBox(e, add = false) {
  e.preventDefault(); // no native drag of what is under the pointer
  e.stopImmediatePropagation();
  const baseGroups = new Set(selected), baseItems = new Set(pickedItems), baseItemGroup = pickedGroup;
  const x0 = e.clientX, y0 = e.clientY;
  let start = e.target instanceof Element ? e.target.closest('#board .group') : null;
  const box = h('div', { id: 'marquee' });
  let moved = false;
  const meets = (a, r) => a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top;
  const invert = (set, base, ids) => { set.clear(); base.forEach((id) => set.add(id)); ids.forEach((id) => (base.has(id) && !add ? set.delete(id) : set.add(id))); };
  const onMove = (ev) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
    if (!moved) { moved = true; hideTip(); document.body.append(box); document.body.classList.add('selecting'); }
    const r = { left: Math.min(x0, ev.clientX), top: Math.min(y0, ev.clientY), right: Math.max(x0, ev.clientX), bottom: Math.max(y0, ev.clientY) };
    Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.right - r.left + 'px', height: r.bottom - r.top + 'px' });
    const hit = [...document.querySelectorAll('#board .group')].filter((c) => meets(c.getBoundingClientRect(), r));
    let mode = 'none';
    // (by position: while the box is drawn nothing on the board takes the pointer)
    if (!start) start = [...document.querySelectorAll('#board .group')].find((c) => { const b = c.getBoundingClientRect(); return ev.clientX >= b.left && ev.clientX <= b.right && ev.clientY >= b.top && ev.clientY <= b.bottom; }) || null;
    const inGroup = start;
    if (start) {
      const c = start.getBoundingClientRect();
      const line = start.querySelector(':scope > .group-head').getBoundingClientRect().bottom;
      mode = ev.clientY > line && ev.clientY < c.bottom ? 'items' : 'groups';
      if (mode === 'groups' && !hit.includes(start)) hit.push(start);
    } else if (hit.length) mode = 'groups';
    if (mode === 'groups') {
      pickedItems.clear(); pickedGroup = null;
      invert(selected, baseGroups, hit.map((c) => c.dataset.id));
    } else if (mode === 'items') {
      selected.clear();
      const gid = inGroup.dataset.id;
      // (by the box's height alone: how far it reaches sideways doesn't matter)
      const rows = [...inGroup.querySelectorAll('.link-row, .folder-head')].filter((row) => { const c = row.getBoundingClientRect(); return c.top < r.bottom && c.bottom > r.top; });
      invert(pickedItems, baseItemGroup === gid ? baseItems : new Set(), rows.map((row) => row.closest('.item').dataset.id));
      pickedGroup = pickedItems.size ? gid : null;
    } else {
      invert(selected, baseGroups, []);
      invert(pickedItems, baseItems, []); pickedGroup = baseItemGroup;
    }
    box.classList.toggle('picking-items', mode === 'items');
    paintSelection();
    paintItems();
  };
  const onUp = () => {
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerup', onUp);
    box.remove();
    document.body.classList.remove('selecting');
    if (moved) addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
  };
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
}

// Box selection inside the group of the selection (without Shift: from empty space in that group).
$('#board').addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const body = e.target.closest('.group-body');
  if (!body || e.target.closest('button, input, textarea, a, .note')) return;
  const gid = body.closest('.group').dataset.id;
  const active = pickedItems.size && pickedGroup === gid;
  if (!active || e.target.closest('.item')) return; // (Shift-drags are handled by smartBox)
  return smartBox(e, true); // (the same box as a Shift-drag, adding to the pick)
});

const pickedNodes = () => [...pickedItems].map((id) => T.locate(state, id)?.node).filter(Boolean);

async function deleteItems() {
  const nodes = pickedNodes();
  clearItems();
  if (!nodes.length) return;
  const snapshot = structuredClone(state);
  await animateOut(nodes.map((n) => n.id));
  if (await apply(...nodes.map((n) => ({ op: 'remove', id: n.id })))) {
    const entry = await remember(snapshot, whatOf('delete', nodes));
    toast(t('toast.deletedItems', { n: nodes.length }), t('common.undo'), () => undo(entry, true));
  }
}

function itemsMenu() {
  const nodes = pickedNodes();
  const urls = [...new Set(nodes.flatMap((n) => T.collectLinks(n).map((l) => l.url)))];
  return [
    urls.length && { icon: 'open', label: t('menu.openLinks', { n: urls.length }), key: 'O', fn: () => run(B.call('openUrls', { urls })) },
    urls.length && { icon: 'window', label: t('menu.openWindow'), key: 'W', fn: () => run(B.call('openUrls', { urls, newWindow: true })) },
    urls.length && { icon: 'copy', label: t('menu.copyUrls'), key: 'C', fn: () => navigator.clipboard.writeText(urls.join('\n')).then(() => toast(t('toast.copiedUrls', { n: urls.length }))) },
    { icon: 'close', label: t('menu.clearSel'), key: 'X', fn: clearItems },
    '-',
    { icon: 'trash', label: t('menu.deleteItems', { n: nodes.length }), key: 'D', danger: true, fn: deleteItems },
  ];
}

function groupsMenu() {
  const groups = [...selected].map((id) => T.locate(state, id)?.node).filter(Boolean);
  const urls = [...new Set(groups.flatMap((g) => T.collectLinks(g).map((l) => l.url)))];
  return [
    urls.length && { icon: 'open', label: t('menu.openLinks', { n: urls.length }), key: 'O', fn: () => run(B.call('openUrls', { urls })) },
    urls.length && { icon: 'window', label: t('menu.openWindow'), key: 'W', fn: () => run(B.call('openUrls', { urls, newWindow: true })) },
    { icon: 'chevron', label: t('act.collapse'), key: 'C', fn: () => apply(...groups.map((g) => ({ op: 'patch', id: g.id, fields: { collapsed: true } }))) },
    { icon: 'chevron', label: t('act.expand'), key: 'E', fn: () => apply(...groups.map((g) => ({ op: 'patch', id: g.id, fields: { collapsed: false } }))) },
    { icon: 'close', label: t('menu.clearSel'), key: 'X', fn: clearSelection },
    '-',
    { icon: 'trash', label: t('menu.deleteGroups', { n: groups.length }), key: 'D', danger: true, fn: deleteSelected },
  ];
}

/* ================= drag & drop ================= */

const line = $('#drop-line');
let lineAt = null; // the line's box while it is shown
let intoEl = null;

// The insertion line pops in where it first appears, glides from slot to slot along the same track
// (same column and depth for a row line, same row for an upright one), and fades out. Moving to
// another track (the next column, into a folder) it doesn't slide across: a copy fades out where it
// was while the line fades in at the new place.
function setLine(l) {
  if (!l) { line.classList.remove('on'); lineAt = null; return; }
  const box = { left: l.x + 'px', top: l.y + 'px', width: l.w + 'px', height: l.h + 'px' };
  const sameTrack = lineAt && (l.w >= l.h
    ? Math.abs(lineAt.x - l.x) < 1 && Math.abs(lineAt.w - l.w) < 1
    : Math.abs(lineAt.y - l.y) < 1 && Math.abs(lineAt.h - l.h) < 1);
  const across = lineAt && !sameTrack;
  if (across) {
    const ghost = line.cloneNode();
    ghost.removeAttribute('id');
    ghost.className = 'drop-line-ghost';
    line.after(ghost);
    ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: 'ease-in', fill: 'forwards' })
      .finished.catch(() => {}).then(() => ghost.remove());
  }
  if (!sameTrack) {
    line.style.transition = 'none'; // jump to the new slot, then appear there
    line.classList.remove('on');
    line.classList.toggle('fade', !!across); // (across: a plain fade, no pop)
    Object.assign(line.style, box);
    void line.offsetWidth;
    line.style.transition = '';
    line.classList.add('on');
  } else Object.assign(line.style, box);
  lineAt = l;
}

// A drop target's highlight fades in and out: from what the element looked like a moment ago to
// what the class makes it look like now (whatever its own background is).
function setInto(el) {
  if (el === intoEl) return;
  const swap = (target, on) => {
    const cs = getComputedStyle(target);
    const ring = { outlineStyle: 'solid', outlineWidth: '2px', outlineOffset: '-2px' };
    const from = { ...ring, backgroundColor: cs.backgroundColor, outlineColor: on ? 'transparent' : cs.outlineColor };
    target.classList.toggle('drop-into', on);
    target.animate([from, on ? ring : { ...ring, outlineColor: 'transparent' }],
      { duration: on ? 120 : 110, easing: on ? 'ease-out' : 'ease-in' });
  };
  if (intoEl) swap(intoEl, false);
  if (el) swap(el, true);
  intoEl = el;
}

function clearIndicator() { showIndicator(null); }

function showIndicator(t) {
  setLine(t?.line || null);
  setInto(t && !t.line && t.mode !== 'newGroup' ? t.el || null : null);
  // the column's New group card stands for "new group"
  const card = t?.mode === 'newGroup' ? t.el || null : null;
  const was = document.querySelector('.add-group.drop-new');
  if (was !== card) { was?.classList.remove('drop-new'); card?.classList.add('drop-new'); }
}

// Past the right edge of the last column (while there are fewer than MAX_COLUMNS): a new column. A group
// dropped there moves into it; links, folders, tabs or a window make a new group there.
function newColumnTarget(e, d) {
  const board = $('#board');
  const n = boardColumns();
  if (!board.dataset.parent || n >= MAX_COLUMNS) return null;
  const type = d.kind === 'node' ? d.type : 'link';
  if (type === 'category' || type === 'workspace') return null;
  const last = [...board.querySelectorAll('.columns > .col')].at(-1);
  if (!last) return null;
  const lr = last.getBoundingClientRect(), br = board.getBoundingClientRect();
  const edge = Math.min(lr.right, br.right - board.offsetWidth + board.clientWidth); // (a scrolled-away last column has no edge in view)
  if (lr.right > edge + 1 || e.clientX < edge - 16 || e.clientX > br.right || e.clientY < br.top || e.clientY > br.bottom) return null;
  const line = { x: Math.min(edge + 6, br.right - (board.offsetWidth - board.clientWidth) - 5), y: lr.top, w: 3, h: columnLineHeight([last], lr.top, br) };
  const cat = T.locate(state, board.dataset.parent).node;
  return type === 'group'
    ? { action: 'column', categoryId: cat.id, column: n, line, newColumn: true }
    : { mode: 'newGroup', categoryId: cat.id, column: n, line, newColumn: true };
}

// An upright drop line runs as far down as the taller of the columns beside it reaches (its last group's
// bottom; an empty column counts as one new group's height), not down the whole board.
function columnLineHeight(cols, top, boardRect) {
  const bottom = Math.max(...cols.map((c) => {
    const last = [...c.querySelectorAll(':scope > .group')].at(-1);
    return last ? last.getBoundingClientRect().bottom : top + (parseFloat(getComputedStyle($('#board')).getPropertyValue('--empty-group-h')) || 66);
  }));
  return Math.max(40, Math.min(bottom, boardRect.bottom - 12) - top);
}

// A group dragged into the gap between two columns goes in between, as a column of its own: the columns
// on the side with an empty column shift one step towards it (the nearer side if both have one; the
// right if tied); with no empty column on either side a column is added (up to MAX_COLUMNS).
function columnGapTarget(e, d) {
  if (d.kind !== 'node' || d.type !== 'group') return null;
  const board = $('#board');
  if (!board.dataset.parent) return null;
  const cols = [...board.querySelectorAll('.columns > .col')];
  for (let i = 0; i < cols.length - 1; i++) {
    const a = cols[i].getBoundingClientRect(), b = cols[i + 1].getBoundingClientRect();
    if (e.clientX < a.right - 8 || e.clientX > b.left + 8 || e.clientY < a.top) continue;
    const plan = insertPlan(i + 1, d.ids || [d.id]);
    if (!plan) return null;
    const br = board.getBoundingClientRect();
    return { action: 'insertColumn', plan, line: { x: (a.right + b.left) / 2 - 1.5, y: a.top, w: 3, h: columnLineHeight([cols[i], cols[i + 1]], a.top, br) } };
  }
  return null;
}
// How to open a column at `k` (between columns k-1 and k) for `moving`: which columns shift which way.
function insertPlan(k, moving) {
  const cat = T.locate(state, $('#board').dataset.parent).node;
  const n = boardColumns();
  const lists = layoutColumns(cat, n).map((l) => l.filter((g) => !moving.includes(g.id))); // (the dragged ones leave)
  let right = -1, left = -1;
  for (let j = k; j < n; j++) if (!lists[j].length) { right = j; break; }
  for (let j = k - 1; j >= 0; j--) if (!lists[j].length) { left = j; break; }
  if (right >= 0 && (left < 0 || right - k <= k - 1 - left)) return { categoryId: cat.id, from: k, to: right - 1, by: 1, target: k, moving };
  if (left >= 0) return { categoryId: cat.id, from: left + 1, to: k - 1, by: -1, target: k - 1, moving };
  if (n < MAX_COLUMNS) return { categoryId: cat.id, from: k, to: Infinity, by: 1, target: k, add: true, moving };
  return null;
}
async function insertColumn({ categoryId, from, to, by, target, add, moving }) {
  if (add) await setColumns(boardColumns() + 1);
  const cat = T.locate(state, categoryId).node;
  const ops = [];
  cat.groups.forEach((g, i) => {
    if (moving.includes(g.id)) return;
    const c = columnOf(cat, g, i);
    if (c >= from && c <= to) ops.push({ op: 'patch', id: g.id, fields: { column: c + by } });
  });
  for (const id of moving) ops.push({ op: 'patch', id, fields: { column: target } });
  return apply(...ops);
}

const hLine = (r, before) => ({ x: r.left + 4, y: (before ? r.top : r.bottom) - 1, w: r.width - 8, h: 2 });
const vLine = (r, before, gap = 7) => ({ x: (before ? r.left - gap : r.right + gap) - 1, y: r.top, w: 3, h: r.height });

function resolveDrop(e, d) {
  const el = e.target instanceof Element ? e.target : e.target.parentElement;
  if (!el || el.closest('dialog, #menu')) return null;
  const extra = el.closest('#board') && (newColumnTarget(e, d) || columnGapTarget(e, d));
  if (extra) return extra;
  const type = d.kind === 'node' ? d.type : 'link'; // tabs / windows / external urls behave like links
  if (type === 'link') return resolveItemDrop(e, el, d);
  if (type === 'folder') { // a folder (with its subfolders) must stay within MAX_FOLDER_DEPTH
    const t = resolveItemDrop(e, el, d);
    const node = T.locate(state, d.id)?.node;
    return t && t.parentId && !T.fitsDepth(state, t.parentId, node) ? null : t;
  }
  if (type === 'group') return resolveGroupDrop(e, el, d);
  if (type === 'category') return resolveCatDrop(e, el, d);
  if (type === 'workspace') return resolveWsDrop(e, el, d);
  return null;
}

function insideDragged(el, d) {
  return d.kind === 'node' && (d.ids || [d.id]).some((id) => el.closest(`[data-id="${CSS.escape(id)}"]`));
}

function resolveItemDrop(e, el, d) {
  // saved links dragged back to the open tabs panel are opened in that window
  const win = el.closest('.win');
  if (win) return d.kind === 'node' ? { action: 'open', el: win, windowId: +win.dataset.window } : null;
  if (el.closest('#tabs-panel')) return null;

  const list = el.closest('.items');
  const item = el.closest('.item');
  if (item && !(list && item.contains(list))) {
    if (insideDragged(item, d)) return null;
    const parentId = item.parentElement.dataset.parent;
    const idx = [...item.parentElement.children].indexOf(item);
    if (item.dataset.type === 'folder') {
      const head = item.querySelector(':scope > .folder-head');
      const r = head.getBoundingClientRect();
      if (e.clientY < r.top + r.height * 0.3) return { parentId, index: idx, line: hLine(r, true) };
      if (item.classList.contains('collapsed') && e.clientY > r.bottom - r.height * 0.25)
        return { parentId, index: idx + 1, line: hLine(r, false) };
      return { parentId: item.dataset.id, index: null, el: head };
    }
    const r = item.getBoundingClientRect();
    const before = e.clientY < r.top + r.height / 2;
    return { parentId, index: before ? idx : idx + 1, line: hLine(r, before) };
  }
  if (list) {
    if (insideDragged(list, d)) return null;
    return { parentId: list.dataset.parent, index: null, el: list };
  }
  const card = el.closest('.group');
  if (card) return { parentId: card.dataset.id, index: null, el: card };
  const ct = el.closest('.cat-tab');
  if (ct) return { action: 'toCategory', categoryId: ct.dataset.id, el: ct };
  const board = el.closest('#board');
  if (board && board.dataset.parent) {
    const cat = T.locate(state, board.dataset.parent).node;
    const slot = el.closest('.gap-slot');
    if (slot) { // between two groups: a new group right there
      const [g, i] = groupAt(cat, slot.dataset.before);
      const r = slot.getBoundingClientRect();
      return { mode: 'newGroup', categoryId: cat.id, column: columnOf(cat, g, i), beforeId: g.id,
        line: { x: r.left + 4, y: r.top + r.height / 2 - 1, w: r.width - 8, h: 2 } };
    }
    const col = el.closest('.col') || board.querySelector('.col:last-child');
    return { mode: 'newGroup', categoryId: cat.id, ...columnEnd(cat, col), el: col.querySelector('.add-group') };
  }
  return null;
}

function resolveGroupDrop(e, el, d) {
  const board = $('#board');
  const col = board.dataset.parent && el.closest('#board .col');
  if (col) {
    const cat = T.locate(state, board.dataset.parent).node;
    const n = +board.dataset.cols;
    const column = storedColumn(cat, n, +col.dataset.col);
    const moving = new Set(d.ids || [d.id]);
    const cards = [...col.querySelectorAll(':scope > .group')].filter((c) => !moving.has(c.dataset.id));
    const card = el.closest('.group');
    if (card && moving.has(card.dataset.id)) return null;
    if (card) {
      // top / bottom edge: place before / after; the middle offers to merge (one group at a time)
      const r = card.getBoundingClientRect();
      const edge = d.ids ? r.height / 2 : Math.min(36, r.height * 0.25);
      if (e.clientY > r.top + edge && e.clientY < r.bottom - edge) return { action: 'merge', targetId: card.dataset.id, el: card };
      const before = e.clientY <= r.top + edge;
      // join the card's own column (differs from the visible one when narrow columns are stacked)
      const gi = cat.groups.findIndex((g) => g.id === card.dataset.id);
      return {
        action: 'column', categoryId: cat.id, column: columnOf(cat, cat.groups[gi], gi),
        beforeId: before ? card.dataset.id : null, afterId: before ? null : card.dataset.id, line: hLine(r, before),
      };
    }
    // between or below cards: the slot nearest the pointer (the gaps between cards count too)
    const next = cards.find((c) => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
    if (next) {
      const gi = cat.groups.findIndex((g) => g.id === next.dataset.id);
      return {
        action: 'column', categoryId: cat.id, column: columnOf(cat, cat.groups[gi], gi),
        beforeId: next.dataset.id, line: hLine(next.getBoundingClientRect(), true),
      };
    }
    const last = cards.at(-1);
    return {
      action: 'column', categoryId: cat.id, column: last ? columnOf(cat, ...groupAt(cat, last.dataset.id)) : column,
      afterId: last?.dataset.id || null,
      line: last ? hLine(last.getBoundingClientRect(), false) : hLine(col.getBoundingClientRect(), true),
    };
  }
  const ct = el.closest('.cat-tab');
  if (ct) return { parentId: ct.dataset.id, index: null, el: ct };
  const ws = el.closest('.ws-item');
  if (ws) return { action: 'toWorkspace', workspaceId: ws.dataset.id, el: ws };
  return null;
}

const groupAt = (cat, id) => { const i = cat.groups.findIndex((g) => g.id === id); return [cat.groups[i], i]; };

// The slot at the bottom of visible column `col`: right after its last group, in that group's own
// column (a narrowed board stacks several stored columns into the last visible one).
function columnEnd(cat, col) {
  const last = [...col.querySelectorAll(':scope > .group')].at(-1);
  if (!last) return { column: storedColumn(cat, +$('#board').dataset.cols, +col.dataset.col), afterId: null };
  return { column: columnOf(cat, ...groupAt(cat, last.dataset.id)), afterId: last.dataset.id };
}

// Moves groups `ids` (in that order, stacked) into `column` of their category: before `beforeId`,
// after `afterId`, or to the end of the column.
function moveToColumn(ids, t) {
  const cat = T.locate(state, t.categoryId).node;
  const order = cat.groups.map((g) => g.id); // simulated, to give each move op its index
  const ops = [];
  let prev = null;
  ids.forEach((id) => {
    let index;
    if (prev) index = order.indexOf(prev) + 1;
    else if (t.beforeId) index = order.indexOf(t.beforeId);
    else if (t.afterId) index = order.indexOf(t.afterId) + 1;
    else {
      const rest = cat.groups.filter((g, i) => !ids.includes(g.id) && columnOf(cat, g, i) === t.column);
      index = rest.length ? order.indexOf(rest.at(-1).id) + 1 : order.length;
    }
    ops.push({ op: 'move', id, parentId: cat.id, index }, { op: 'patch', id, fields: { column: t.column } });
    const from = order.indexOf(id); // mirror moveNode: the index counts positions before removal
    order.splice(from, 1);
    order.splice(index > from ? index - 1 : index, 0, id);
    prev = id;
  });
  return apply(...ops);
}

// Position in the category's group list for a slot in `column`: before `beforeId`, after `afterId`,
// or after the column's last group (ignoring `skip`, the group being moved).
function columnIndex(cat, column, { beforeId, afterId, skip } = {}) {
  const list = cat.groups;
  if (beforeId) return list.findIndex((g) => g.id === beforeId);
  if (afterId) return list.findIndex((g) => g.id === afterId) + 1;
  const inColumn = list.filter((g, i) => g.id !== skip && columnOf(cat, g, i) === column);
  return inColumn.length ? list.indexOf(inColumn.at(-1)) + 1 : list.length;
}

function resolveCatDrop(e, el, d) {
  const ct = el.closest('.cat-tab');
  if (ct) {
    if (ct.dataset.id === d.id) return null;
    const tabs = [...$('#cat-bar').querySelectorAll('.cat-tab')];
    const r = ct.getBoundingClientRect();
    const before = e.clientX < r.left + r.width / 2;
    const idx = tabs.indexOf(ct);
    return { parentId: currentWs().id, index: before ? idx : idx + 1, line: vLine(r, before, 1) };
  }
  const ws = el.closest('.ws-item');
  if (ws) return { parentId: ws.dataset.id, index: null, el: ws };
  return null;
}

function resolveWsDrop(e, el, d) {
  const ws = el.closest('.ws-item');
  if (!ws || ws.dataset.id === d.id) return null;
  const items = [...$('#ws-list').children];
  const r = ws.getBoundingClientRect();
  const before = e.clientY < r.top + r.height / 2;
  const idx = items.indexOf(ws);
  return { parentId: null, index: before ? idx : idx + 1, line: hLine(r, before) };
}

// Ops that turn a special drop target into a concrete parent; the parent is then referenced as "$0".
function targetOps(t, groupName) {
  if (t.action === 'toCategory') return [{ op: 'firstGroup', categoryId: t.categoryId }];
  if (t.action === 'toWorkspace') return [{ op: 'firstCategory', workspaceId: t.workspaceId }];
  if (t.mode === 'newGroup') {
    const cat = T.locate(state, t.categoryId).node;
    return [{ op: 'create', parentId: t.categoryId, index: columnIndex(cat, t.column, { beforeId: t.beforeId, afterId: t.afterId }),
      node: { type: 'group', name: groupName || suggestName('group'), column: t.column ?? null } }];
  }
  return [];
}

// (a move of saved things is remembered for undo; merging asks first and remembers itself)
async function performDrop(d, t, e) {
  const before = d.kind === 'node' && t.action !== 'open' && t.action !== 'merge' ? structuredClone(state) : null;
  const moved = before && (d.ids || [d.id]).map((id) => T.locate(state, id)?.node).filter(Boolean);
  const done = await dropInto(d, t, e);
  if (before && done && moved.length) remember(before, whatOf('move', moved));
}
async function dropInto(d, t, e) {
  if (t.action === 'open') {
    const urls = (d.ids || [d.id]).flatMap((id) => { const r = T.locate(state, id); return r ? T.collectLinks(r.node).map((l) => l.url) : []; });
    if (urls.length) await run(B.call('openUrls', { urls, windowId: t.windowId }));
    return;
  }
  if (t.newColumn) await setColumns(boardColumns() + 1); // the column first, so what lands in it shows there
  if (d.kind === 'node') markMoving(d.ids || [d.id]);
  if (t.action === 'merge') return mergeGroups(d.id, t.targetId);
  if (t.action === 'insertColumn') return insertColumn(t.plan);
  if (t.action === 'column') return moveToColumn(d.ids || [d.id], t);
  const pre = targetOps(t, d.kind === 'window' ? tr('name.window', { date: new Date().toLocaleString(getLang()) }) : null);
  const parentId = pre.length ? '$0' : t.parentId;

  if (d.kind === 'node') return apply(...pre, ...moveOps(d.ids || [d.id], parentId, pre.length ? null : t.index));
  if (d.kind === 'external') {
    const url = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '')
      .split(/\r?\n/).map((s) => s.trim()).find((s) => s && !s.startsWith('#'));
    if (!url || !/^[a-z][a-z0-9+.-]*:/i.test(url)) return;
    await apply(...pre, { op: 'create', parentId, index: t.index, node: { type: 'link', url, name: url } });
    return;
  }
  // open tabs or a whole window
  let tabIds = d.tabIds;
  if (d.kind === 'window') {
    const data = await run(B.call('getTabs'));
    tabIds = data?.windows.find((w) => w.id === d.windowId)?.tabs.filter((t) => !t.pinned).map((t) => t.id) || [];
  }
  if (!tabIds?.length) return;
  if (t.mode === 'newGroup') {
    // one update that creates the group with its tabs already inside, so it appears filled
    // (two updates would show an empty group first and then make it jump)
    const cat = T.locate(state, t.categoryId).node;
    const id = await run(B.call('saveTabs', { tabIds, close: settings.closeOnSave, newGroup: {
      categoryId: cat.id, column: t.column ?? null, index: columnIndex(cat, t.column, { beforeId: t.beforeId, afterId: t.afterId }),
      name: d.kind === 'window' ? tr('name.window', { date: new Date().toLocaleString(getLang()) }) : suggestName('group'),
    } }));
    // pin the column explicitly (a no-op normally; fixes the placement with an older extension)
    if (id && t.column != null) await apply({ op: 'patch', id, fields: { column: t.column } });
    return;
  }
  let pid = t.parentId;
  if (pre.length) [pid] = (await apply(...pre)) || [];
  if (pid) await saveTabsTo(tabIds, pid, t.index);
}

// Move ops that put `ids` side by side, in their order, at `index` of `parentId` (null: at the end).
// Each move's index counts positions before that move's own removal, so with several the place is
// worked out one move at a time: right before the first item at or after `index` that isn't moving.
function moveOps(ids, parentId, index) {
  if (ids.length < 2 || index == null || typeof parentId !== 'string' || parentId.startsWith('$')) {
    return ids.map((id) => ({ op: 'move', id, parentId, index }));
  }
  const parent = T.locate(state, parentId)?.node;
  const list = (parent?.items || []).map((n) => n.id);
  const moving = new Set(ids);
  const anchor = list.slice(index).find((id) => !moving.has(id)) ?? null;
  return ids.map((id) => {
    const at = anchor == null ? list.length : list.indexOf(anchor);
    const from = list.indexOf(id);
    if (from >= 0) list.splice(from, 1);
    list.splice(anchor == null ? list.length : list.indexOf(anchor), 0, id);
    return { op: 'move', id, parentId, index: at };
  });
}

// Moves every item (and the note) of group `fromId` to the end of group `intoId`, then deletes `fromId`.
async function mergeGroups(fromId, intoId) {
  const from = T.locate(state, fromId)?.node;
  const into = T.locate(state, intoId)?.node;
  if (!from || !into) return;
  const label = (g) => `${g.symbol && !T.isLogoSymbol(g.symbol) ? g.symbol + ' ' : ''}${g.name}`;
  const n = T.countLinks(from);
  if (!(await confirmDialog({
    title: t('merge.title', { from: label(from), into: label(into) }),
    text: t('merge.text', { n, from: label(from), into: label(into) }),
    ok: t('merge.ok'),
  }))) return;
  const note = [into.note, from.note].filter((n) => n && n.trim()).join('\n\n---\n\n');
  const snapshot = structuredClone(state);
  await animateOut([fromId]);
  const ok = await apply(
    { op: 'patch', id: intoId, fields: { items: [...into.items, ...from.items], note, collapsed: false } },
    { op: 'remove', id: fromId });
  if (ok) {
    const entry = await remember(snapshot, { verb: 'merge' });
    toast(t('toast.merged', { name: into.name }), t('common.undo'), () => undo(entry, true));
  }
}

function endDrag() {
  document.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
  clearIndicator();
  drag = null;
  if (pendingRender) render();
  if (pendingTabsRender) renderTabs();
}

document.addEventListener('dragstart', (e) => {
  const src = e.target instanceof Element && e.target.closest('[draggable="true"]');
  if (!src) return;
  hideMenu();
  const dt = e.dataTransfer;
  dt.effectAllowed = 'copyMove';
  if (src.matches('.tab-row')) {
    // dragging one of several selected tabs takes them all, in list order
    const id = +src.dataset.tab;
    const ids = pickedTabs.has(id) && pickedTabs.size > 1
      ? [...document.querySelectorAll('#windows .tab-row.picked')].map((r) => +r.dataset.tab) : [id];
    drag = { kind: 'tab', tabIds: ids };
    dt.setData('text/plain', src.dataset.url || '');
  } else if (src.matches('.win-head')) {
    drag = { kind: 'window', windowId: +src.closest('.win').dataset.window };
    dt.setData('text/plain', 'tabcat-window');
  } else {
    const el = src.closest('[data-id]');
    if (!el) return;
    drag = { kind: 'node', id: el.dataset.id, type: el.dataset.type };
    // dragging one of several picked links / folders takes them all, in board order (an item inside a
    // picked folder goes with the folder)
    if (el.matches('.item') && pickedItems.has(drag.id) && pickedItems.size > 1) {
      const picked = [...document.querySelectorAll('#board .item.picked')];
      drag.ids = picked.filter((it) => !picked.some((o) => o !== it && o.contains(it))).map((it) => it.dataset.id);
      setTimeout(() => picked.forEach((it) => it.classList.add('dragging')), 0);
    }
    // dragging one of several selected groups moves them all, in their current order
    if (drag.type === 'group' && selected.has(drag.id) && selected.size > 1) {
      const cat = T.locate(state, drag.id).parent;
      drag.ids = cat.groups.filter((g) => selected.has(g.id)).map((g) => g.id);
      setTimeout(() => drag?.ids?.forEach((id) => $(`#board .group[data-id="${CSS.escape(id)}"]`)?.classList.add('dragging')), 0);
    }
    const r = T.locate(state, drag.id);
    if (r?.node.type === 'link') {
      dt.setData('text/uri-list', r.node.url);
      dt.setData('text/plain', r.node.url);
    } else dt.setData('text/plain', r?.node.name || '');
    setTimeout(() => el.classList.add('dragging'), 0);
  }
});

function dragFor(e) {
  if (drag) return drag;
  return e.dataTransfer.types.includes('text/uri-list') ? { kind: 'external' } : null;
}

document.addEventListener('dragover', (e) => {
  const d = dragFor(e);
  if (!d) return;
  const t = resolveDrop(e, d);
  showIndicator(t);
  if (t) {
    e.preventDefault();
    e.dataTransfer.dropEffect = d.kind === 'node' && t.action !== 'open' ? 'move' : 'copy';
  }
});

document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) clearIndicator(); });

document.addEventListener('drop', (e) => {
  const d = dragFor(e);
  if (!d) return;
  const t = resolveDrop(e, d);
  e.preventDefault();
  // dropped on the New group card: it becomes the new group, so it vanishes at once (no fade, no
  // slide) but keeps its size until the board re-renders, letting the group grow out of it
  if (t?.mode === 'newGroup' && t.el) t.el.classList.replace('drop-new', 'dropped');
  endDrag();
  if (t) performDrop(d, t, e).catch((err) => toast(tr('toast.dropFailed', { error: err.message })));
});

document.addEventListener('dragend', endDrag);
// During a drag the browser stops following the mouse, so until it moves again it takes the pointer to be
// where the drag began: a New group card that slides in there (its column's group was dragged away)
// would show as if hovered. Until the next move, the drop point counts instead (see restoreHover), and
// the browser's own hover shows no New group card (see .after-drag).
for (const type of ['drop', 'dragend']) {
  document.addEventListener(type, (e) => {
    if (e.clientX || e.clientY) pointer = [e.clientX, e.clientY];
    document.body.classList.add('after-drag');
  }, true);
}

/* ================= settings, import/export ================= */

// Light dismiss: a click that starts and ends outside a modal dialog's box closes it.
for (const dlg of document.querySelectorAll('dialog')) {
  const outside = (e) => {
    const r = dlg.getBoundingClientRect();
    return e.target === dlg && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
  };
  let downOutside = false;
  dlg.addEventListener('pointerdown', (e) => { downOutside = outside(e); });
  dlg.addEventListener('click', (e) => {
    if (downOutside && outside(e)) dlg.close();
    downOutside = false;
  });

  // Closing animates too: every close (code, Esc, a dialog-form submit) shrinks and fades the
  // dialog and its backdrop first, then really closes it.
  const nativeClose = dlg.close.bind(dlg);
  const nativeShow = dlg.showModal.bind(dlg);
  let closing = 0; // id of the close in progress (0: none); reopening cancels it
  dlg.showModal = () => {
    if (closing) { closing = 0; delete dlg.dataset.closing; dlg.getAnimations().forEach((a) => a.cancel()); }
    if (!dlg.open) nativeShow();
  };
  dlg.close = (value) => {
    if (!dlg.open || closing) return;
    const id = (closing = Date.now());
    dlg.dataset.closing = '';
    const opts = { duration: 120, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' };
    const anims = [
      dlg.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.95)' }], opts),
      dlg.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, pseudoElement: '::backdrop' }),
    ];
    Promise.all(anims.map((a) => a.finished)).then(() => {
      if (closing !== id) return; // reopened meanwhile
      closing = 0;
      delete dlg.dataset.closing;
      nativeClose(value);
      anims.forEach((a) => a.cancel());
    }, () => {});
  };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); dlg.close(); }); // Esc
  // a <form method="dialog"> submit that nobody handled (Done / Close buttons)
  dlg.addEventListener('submit', (e) => {
    if (!e.defaultPrevented && e.target.method === 'dialog') { e.preventDefault(); dlg.close(); }
  });
}

// pages can't open chrome:// addresses themselves; the extension can
// (delegated: the link is rebuilt whenever the language changes)
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('#shortcuts-link');
  if (!a) return;
  e.preventDefault();
  run(B.call('openUrls', { urls: [a.href], active: true }));
});

$('#swatches').append(...Object.entries(ACCENTS).map(([name, hue]) =>
  h('label', { class: 'swatch', dataset: { accent: name, i18nAttr: `title:accent.${name}` }, style: hue != null ? `--hue: ${hue}` : null },
    h('input', { type: 'radio', name: 'accent', value: name, dataset: { i18nAttr: `aria-label:accent.${name}` } }))));

// each language is listed in its own name; the first entry follows the browser
$('#language').append(h('option', { value: 'auto', dataset: { i18n: 'settings.langAuto' } }),
  ...Object.entries(LANGS).map(([code, name]) => h('option', { value: code, lang: code }, name)));

// Number fields: − / + beside the value instead of the browser's spinners. A step slides the new
// value in from the side it moved to; held down, a button repeats and saves once on release.
// (The buttons stay out of the tab order: the field itself steps with the arrow keys.)
function syncSteppers() {
  for (const input of document.querySelectorAll('.stepper input')) {
    const [down, up] = input.parentElement.querySelectorAll('.step-btn');
    const v = +input.value;
    down.disabled = input.min !== '' && v <= +input.min;
    up.disabled = input.max !== '' && v >= +input.max;
    if (input.dataset.zero) input.parentElement.classList.toggle('zero', input.value !== '' && v === 0);
  }
}
for (const input of document.querySelectorAll('#settings-form input[type=number]')) {
  const wrap = h('div', { class: 'stepper', onwheel: (e) => wheelStep(e), onpointermove: wheelHint, onpointerleave: hideWheelHint });
  input.replaceWith(wrap);
  const zero = input.dataset.zero ? h('span', { class: 'step-zero', 'data-i18n': input.dataset.zero }, t(input.dataset.zero)) : null;
  const step = (dir) => {
    const before = input.value;
    if (dir > 0) input.stepUp(); else input.stepDown();
    if (input.value === before) return false;
    syncSteppers();
    // the new value slides in: the number, or "Off" in its place (the old one goes at once, no overlap)
    const shown = zero && wrap.classList.contains('zero') ? zero : input;
    shown.animate([{ transform: `translateY(${dir * -7}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: SPRING });
    return true;
  };
  const save = () => input.dispatchEvent(new Event('change', { bubbles: true }));
  // scrolling over the field steps it (up: more), with the wheel badge as on the board's column control;
  // a trackpad's small deltas add up to a step, and a burst of steps saves once it settles
  let acc = 0, saveTimer = null;
  const wheelStep = (e) => {
    e.preventDefault();
    wheelHint(e);
    acc += e.deltaY;
    if (Math.abs(acc) < 40) return;
    const dir = acc < 0 ? 1 : -1;
    acc = 0;
    nudgeWheelHint(-dir);
    if (!step(dir)) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  };
  const button = (dir) => {
    const b = h('button', { type: 'button', class: 'step-btn', tabindex: '-1', 'aria-hidden': 'true' }, icon(dir > 0 ? 'plus' : 'minus', 14));
    let timer = null, held = false;
    const stop = () => { clearTimeout(timer); timer = null; if (held) save(); held = false; };
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || b.disabled) return;
      e.preventDefault(); // keep the focus where it is
      if (!step(dir)) return;
      held = true;
      const repeat = (delay) => { timer = setTimeout(() => { if (step(dir)) repeat(Math.max(40, delay * .75)); else stop(); }, delay); };
      repeat(350);
    });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(type, stop);
    return b;
  };
  wrap.append(...[input, zero, button(-1), button(1)].filter(Boolean));
  input.addEventListener('input', syncSteppers);
}

function fillSettings() {
  const f = $('#settings-form');
  f.closeOnSave.checked = settings.closeOnSave;
  f.groupTabs.checked = settings.groupTabs !== false;
  f.checkUpdates.checked = settings.checkUpdates !== false;
  f.checkUpdates.closest('label').hidden = extUpdatesItself; // (from the store: the browser updates it)
  f.autoSuspendMinutes.value = settings.autoSuspendMinutes;
  f.language.value = Object.hasOwn(LANGS, settings.language) ? settings.language : 'auto';
  f.theme.value = settings.theme;
  f.accent.value = Object.hasOwn(ACCENTS, settings.accent) ? settings.accent : 'purple';
  f.columns.value = boardColumns();
  syncSteppers();
}

function openSettings() {
  fillSettings();
  $('#settings').showModal();
}

$('#settings-form').addEventListener('change', async (e) => {
  if (e.target.type === 'file') return; // the import pickers (their own handlers save what they read)
  const f = e.currentTarget;
  const s = await run(B.call('saveSettings', {
    closeOnSave: f.closeOnSave.checked,
    groupTabs: f.groupTabs.checked,
    checkUpdates: f.checkUpdates.checked,
    autoSuspendMinutes: Math.max(0, parseInt(f.autoSuspendMinutes.value, 10) || 0),
    language: f.language.value,
    theme: f.theme.value,
    accent: f.accent.value,
    columns: Math.min(MAX_COLUMNS, Math.max(1, parseInt(f.columns.value, 10) || 3)),
  }));
  if (s) { switchTheme(s); relayoutBoard(); switchLang(s.language); checkUpdates(s); }
});

// Apply new settings; a changed theme or accent cross-fades the whole page from the old look.
let lookShown = ''; // `${theme}|${accent}` last applied or on its way (a transition applies it a frame later)
function switchTheme(s) {
  const look = `${s.theme}|${s.accent}`;
  const changed = look !== (lookShown || `${settings.theme}|${settings.accent}`);
  lookShown = look;
  const swap = () => { settings = s; applyTheme(); };
  // (a transition cut short by the next one rejects `ready`: nothing to handle, the new one takes over)
  if (changed && document.startViewTransition) document.startViewTransition(swap).ready.catch(() => {});
  else swap();
}

// Show the page in the language `setting` asks for ('auto' or a code), cross-fading from the old text
// when it changes. The setting is also kept on this device, so the next visit starts in it.
let langShown = 'en';
let langWanted = null; // the setting last asked for (our own save and its push both ask)
async function switchLang(setting = 'auto', fade = true) {
  if (setting === langWanted) return;
  langWanted = setting;
  try { localStorage.setItem('tabcat:lang', setting); } catch { /* storage unavailable */ }
  const code = await setLang(setting);
  if (code === langShown) return;
  langShown = code;
  const swap = async () => {
    applyText();
    if (!state) return;
    renderSidebar(); renderHead(); renderCats(); renderBoard();
    await renderTabs();
  };
  if (!fade || !document.startViewTransition) return swap();
  // An open Settings dialog moves with a spring instead: its boxes (the dialog, each fieldset) are
  // pictured empty and stretch to their new size, and everything in them moves the same way at its own
  // size, so nothing shifts against the box it sits in; only the text itself cross-fades.
  const dlg = $('#settings');
  const frames = dlg.open ? [dlg, ...dlg.querySelectorAll('#settings-form > fieldset')] : [];
  const parts = frames.flatMap((f) => [...(f === dlg ? $('#settings-form') : f).children].filter((el) => el.tagName !== 'FIELDSET'));
  const named = [...frames.map((el) => [el, 'settings-frame']), ...parts.map((el) => [el, 'settings-part'])];
  named.forEach(([el, cls], i) => { el.style.viewTransitionName = `settings-${i}`; el.style.viewTransitionClass = cls; });
  const vt = document.startViewTransition(swap);
  vt.ready.catch(() => {}); // (cut short by the next one: nothing to handle)
  vt.finished.finally(() => named.forEach(([el]) => {
    el.style.viewTransitionName = '';
    el.style.viewTransitionClass = '';
  }));
}

// Everything built once from strings: the page's own text, panel tooltips, the action row's fit.
function applyText() {
  document.documentElement.lang = getLang();
  translateDom();
  applyPanels();
  fitActions();
  if ($('#settings').open) fillSettings();
}

/* ---------- export / import ---------- */

const CHILD_KEY = { workspace: 'categories', category: 'groups' };

// Checkbox tree of workspaces → categories → groups. Resolves with pruned copies of the checked
// workspaces (ancestors of a checked node are kept with only their checked children), or null.
function pickNodes({ title, ok, workspaces, initial = () => true }) {
  const dlg = $('#picker');
  const okBtn = $('#picker-ok');
  $('#picker-title').textContent = title;
  okBtn.textContent = ok;
  const roots = [];
  const leaves = [];

  const setDown = (e, v) => { e.box.checked = v; e.box.indeterminate = false; e.kids.forEach((k) => setDown(k, v)); };
  const refreshUp = (e) => {
    for (let p = e.parent; p; p = p.parent) {
      const all = p.kids.every((k) => k.box.checked);
      p.box.checked = all;
      p.box.indeterminate = !all && p.kids.some((k) => k.box.checked || k.box.indeterminate);
    }
  };
  const refreshCount = () => {
    const n = leaves.filter((e) => e.box.checked).length;
    $('#picker-count').textContent = t('picker.count', { n, total: leaves.length });
    okBtn.disabled = !n;
  };

  const build = (node, parent) => {
    const kids = CHILD_KEY[node.type] ? node[CHILD_KEY[node.type]] || [] : [];
    const box = h('input', { type: 'checkbox' });
    const entry = { box, node, parent, kids: [] };
    if (parent) parent.kids.push(entry); else roots.push(entry);
    const li = h('li', { class: node.type === 'workspace' ? '' : 'closed' });
    box.addEventListener('change', () => { setDown(entry, box.checked); refreshUp(entry); refreshCount(); });
    li.append(h('div', { class: 'pick-row' },
      kids.length ? Object.assign(btn('▾', t('picker.toggle'), () => li.classList.toggle('closed')), { className: 'icon-btn twisty' })
        : h('span', { class: 'twisty-gap' }),
      h('label', {}, box,
        symbolEl(node.symbol, node.type === 'category' ? '🏷️' : node.type === 'workspace' ? '🗃️' : '🗂️'),
        h('span', { class: 'name' }, node.name || t('name.untitled')),
        h('span', { class: 'count' }, T.countLinks(node)))));
    if (kids.length) li.append(h('ul', {}, kids.map((k) => build(k, entry))));
    else leaves.push(entry);
    return li;
  };
  $('#picker-tree').replaceChildren(...workspaces.map((ws) => build(ws, null)));
  for (const e of roots) setDown(e, !!initial(e.node));
  refreshCount();

  const pick = (e) => {
    if (!e.kids.length) return e.box.checked ? e.node : null;
    const kids = e.kids.map(pick).filter(Boolean);
    return kids.length ? { ...e.node, [CHILD_KEY[e.node.type]]: kids } : null;
  };

  return new Promise((resolve) => {
    const all = (v) => () => { roots.forEach((e) => setDown(e, v)); refreshCount(); };
    const onAll = all(true);
    const onNone = all(false);
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      $('#picker-form').removeEventListener('submit', onSubmit);
      $('#picker-cancel').removeEventListener('click', onCancel);
      $('#picker-all').removeEventListener('click', onAll);
      $('#picker-none').removeEventListener('click', onNone);
      dlg.removeEventListener('close', onCancel);
      if (dlg.open) dlg.close();
      resolve(v);
    };
    const onCancel = () => finish(null);
    const onSubmit = (e) => { e.preventDefault(); finish(roots.map(pick).filter(Boolean)); };
    $('#picker-form').addEventListener('submit', onSubmit);
    $('#picker-cancel').addEventListener('click', onCancel);
    $('#picker-all').addEventListener('click', onAll);
    $('#picker-none').addEventListener('click', onNone);
    dlg.addEventListener('close', onCancel);
    dlg.showModal();
  });
}

const today = () => new Date().toISOString().slice(0, 10);
const slug = (s) => String(s).trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

function download(name, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function exportData(onlyId) {
  const data = await run(B.call('getState'));
  if (!data) return;
  const workspaces = await pickNodes({
    title: t('export.title'), ok: t('export.ok'), workspaces: data.workspaces,
    initial: (ws) => !onlyId || ws.id === onlyId,
  });
  if (!workspaces) return;
  const name = workspaces.length === 1 && slug(workspaces[0].name) ? `tabcat-${slug(workspaces[0].name)}-${today()}.json` : `tabcat-${today()}.json`;
  download(name, { app: 'tabcat', kind: 'data', exportedAt: new Date().toISOString(), version: data.version, workspaces });
}

async function readJson(file) {
  try { return JSON.parse(await file.text()); } catch { throw new Error(t('err.notJson')); }
}

$('#btn-export').addEventListener('click', () => exportData());

$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const raw = await readJson(file);
    if (raw.kind === 'settings') throw new Error('this is a settings file; use Import settings');
    const list = (raw.workspaces || []).filter((w) => w && w.type === 'workspace');
    if (!list.length) throw new Error(t('err.noWorkspaces'));
    const picked = await pickNodes({ title: t('import.title', { file: file.name }), ok: t('import.ok'), workspaces: list });
    if (!picked) return;
    // (Settings closes first, so the new workspaces are seen arriving in the sidebar; one Undo takes them away)
    $('#settings').close();
    const before = structuredClone(state);
    const ids = await apply(...picked.map((node) => ({ op: 'create', parentId: null, node })));
    if (!ids?.length) return;
    const entry = await remember(before, { verb: 'import', n: ids.length });
    select(ids[0]);
    toast(t('toast.imported', { n: ids.length }), t('common.undo'), () => undo(entry, true));
  } catch (err) {
    toast(t('toast.importFailed', { error: err.message }));
  }
});

// Portable settings: per-machine values (dashboard address, last used group) stay out of the file.
const SETTINGS_IO = {
  language: (v) => v === 'auto' || Object.hasOwn(LANGS, v),
  closeOnSave: (v) => typeof v === 'boolean',
  groupTabs: (v) => typeof v === 'boolean',
  checkUpdates: (v) => typeof v === 'boolean',
  autoSuspendMinutes: (v) => Number.isInteger(v) && v >= 0,
  theme: (v) => ['auto', 'light', 'dark'].includes(v),
  accent: (v) => Object.hasOwn(ACCENTS, v),
  columns: (v) => Number.isInteger(v) && v >= 1 && v <= MAX_COLUMNS,
};

// Settings > Data > Reset settings: every option above back to its default (after asking; the data is
// not touched)
const SETTINGS_DEFAULTS = { language: 'auto', closeOnSave: true, groupTabs: true, checkUpdates: true, autoSuspendMinutes: 0, theme: 'auto', accent: 'purple', columns: 5 };
$('#btn-reset-settings').addEventListener('click', async () => {
  if (!(await confirmDialog({ title: t('reset.title'), text: t('reset.text'), ok: t('reset.ok'), danger: true }))) return;
  const s = await run(B.call('saveSettings', SETTINGS_DEFAULTS));
  if (!s) return;
  switchTheme(s);
  relayoutBoard();
  switchLang(s.language);
  fillSettings();
  checkUpdates(s);
  resetView();
  toast(t('toast.settingsReset'));
});

// ...and how this device shows the page, each part moving back as it does when changed by hand: the
// side panels open at their default widths, the windows in Open tabs unfolded, Install app offered again
function resetView() {
  for (const p of Object.values(PANELS)) ui[p.width] = null;
  saveUi();
  applyPanels(); // (an open panel eases to its default width)
  for (const p of Object.values(PANELS)) if (ui[p.collapsed]) $(p.toggle).click();
  for (const id of ui.winCollapsed || []) toggleWin(id);
  store.set(INSTALL_HIDDEN, null);
  showInstall();
}

$('#btn-export-settings').addEventListener('click', () => {
  const out = Object.fromEntries(Object.keys(SETTINGS_IO).map((k) => [k, settings[k]]));
  download(`tabcat-settings-${today()}.json`, { app: 'tabcat', kind: 'settings', exportedAt: new Date().toISOString(), settings: out });
});

$('#import-settings-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const raw = await readJson(file);
    if (raw.kind !== 'settings' || !raw.settings) throw new Error(t('err.notSettings'));
    const patch = Object.fromEntries(Object.entries(SETTINGS_IO)
      .filter(([k, ok]) => ok(raw.settings[k])).map(([k]) => [k, raw.settings[k]]));
    if (!Object.keys(patch).length) throw new Error(t('err.noSettings'));
    const s = await B.call('saveSettings', patch);
    switchTheme(s);
    relayoutBoard();
    switchLang(s.language);
    fillSettings();
    checkUpdates(s);
    toast(t('toast.settingsImported'));
  } catch (err) {
    toast(t('toast.importFailed', { error: err.message }));
  }
});

/* ================= wiring ================= */

$('#add-ws').addEventListener('click', addWorkspace);
$('#btn-settings').addEventListener('click', openSettings);
// The guide opens at its top (showModal would focus, and scroll to, the Close button).
function openGuide() {
  const dlg = $('#help');
  dlg.showModal();
  dlg.scrollTop = 0;
  dlg.querySelector('button').blur();
}
$('#btn-help').addEventListener('click', openGuide);

// About: versions and where tabcat lives.
$('#btn-info').addEventListener('click', () => {
  $('#info-ext').textContent = extVersion || t('info.notConnected');
  $('#info-min').textContent = MIN_EXTENSION;
  // (the dashboard has no version: everyone has the latest; when it was last published is what tells)
  const published = new Date(document.lastModified);
  $('#info-dash').textContent = t('info.dashboardDate', { date: new Intl.DateTimeFormat(getLang(), { dateStyle: 'long' }).format(published) });
  $('#info-status').textContent = '';
  showUpdate();
  const dlg = $('#info');
  dlg.showModal();
  dlg.querySelector('button').blur();
});

// Updates: installed from a GitHub release, the extension doesn't update itself, so (unless turned off in
// Settings) the dashboard looks up the latest release, at most twice a day, and when it's newer than the
// connected extension says so: a dot on About, and in About a link to the release. Installed from the
// Chrome Web Store, the browser updates it: none of this.
const LATEST_RELEASE = 'https://api.github.com/repos/nda111/tabcat/releases/latest';
const LATEST = 'tabcat:latest'; // { version, url, checkedAt } of the last look
const CHECK_EVERY = 12 * 60 * 60 * 1000;
let latest = null;
let checkedByHand = false; // About's "Check for updates" pressed: its answer shows even with the setting off
try { latest = JSON.parse(localStorage.getItem(LATEST)); } catch { /* storage unavailable or unreadable */ }
// (true when it has an answer: a fresh one, or one looked up a while ago)
async function checkUpdates(s = settings, now = false) {
  if (extUpdatesItself || (s.checkUpdates === false && !now)) return showUpdate();
  if (now || !latest || !(Date.now() - latest.checkedAt < CHECK_EVERY)) {
    try {
      const r = await fetch(LATEST_RELEASE, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const rel = await r.json();
      latest = { version: String(rel.tag_name).replace(/^v/, ''), url: rel.html_url, checkedAt: Date.now() };
      try { localStorage.setItem(LATEST, JSON.stringify(latest)); } catch { /* storage unavailable */ }
    } catch { /* offline, or GitHub said no: ask again next time */
      showUpdate();
      return false;
    }
  }
  showUpdate();
  return true;
}
// About's "Check for updates": a spinner beside it while it asks, then the answer in its place (in the
// same row: About keeps its height). Pressed again within a minute, the answer it just had does.
const ASK_AGAIN = 60 * 1000;
$('#info-check').addEventListener('click', async (e) => {
  const button = e.currentTarget, spinner = $('#info-checking'), status = $('#info-status');
  button.disabled = true;
  spinner.hidden = false;
  checkedByHand = true;
  const fresh = latest && Date.now() - latest.checkedAt < ASK_AGAIN;
  const [ok] = await Promise.all([fresh || checkUpdates(settings, true), new Promise((r) => setTimeout(r, 500))]);
  button.disabled = false;
  spinner.hidden = true;
  if (!newerRelease()) {
    status.textContent = t(ok ? 'info.upToDate' : 'info.checkFailed');
    if (!ok) setTimeout(() => { status.textContent = ''; showUpdate(); }, 3000);
  }
  showUpdate();
  const shown = newerRelease() ? $('#info-update') : status;
  shown.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
});
function newerRelease() {
  return !extUpdatesItself && (settings.checkUpdates !== false || checkedByHand) && latest?.version && extVersion && olderThan(extVersion, latest.version) ? latest : null;
}
function showUpdate() {
  const rel = newerRelease();
  const dot = $('#btn-info .update-dot');
  const appearing = dot.hidden && !!rel;
  dot.hidden = $('#info-update').hidden = !rel;
  $('#info-check').hidden = !!rel || !extVersion || extUpdatesItself || !!$('#info-status').textContent;
  if (rel) $('#info-status').textContent = '';
  if (!rel) return;
  dot.setAttribute('aria-label', t('info.updateBadge'));
  $('#info-update-text').textContent = t('info.update', { version: `v${rel.version}` });
  $('#info-update-get').href = rel.url;
  if (appearing) dot.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.3)', offset: .6 }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' });
}

/* ---------- side panels: collapse and resize ---------- */

// Tooltips: every [title] outside dialogs shows in one styled tooltip (the native title is parked in
// data-tip while it is up). First line is the label, further lines are details. Rows of the side panels
// (and anything in a collapsed rail) show beside the panel; everything else shows below the element.
const tip = $('#tip');
const RAILS = 'body.ws-collapsed #sidebar, body.tabs-collapsed #tabs-panel';
const BESIDE = '.ws-item, .tab-row, .win-head';
const TIP_DELAY = 180;
let tipEl = null;
let tipTimer = null;
let tipHiddenAt = 0;

function hideTip() {
  clearTimeout(tipTimer);
  if (tipEl?.dataset.trunc) { delete tipEl.dataset.trunc; delete tipEl.dataset.tip; } // a borrowed full-name tip
  else if (tipEl?.dataset.tip != null) { tipEl.title = tipEl.dataset.tip; delete tipEl.dataset.tip; }
  if (!tip.hidden) {
    tipHiddenAt = Date.now();
    // a copy fades out quickly where it was, so the tip itself is free for the next one at once
    const ghost = tip.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.className = 'tip tip-out';
    tip.after(ghost);
    ghost.showPopover?.(); // (over an open dialog too, like the tip)
    ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: 'ease-in', fill: 'forwards' })
      .finished.catch(() => {}).then(() => ghost.remove());
  }
  tipEl = null;
  tip.hidden = true;
  if (tip.matches(':popover-open')) tip.hidePopover();
}

function showTip(el) {
  clearTimeout(tipTimer);
  tipEl = el;
  if (el.title) { el.dataset.tip = el.title; el.removeAttribute('title'); }
  const [head, ...rest] = el.dataset.tip.split('\n').filter((l) => l.trim());
  // tab rows: reuse the row's favicon with the same fallbacks, on a light chip so dark icons stay visible
  const rowImg = el.matches('.tab-row') && el.querySelector(':scope > img');
  const fav = rowImg ? iconImg(el.dataset.url, rowImg.currentSrc || rowImg.src) : null;
  fav?.removeAttribute('loading');
  tip.replaceChildren(
    h('div', { class: 'tip-head' }, fav && h('span', { class: 'tip-icon' }, fav), h('span', {}, head)),
    ...rest.map((line) => h('div', { class: 'tip-sub' }, line)));
  tip.hidden = false;
  // a popover, so it shows above an open (top-layer) dialog too: shown again each time to come out on top
  if (tip.matches(':popover-open')) tip.hidePopover();
  tip.showPopover();
  const r = el.getBoundingClientRect();
  const side = el.closest(RAILS) || (el.matches(BESIDE) && el.closest('.side-panel'));
  let left, top;
  if (side) {
    left = side.getBoundingClientRect().right + 6;
    top = r.top + r.height / 2 - tip.offsetHeight / 2;
  } else {
    left = r.left + r.width / 2 - tip.offsetWidth / 2;
    top = r.bottom + tip.offsetHeight + 10 > innerHeight ? r.top - tip.offsetHeight - 6 : r.bottom + 6;
  }
  Object.assign(tip.style, {
    left: Math.max(4, Math.min(innerWidth - tip.offsetWidth - 4, left)) + 'px',
    top: Math.max(4, Math.min(innerHeight - tip.offsetHeight - 4, top)) + 'px',
  });
}

// Names without a tooltip of their own get one with the full name, but only while truncated.
const TRUNC_NAMES = '.node-line .name';

document.addEventListener('mouseover', (e) => {
  const nm = e.target instanceof Element && e.target.closest(TRUNC_NAMES);
  if (nm && nm !== tipEl && !nm.title && nm.scrollWidth > nm.clientWidth) {
    nm.title = nm.textContent;
    nm.dataset.trunc = '1';
  }
  const el = e.target instanceof Element ? e.target.closest('[title], [data-tip], [data-no-tip]') : null;
  if (el === tipEl) return;
  hideTip();
  if (el?.matches('[data-no-tip]')) return;
  if (!el || drag || el.closest('#menu')) return;
  tipEl = el;
  el.dataset.tip = el.title; // park now so the native tooltip never appears
  el.removeAttribute('title');
  // after one tooltip, moving to the next shows it right away
  if (Date.now() - tipHiddenAt < 400) showTip(el);
  else tipTimer = setTimeout(() => { if (tipEl === el && el.isConnected) showTip(el); }, TIP_DELAY);
});
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) hideTip(); });
for (const type of ['dragstart', 'mousedown', 'wheel']) document.addEventListener(type, hideTip, { passive: true });

const PANELS = {
  ws: { el: '#sidebar', toggle: '#ws-toggle', width: 'wsWidth', collapsed: 'wsCollapsed', min: 160, max: 420, tips: ['panel.expandWs', 'panel.collapseWs'] },
  tabs: { el: '#tabs-panel', toggle: '#tabs-toggle', width: 'tabsWidth', collapsed: 'tabsCollapsed', min: 200, max: 520, tips: ['panel.expandTabs', 'panel.collapseTabs'] },
};

function applyPanels() {
  for (const [key, p] of Object.entries(PANELS)) {
    const collapsed = !!ui[p.collapsed];
    document.body.classList.toggle(`${key}-collapsed`, collapsed);
    document.body.style.setProperty(`--${key}-w`, ui[p.width] ? ui[p.width] + 'px' : null);
    $(p.toggle).title = t(p.tips[collapsed ? 0 : 1]);
  }
  $('#sidebar .brand-logo').title = ui.wsCollapsed ? '' : t(PANELS.ws.tips[1]); // (collapsed: the expand button covers it)
  applyRailTitles();
}

// Controls labelled in the expanded sidebar get their tooltip (data-rail-title) only when collapsed.
function applyRailTitles() {
  const collapsed = document.body.classList.contains('ws-collapsed');
  for (const el of document.querySelectorAll('#sidebar [data-rail-title]')) {
    if (collapsed) el.title = el.dataset.railTitle;
    else el.removeAttribute('title');
  }
}

const PANEL_FLIP = '.brand-logo, #ws-toggle, .ws-item, .side-btn, #tabs-toggle, .panel-actions .btn, .win-head, .tab-row';
const panelAnimTimer = {};

// The logo collapses the workspaces panel like its button does (collapsed, the expand button sits on it).
$('#sidebar .brand-logo').addEventListener('click', () => { if (!ui.wsCollapsed) $('#ws-toggle').click(); });

for (const p of Object.values(PANELS)) {
  $(p.toggle).addEventListener('click', () => {
    const panel = $(p.el);
    const collapsing = !ui[p.collapsed];
    hideTip();
    if (collapsing) {
      // fade the labels out while the panel starts to narrow, then switch to the rail layout
      panel.classList.add('fading');
      panel.style.width = '56px';
      // switch while the faded, one-line state is still in place (measuring after removing it would
      // catch a re-wrapped header and make the rows jump), then drop it
      // (briefly: the rail rearranges while the panel is still narrowing, not after it has closed)
      setTimeout(() => { switchPanel(p); panel.classList.remove('fading'); panel.style.width = ''; }, 60);
    } else switchPanel(p);
  });
}

// Switch a side panel between full and rail layout, FLIPping its icons and rows from where they
// were to where the new layout puts them, so the change reads as one continuous movement.
function switchPanel(p) {
  const els = [...$(p.el).querySelectorAll(PANEL_FLIP)];
  const before = new Map(els.map((el) => [el, el.getBoundingClientRect()]));
  const panel = $(p.el);
  panel.classList.add('panel-anim'); // only this panel: the other one must not replay its fade-ins
  clearTimeout(panelAnimTimer[p.el]);
  panelAnimTimer[p.el] = setTimeout(() => { panel.classList.remove('panel-anim'); if (p === PANELS.tabs) fitActions(); }, 450);
  ui[p.collapsed] = !ui[p.collapsed];
  applyPanels();
  // the open-tabs panel opening: its action labels are shown or not for its final width (its row is the
  // panel's width less its 1px border) from the start
  if (p === PANELS.tabs && !ui[p.collapsed]) fitActions((ui[p.width] || 290) - 1);
  flipFrom(before);
  // if the pointer is still on the button, show its new label right away
  const under = pointer && document.elementFromPoint(...pointer);
  if (under && $(p.toggle).contains(under)) showTip($(p.toggle));
  saveUi();
}

// Animate elements from the rects recorded in `before` (Map el → DOMRect) to where they are now.
function flipFrom(before) {
  for (const [el, a] of before) {
    if (!el.isConnected) continue;
    const b = el.getBoundingClientRect();
    if (!a.width || !b.width) continue;
    const dx = a.left - b.left, dy = a.top - b.top;
    // (no overshoot: rail <-> full moves are long, a spring would swing them well past their place;
    // `translate`, not `transform`, so it adds to an element's own transform, e.g. the centred toggle)
    if (Math.abs(dx) + Math.abs(dy) > 1) el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 380, easing: GLIDE });
  }
}

for (const handle of document.querySelectorAll('.resizer')) {
  const p = PANELS[handle.dataset.panel];
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const left = $(p.el).getBoundingClientRect().left;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('active');
    document.body.classList.add('resizing');
    const onMove = (ev) => {
      ui[p.width] = Math.round(Math.min(p.max, Math.max(p.min, ev.clientX - left)));
      applyPanels();
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      handle.classList.remove('active');
      document.body.classList.remove('resizing');
      saveUi();
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  });
  handle.addEventListener('dblclick', () => { ui[p.width] = null; applyPanels(); saveUi(); });
}

$('#btn-save-all').addEventListener('click', () => saveWindow(currentWindowId));
$('#btn-suspend').addEventListener('click', () => suspend({}));
$('#btn-dedupe').addEventListener('click', async () => {
  const n = await run(B.call('closeDuplicates'));
  // (the extension remembers it in the shared history; an older one can't take it back)
  if (n) toast(t('toast.closedDupes', { n }), ...(extFeatures.has('sharedHistory') ? [t('common.undo'), () => undo(null, true)] : []));
  else if (n != null) toast(t('toast.closedDupes', { n }));
});


document.addEventListener('keydown', (e) => {
  // undo / redo a delete or move (not while typing: there the field's own undo applies)
  if ((e.ctrlKey || e.metaKey) && !e.altKey && ['z', 'y'].includes(e.key.toLowerCase())
      && !e.target.closest?.('input, textarea, select, [contenteditable]') && !document.querySelector('dialog[open]')) {
    e.preventDefault();
    if (e.key.toLowerCase() === 'y' || e.shiftKey) redo(); else undo();
    return;
  }
  const menu = $('#menu');
  if (!menu.hidden && menu.dataset.closing == null) {
    // context menu: its letter runs an entry, arrows move between entries, Enter runs the focused one
    const items = [...menu.querySelectorAll('button')];
    const hit = !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 &&
      items.find((b) => b.dataset.key && b.dataset.key === e.key.toUpperCase());
    if (hit) { e.preventDefault(); hit.click(); return; }
    if (e.key === 'Escape') { hideMenu(); return; } // closes the menu only, not the selection
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length + (i < 0 && e.key === 'ArrowUp' ? 1 : 0)) % items.length].focus();
      return;
    }
  }
  if (e.key === 'Escape') hideMenu();
  const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
  const dialogOpen = !!document.querySelector('dialog[open]');
  if (!typing && !dialogOpen && pickedTabs.size) {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); closePickedTabs([...pickedTabs]); return; }
    if (e.key === 'Escape') { clearTabs(); return; }
  }
  if (!typing && !dialogOpen && pickedItems.size) {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteItems(); return; }
    if (e.key === 'Escape') { clearItems(); return; }
  }
  if (!typing && !dialogOpen && selected.size) {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
    if (e.key === 'Escape') { clearSelection(); return; }
  }
  if (!typing && !dialogOpen && e.key === '?') { e.preventDefault(); openGuide(); return; }
  if (!dialogOpen && (e.ctrlKey || e.metaKey) && ['f', 'k'].includes(e.key.toLowerCase())) { // Ctrl/⌘+F (or K): our search, not the page's
    e.preventDefault();
    openSearch();
  }
});
document.addEventListener('click', (e) => { if (!e.target.closest('#menu')) hideMenu(); });
document.addEventListener('scroll', hideMenu, true);
window.addEventListener('blur', hideMenu);

// push events from the extension
let stateSeq = 0;
const stateWaiters = [];
const nextState = () => new Promise((r) => stateWaiters.push(r));
B.on('state', (s) => { state = s; stateSeq++; render(); stateWaiters.splice(0).forEach((r) => r()); });
B.on('settings', (s) => {
  const relayout = s.columns !== settings?.columns;
  switchTheme(s); // (the push may arrive before our own save resolves: it animates either way)
  if (relayout && state) render(); // e.g. columns changed in another dashboard tab
  switchLang(s.language);
});
B.on('tabs', scheduleTabs);
B.on('ready', (ext) => { if (ext) setExtension(ext); if (state) refresh(); }); // reconnected after the service worker restarted (or the extension was updated)
B.on('disconnected', reloadWhenIdle);
// Back to the dashboard (its tab shown again, or its window focused): redraw the open tabs at once.
// While hidden, Chrome stretches the page's timers (up to a minute), so a pending redraw may lag.
document.addEventListener('visibilitychange', () => { if (!document.hidden && state) renderTabs(); });
window.addEventListener('focus', () => { if (state) scheduleTabs(); });

// tabcat is a Chrome extension, so it needs a desktop Chromium browser that installs them: elsewhere
// (Firefox, Safari, phones and tablets, Samsung Internet…) say so before looking for it.
// (navigator.userAgentData exists only in Chromium browsers, and every one of them lists a "Chromium" brand)
function supportedBrowser() {
  const ua = navigator.userAgent, data = navigator.userAgentData;
  const chromium = data ? data.brands.some((b) => b.brand === 'Chromium') : /\b(Chrome|Chromium)\//.test(ua) && 'chrome' in window;
  const mobile = data ? data.mobile : /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const samsung = /SamsungBrowser/i.test(ua) || !!data?.brands.some((b) => /Samsung/i.test(b.brand));
  return chromium && !mobile && !samsung;
}

function showNoExtension() {
  $('#no-ext').hidden = false;
}

async function refresh() {
  [state, settings] = await Promise.all([B.call('getState'), B.call('getSettings')]);
  // the pinned dashboard is gone: an extension from before (0.2.10) that still pins it is told to stop
  // (it then takes its pinned tabs away; a newer one retires the setting itself)
  if (settings.pinDashboard) B.call('saveSettings', { pinDashboard: false });
  await switchLang(settings.language, false);
  applyTheme();
  render();
  renderTabs();
}

// Oldest extension this dashboard works with (an older one silently drops newer fields).
const MIN_EXTENSION = '1.0.0'; // (the first release: what came before were builds in development)
let extVersion = null; // the connected extension's (shown in About)
let extUpdatesItself = false; // installed from the Chrome Web Store (see "updates")
// What the connected extension can do: it says so (0.2.11 on); an older one, by its version
let extFeatures = new Set();
const FEATURES_BY_VERSION = [['wakeTabs', '0.2.7'], ['logoSymbol', '0.2.10']];
function setExtension(ext) {
  extVersion = ext.version || null;
  extUpdatesItself = !!ext.updatesItself;
  extFeatures = new Set(Array.isArray(ext.features) ? ext.features
    : FEATURES_BY_VERSION.filter(([, v]) => extVersion && !olderThan(extVersion, v)).map(([f]) => f));
}
const olderThan = (a, b) => {
  const [x, y] = [a, b].map((v) => String(v).split('.').map(Number));
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0);
  return false;
};

async function init() {
  hydrateIcons();
  // start in the language of the last visit; the extension's setting follows once connected
  let lang = 'auto';
  try { lang = localStorage.getItem('tabcat:lang') || 'auto'; } catch { /* storage unavailable */ }
  langShown = await setLang(lang);
  applyText();
  // language, panels and look are in place: settle their styles while transitions are still off (so
  // e.g. the saved panel width doesn't animate in from the default), then show the page. The page stays
  // hidden until we know what to show: the board, or a notice (no supported browser, no extension) in
  // its place, so the board is never glimpsed before a notice.
  const show = () => { void document.body.offsetWidth; document.documentElement.classList.remove('booting'); };
  if (!supportedBrowser()) {
    Object.assign($('#browser-url'), { href: location.href, textContent: location.href });
    $('#no-browser').hidden = false;
    return show();
  }
  // (the extension's content script is in the page before this runs and answers at once: no answer
  // within half a second means it isn't there)
  const ext = await B.connect(500);
  if (!ext) {
    showNoExtension();
    show();
    // the extension may still answer (late, or loaded since): keep asking, and open the board when it does
    let started = false;
    const ask = setInterval(B.hello, 1000);
    B.on('ready', (late) => { if (started) return; started = true; clearInterval(ask); start(late); });
    return;
  }
  show();
  await start(ext);
}

async function start(ext) {
  setTimeout(offerTour, 800); // (once the board is up: see "tour")
  setExtension(ext);
  $('#no-ext').hidden = true;
  if (olderThan(ext.version, MIN_EXTENSION)) {
    toast(t('noext.old', { version: ext.version, min: MIN_EXTENSION }));
  }
  await refresh();
  checkUpdates();
}

$('#no-ext-retry').addEventListener('click', () => location.reload());

/* ---------- the dashboard as an app ---------- */

// Installed, the dashboard opens in its own window (no tab bar), from the taskbar / dock or Ctrl+Shift+C.
// Chrome says when it can install it (beforeinstallprompt: not when installed, or opened as the app);
// then the sidebar offers it (until hidden with its ×) and Settings > General does too.
// Chrome makes its offer a few seconds after the page loads; one it made before is remembered, so the
// button is there from the start (pressed before the offer comes, it waits for it). Installed since in
// some other way, no offer comes: after a while the button goes.
const INSTALL_HIDDEN = 'tabcat:installHidden';
const INSTALLABLE = 'tabcat:installable';
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
let installPrompt = window.installPrompt || null; // (kept by the script in index.html if it came early)
let installKnown = !matchMedia('(display-mode: standalone)').matches && store.get(INSTALLABLE) === '1';
// (it folds open and shut, rather than popping; `animate` false: just set, as on loading)
function showInstall(animate = true) {
  const offered = !!installPrompt || installKnown;
  fold($('#btn-install'), offered && store.get(INSTALL_HIDDEN) !== '1', animate);
  fold($('#install-row'), offered, animate);
}
function fold(el, show, animate) {
  const shown = !el.hidden && el.dataset.folding !== 'shut';
  if (shown === show) return;
  el.getAnimations().forEach((a) => a.cancel());
  if (!animate) {
    delete el.dataset.folding;
    el.hidden = !show;
    return;
  }
  el.hidden = false;
  el.dataset.folding = show ? 'open' : 'shut';
  const open = { height: `${el.scrollHeight}px`, opacity: 1 };
  const shut = { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' };
  el.style.overflow = 'hidden';
  el.animate(show ? [shut, open] : [open, shut], { duration: 240, easing: 'cubic-bezier(.22, 1, .36, 1)' }).finished.then(() => {
    el.style.overflow = '';
    el.hidden = !show;
    delete el.dataset.folding;
  }, () => {});
}
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  store.set(INSTALLABLE, '1');
  showInstall();
});
addEventListener('appinstalled', () => {
  installPrompt = null;
  installKnown = false;
  store.set(INSTALLABLE, null);
  showInstall();
  toast(t('toast.installed'));
});
setTimeout(() => {
  if (installPrompt || !installKnown) return;
  installKnown = false; // (no offer: installed meanwhile)
  store.set(INSTALLABLE, null);
  showInstall();
}, 6000);
async function install() {
  if (!installPrompt) await new Promise((done) => { addEventListener('beforeinstallprompt', done, { once: true }); setTimeout(done, 4000); });
  const p = installPrompt;
  if (!p) return;
  installPrompt = null; // (each offer prompts once; Chrome offers again if this one is declined)
  await p.prompt();
  showInstall();
}
$('#btn-install').addEventListener('click', (e) => {
  if (!e.target.closest('#install-dismiss')) return void install();
  store.set(INSTALL_HIDDEN, '1');
  showInstall();
});
$('#settings-install').addEventListener('click', install);
showInstall(false);

/* ---------- tour ---------- */

// A walk round the page, a step at a time: the part a step is about stays lit, the rest dimmed, with a
// card beside it. Offered once, the first time the dashboard opens (see start); then from Help.
const TOUR = [
  { key: 'welcome' },
  { key: 'workspaces', at: '#sidebar' },
  { key: 'tabs', at: '#tabs-panel' },
  { key: 'categories', at: '#cat-bar' },
  { key: 'groups', at: '#board .group' },
  { key: 'search', at: '#search-box .search-field' },
  { key: 'install', at: '#btn-install', when: () => !$('#btn-install').hidden }, // (only while it can be installed)
  { key: 'more', at: '#btn-help, #btn-settings', all: true }, // (both buttons, and what's between)
  { key: 'tour', at: '#btn-help' },
  { key: 'shortcut' },
  { key: 'bye' },
];
const TOUR_OFFERED = 'tabcat:tourOffered';
let tour = TOUR; // this time's steps (see `when`)
let tourStep = -1;
let tourSide = 0; // where the card went last: it stays on that side while it fits there (see placeTour)

async function offerTour() {
  try {
    if (localStorage.getItem(TOUR_OFFERED)) return;
    localStorage.setItem(TOUR_OFFERED, '1');
  } catch { return; } // (storage unavailable: it would be offered every time)
  if (await confirmDialog({ title: t('tour.offer.title'), text: t('tour.offer.text'), ok: t('tour.offer.ok'), cancel: t('tour.offer.later') })) startTour();
}
function startTour() {
  tour = TOUR.filter((s) => !s.when || s.when());
  tourSide = 0;
  const box = $('#tour');
  box.getAnimations().forEach((a) => a.cancel()); // (started again while fading out: just stays)
  box.hidden = false;
  // the first step is simply there: the spot and card don't glide in from where they were last time
  box.classList.add('placing');
  showTourStep(0);
  void box.offsetWidth;
  box.classList.remove('placing');
  $('#tour-next').focus();
}
function endTour() {
  tourStep = -1;
  const box = $('#tour');
  box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out' })
    .finished.then(() => { if (tourStep < 0) box.hidden = true; }, () => {});
}
// From one step to the next, the old text fades out over the new one fading in, and the card's height
// glides like its place does
let tourFade = [];
function showTourStep(i) {
  const card = $('#tour .tour-card');
  const body = card.querySelector('.tour-body');
  const moving = tourStep >= 0;
  tourFade.forEach((a) => a.finish());
  let old = null;
  let from = 0;
  if (moving) {
    from = card.offsetHeight;
    old = body.cloneNode(true);
    old.removeAttribute('id');
    old.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    Object.assign(old.style, { position: 'absolute', left: `${body.offsetLeft}px`, top: `${body.offsetTop}px`, width: `${body.offsetWidth}px`, pointerEvents: 'none' });
    old.setAttribute('aria-hidden', 'true');
  }
  // where the buttons were (in the card), for them to glide to where they go
  const buttons = [...card.querySelectorAll('.tour-actions .btn')];
  const was = new Map(buttons.map((b) => [b, !b.hidden && { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth }]));
  tourStep = i;
  const { key } = tour[i];
  // (how far along: the bar fills; its label says it in words)
  const bar = $('#tour .tour-progress');
  bar.setAttribute('aria-valuenow', i + 1);
  bar.setAttribute('aria-valuemax', tour.length);
  bar.setAttribute('aria-label', t('tour.count', { i: i + 1, n: tour.length }));
  bar.firstElementChild.style.width = `${((i + 1) / tour.length) * 100}%`;
  // (a {logo} in the title: the logo, as the page shows it)
  $('#tour-title').replaceChildren(...t(`tour.${key}.title`).split('{logo}')
    .flatMap((part, j) => (j ? [h('span', { class: 'logo tour-logo', role: 'img', 'aria-label': 'tabcat' }), part] : [part])));
  // (a {icon:name} in the text: that control's own icon, as the page shows it)
  // (and at its end, the key that steps on)
  $('#tour-text').replaceChildren(...t(`tour.${key}.text`).split(/\{icon:(\w+)\}/)
    .map((part, j) => (j % 2 ? h('span', { class: 'tour-icon' }, icon(part, 15)) : part)), ' ', h('kbd', { class: 'tour-key' }, 'Space'));
  $('#tour-prev').hidden = i === 0;
  $('#tour-skip').hidden = i === tour.length - 1; // (the last step: nothing left to skip)
  $('#tour-next').textContent = t(i === tour.length - 1 ? 'tour.done' : 'tour.next');
  placeTour();
  if (!old) return;
  card.append(old);
  const glide = { duration: 380, easing: 'cubic-bezier(.22, 1, .36, 1)' };
  // the buttons glide (and stretch, for a new label) from where they were; one appearing fades in, one
  // going fades out where it was (a copy: the button itself is hidden already)
  const moves = buttons.flatMap((b) => {
    const from = was.get(b);
    if (b.hidden) {
      if (!from) return [];
      const ghost = Object.assign(b.cloneNode(true), { id: '', hidden: false, tabIndex: -1 });
      Object.assign(ghost.style, { position: 'absolute', left: `${from.x}px`, top: `${from.y}px`, width: `${from.w}px`, margin: 0, pointerEvents: 'none' });
      card.append(ghost);
      const a = ghost.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.92)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' });
      a.finished.then(() => ghost.remove(), () => ghost.remove());
      return [a];
    }
    if (!from) return [b.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 0, transform: 'scale(.92)', offset: .3 }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' })];
    const dx = from.x - b.offsetLeft, dy = from.y - b.offsetTop, w = b.offsetWidth;
    if (!dx && !dy && from.w === w) return [];
    return [b.animate([{ transform: `translate(${dx}px, ${dy}px)`, width: `${from.w}px` }, { transform: 'none', width: `${w}px` }], glide)];
  });
  tourFade = [
    ...moves,
    card.animate([{ height: `${from}px` }, { height: `${card.offsetHeight}px` }], glide),
    body.animate([{ opacity: 0 }, { opacity: 0, offset: .3 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' }),
  ];
  const leaving = old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' });
  tourFade.push(leaving);
  leaving.finished.then(() => old.remove(), () => old.remove());
}
// The lit part (a step's element, if shown; else none: the card alone, centred) and the card beside it:
// right of it, left, below or above, whichever fits first
function placeTour() {
  if (tourStep < 0) return;
  // (`all`: the box round every element `at` matches that is shown; else the first one)
  const { at: sel, all } = tour[tourStep];
  const els = !sel ? [] : all ? [...document.querySelectorAll(sel)] : [document.querySelector(sel)].filter(Boolean);
  const boxes = els.map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0);
  const r = boxes.length ? {
    left: Math.min(...boxes.map((b) => b.left)), top: Math.min(...boxes.map((b) => b.top)),
    right: Math.max(...boxes.map((b) => b.right)), bottom: Math.max(...boxes.map((b) => b.bottom)),
  } : null;
  if (r) Object.assign(r, { width: r.right - r.left, height: r.bottom - r.top });
  const spot = $('#tour .tour-spot');
  const card = $('#tour .tour-card');
  const pad = 6;
  const gap = 14;
  const m = 16;
  Object.assign(spot.style, r
    ? { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px` }
    : { left: `${innerWidth / 2}px`, top: `${innerHeight / 2}px`, width: '0px', height: '0px' });
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  const clampY = (y) => Math.min(Math.max(y, m), innerHeight - h - m);
  const clampX = (x) => Math.min(Math.max(x, m), innerWidth - w - m);
  let at = [(innerWidth - w) / 2, (innerHeight - h) / 2];
  if (r) {
    const sides = [
      [r.right + pad + gap, clampY(r.top), r.right + pad + gap + w <= innerWidth - m],
      [r.left - pad - gap - w, clampY(r.top), r.left - pad - gap - w >= m],
      [clampX(r.left), r.bottom + pad + gap, r.bottom + pad + gap + h <= innerHeight - m],
      [clampX(r.left), r.top - pad - gap - h, r.top - pad - gap - h >= m],
    ];
    // the side it was on last if it fits there, so it doesn't swing from side to side; else the first that does
    const side = sides[tourSide][2] ? tourSide : sides.findIndex(([, , fits]) => fits);
    if (side >= 0) {
      tourSide = side;
      at = sides[side];
    }
  }
  card.style.left = `${at[0]}px`;
  card.style.top = `${at[1]}px`;
}
// (started again from Help: the dialog makes way for it)
$('#help-tour').addEventListener('click', () => { $('#help').close(); startTour(); });
// Help's "Add sample workspaces": a work board, a study board and a trip (sample.js), in the page's
// language, beside what is there; one Undo takes them away again.
$('#help-sample').addEventListener('click', async () => {
  $('#help').close();
  const before = structuredClone(state);
  const ids = await apply(...sampleWorkspaces(getLang()).map((node) => ({ op: 'create', parentId: null, node })));
  if (!ids?.length) return;
  const entry = await remember(before, { verb: 'sample' });
  select(ids[0]);
  toast(t('toast.sampleAdded'), t('common.undo'), () => undo(entry, true));
});
$('#tour-skip').addEventListener('click', endTour);
$('#tour-prev').addEventListener('click', () => showTourStep(Math.max(0, tourStep - 1)));
$('#tour-next').addEventListener('click', () => (tourStep === tour.length - 1 ? endTour() : showTourStep(tourStep + 1)));
// while it is up: Space or → steps on, ← back, Esc ends; no other key reaches the page beneath (the
// card's buttons still take Tab and Enter)
document.addEventListener('keydown', (e) => {
  if (tourStep < 0) return;
  const next = () => $('#tour-next').click();
  const act = { ' ': next, ArrowRight: next, ArrowLeft: () => tourStep > 0 && $('#tour-prev').click(), Escape: endTour }[e.key];
  if (act) { e.preventDefault(); act(); }
  if (!['Tab', 'Enter'].includes(e.key)) e.stopPropagation();
}, true);
addEventListener('resize', placeTour);
// a page can't open chrome:// addresses (and without the extension nothing can open them for it): such a
// link copies its address instead, to paste into a new tab
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[data-copy]');
  if (!a) return;
  e.preventDefault();
  navigator.clipboard?.writeText(a.getAttribute('href')).then(() => toast(t('noext.copied')), () => {});
});
init();
