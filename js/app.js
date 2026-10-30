import * as B from './bridge.js';
import * as T from './tree.js';
import { renderMarkdown, toggleTask } from './markdown.js';
import { typesetMath, mathReady } from './math.js';
import { searchEmoji, favoriteEmoji, recordEmoji } from './emoji.js';
import { icon, hydrateIcons } from './icons.js';
import { LANGS, setLang, getLang, t, translateDom, randomName } from './i18n.js';

const tr = t; // for code where `t` is a tab or a drop target

const $ = (sel, root = document) => root.querySelector(sel);

let state = null;
let settings = { closeOnSave: true, groupTabs: true, autoSuspendMinutes: 0, theme: 'auto', accent: 'orange', language: 'auto' };

// Accent colours for Settings > Color, in rainbow order (hue in oklch); orange is the original.
const ACCENTS = { red: 25, orange: 55, yellow: 90, lime: 125, green: 150, teal: 185, sky: 225, blue: 262, purple: 300, pink: 350 };
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
  return parts.flatMap((t, i) => [i ? ' ' : null, h('span', { class: 'chunk' }, t + (i < parts.length - 1 ? ' ·' : ''))])
    .filter(Boolean);
}

// A node's symbol (or `fallback`): emoji as text, a letter/digit as a small badge.
// `fallback` may be an icon element: shown (muted, as a line icon) when there is no symbol.
function symbolEl(symbol, fallback = '') {
  if (!symbol && fallback instanceof Node) return h('span', { class: 'sym sym-icon' }, fallback);
  const s = symbol || fallback;
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
  const img = h('img', { class: 'fav', src: icon || fallback, alt: '', loading: 'lazy', draggable: 'false' });
  img.addEventListener('error', () => {
    if (img.src !== fallback) img.src = fallback;
    else if (img.src !== T.BLANK_ICON) img.src = T.BLANK_ICON;
  });
  return img;
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
  try { return await promise; } catch (err) { toast(err.message); return undefined; }
}
const apply = (...ops) => run(B.apply(...ops));

function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  const hue = ACCENTS[settings.accent];
  if (hue == null || settings.accent === 'orange') { delete root.dataset.accent; root.style.removeProperty('--hue'); }
  else { root.dataset.accent = settings.accent; root.style.setProperty('--hue', hue); }
}

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
  try { animateMoves(before, wsChanged); } finally { openExpanded(opening); growNote(held); growCard(card); }
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
  for (const el of document.querySelectorAll('.hover')) el.classList.remove('hover');
}, { passive: true });
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) pointer = null; });

function restoreHover() {
  if (tipEl && !tipEl.offsetParent) hideTip(); // its element was re-rendered away or hidden
  if (!pointer) return;
  for (let el = document.elementFromPoint(...pointer); el; el = el.parentElement) el.classList.add('hover');
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
  // only the name / symbol edit the workspace; the space beside it is where search opens
  head.replaceChildren(
    h('h1', { title: t('edit.workspace'), onclick: () => editNode(ws) }, ws.symbol && symbolEl(ws.symbol), ws.name),
    h('span', { class: 'desc' }, ws.description || ''));
  head.oncontextmenu = (e) => nodeMenu(e, ws);
}

function renderCats() {
  const ws = currentWs();
  const bar = $('#cat-bar');
  if (!ws) { bar.replaceChildren(); return; }
  const cur = currentCat(ws);
  bar.replaceChildren(
    ...ws.categories.map((c) => h('div', {
      class: 'cat-tab' + (c === cur ? ' active' : ''), draggable: 'true', dataset: { id: c.id, type: 'category' },
      onclick: () => select(ws.id, c.id),
      ondblclick: () => editNode(c),
      oncontextmenu: (e) => nodeMenu(e, c),
    }, c.name, h('span', { class: 'count' }, T.countLinks(c)))),
    Object.assign(btn(plus(), t('new.category'), () => addCategory(ws)), { className: 'icon-btn cat-add' }));
  // the column stepper sits at the bar's start, so it never moves as tabs come and go
  if (cur) bar.prepend(columnControl(), h('span', { class: 'bar-split' }));
}

// Board column count (a setting; stepper at the right end of the category bar).
const boardColumns = () => Math.min(MAX_COLUMNS, Math.max(1, settings.columns || 3));
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

// The badge rides along with the pointer, just off its corner (clear of the count, which hides the
// pointer so the number stays readable). A wheel step nudges its wheel that way.
const wheelBadge = $('#wheel-hint');
function wheelHint(e) {
  const off = e.target.closest?.('.col-ctl > .ico');
  wheelBadge.classList.toggle('on', !off);
  wheelBadge.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
}
function hideWheelHint() { wheelBadge.classList.remove('on'); }
function nudgeWheelHint(dir) {
  wheelBadge.querySelector('.wheel').animate([{ transform: `translateY(${dir * 3}px)` }, { transform: 'none' }], { duration: 260, easing: SPRING });
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
  board.replaceChildren(h('div', { class: 'columns' }, cols.map((list, i) => {
    return h('div', { class: 'col', dataset: { col: i } },
      list.flatMap((g, k) => [
        k > 0 && h('div', {
          class: 'gap-slot', dataset: { before: g.id },
          onclick: () => addGroup(cat, columnOf(cat, ...groupAt(cat, g.id)), { beforeId: g.id }),
        }),
        cachedGroup(g),
      ]),
      h('div', { class: 'col-tail' },
        h('div', {
          class: 'add-group', dataset: { col: i, id: `add:${i}` },
          onclick: (e) => { const end = columnEnd(cat, e.currentTarget.closest('.col')); addGroup(cat, end.column, { afterId: end.afterId }); },
        }, icon('plus', 28))));
  })));
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

const MAX_COLUMNS = 7;

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
    note.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      if (e.target.matches('input[type=checkbox]')) {
        e.preventDefault();
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

async function renderTabs() {
  if (drag) { pendingTabsRender = true; return; }
  pendingTabsRender = false;
  const seq = ++tabsRenderSeq;
  const data = await run(B.call('getTabs'));
  if (!data || seq !== tabsRenderSeq) return; // a newer render is on its way
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
    const label = `${name} · ${t('count.tabs', { n: w.tabs.length })}`;
    const collapsed = shut.has(w.id);
    return h('div', { class: 'win' + (collapsed ? ' collapsed' : ''), dataset: { window: w.id } },
      h('div', { class: 'win-head', draggable: 'true' },
        Object.assign(btn(icon('chevron', 14), t(collapsed ? 'act.expand' : 'act.collapse'), () => toggleWin(w.id)), { className: 'icon-btn win-twisty' }),
        h('span', { class: 'grow' }, chunks(label.split(' · '))),
        h('span', { class: 'win-count' }, w.tabs.length),
        w.tabs.length > 0 && btn(icon('save'), t(w.id === currentWindowId ? 'win.saveThis' : 'win.save'), () => saveWindow(w.id)),
        w.tabs.some(canSuspend) && btn(icon('suspend'), t('win.suspend'), () => suspend({ windowId: w.id })),
        noTip(btn(icon('close'), t('win.close'), () => closeWindow(w, others)))),
      !collapsed && h('div', { class: 'win-tabs' }, w.tabs.map((t) => h('div', {
        class: 'tab-row' + (t.active ? ' active' : '') + (t.discarded ? ' discarded' : '') + (pickedTabs.has(t.id) ? ' picked' : ''),
        draggable: 'true', dataset: { tab: t.id, url: t.url },
        title: [t.title || t.url, t.url, t.discarded ? tr('tab.suspended') : t.active ? tr('tab.active') : ''].filter(Boolean).join('\n'),
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
      btn(icon('save'), tr('tab.save'), () => saveTabsTo([t.id])),
      noTip(btn(icon('close'), tr('tab.close'), () => run(B.call('closeTabs', { tabIds: [t.id] }))))))));
  });
  $('#tab-stats').replaceChildren(...chunks([t('count.windows', { n: wins.length }), t('count.tabs', { n: all.length }),
    sleeping && t('count.suspended', { n: sleeping }), dupes && t('count.duplicates', { n: dupes })].filter(Boolean)));
  // always shown (so the row never reshuffles); greyed out when there is nothing to do
  $('#btn-suspend').disabled = !suspendable;
  $('#btn-dedupe').disabled = !dupes;
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
  run(B.call('closeWindow', { windowId: w.id }));
}

// Labelled action buttons, or icons only as soon as the labelled row would not fit (measured on an
// invisible copy, so the label slide animation never confuses the check).
function fitActions() {
  const row = $('.panel-actions');
  const probe = row.cloneNode(true);
  probe.classList.remove('icons-only');
  Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', left: '0', top: '0', width: 'max-content' });
  probe.querySelectorAll('.label').forEach((l) => { l.style.transition = 'none'; });
  row.parentElement.append(probe);
  const fits = probe.getBoundingClientRect().width <= row.getBoundingClientRect().width + 0.5;
  probe.remove();
  row.classList.toggle('icons-only', !fits);
}
new ResizeObserver(fitActions).observe($('.panel-actions'));

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

async function closePickedTabs(ids) {
  clearTabs();
  await run(B.call('closeTabs', { tabIds: ids }));
}

function tabsMenu(ids) {
  const n = ids.length;
  const cat = currentCat();
  return [
    cat && { icon: 'group', label: t('tabs.saveGroup', { n }), key: 'G', fn: async () => {
      clearTabs();
      await run(B.call('saveTabs', { tabIds: ids, close: settings.closeOnSave, newGroup: { categoryId: cat.id, name: suggestName('group'), column: 0 } }));
    } },
    { icon: 'suspend', label: t('tabs.suspend', { n }), key: 'S', fn: async () => {
      clearTabs();
      const done = await run(B.call('discardTabs', { tabIds: ids }));
      if (done != null) toast(t('toast.suspended', { n: done }));
    } },
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
    id: n.id, title: n.symbol && !T.isLetterSymbol(n.symbol) ? `${n.symbol} ${n.name}` : n.name,
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
async function toggleCollapse(node) {
  if (!node.collapsed) {
    const body = contentsOf(node.id);
    if (body) {
      body.style.overflow = 'hidden';
      body.style.minHeight = '0'; // (nested lists keep a small min-height for dropping)
      await body.animate([{ height: `${body.getBoundingClientRect().height}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: 220, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }).finished.catch(() => {});
    }
  } else expanding = node.id;
  apply({ op: 'patch', id: node.id, fields: { collapsed: !node.collapsed } });
}
// (called at the end of animateLayout)
// The contents of a group / folder being expanded are held shut while the layout is measured (like a
// note, see holdNote), so what is below gets no slide of its own: it just follows them as they open.
function holdExpanding() {
  if (!expanding) return null;
  const body = contentsOf(expanding);
  expanding = null;
  if (!body) return null;
  const h = body.getBoundingClientRect().height;
  Object.assign(body.style, { height: '0px', minHeight: '0', overflow: 'hidden' });
  return { body, h };
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
    toast(t('toast.deleted', { name: node.name || node.url }), t('common.undo'), () => apply({ op: 'replace', state: snapshot }));
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
  toast(t(id ? 'toast.windowSaved' : 'toast.nothingToSave'));
}

/* ---------- confirm dialog ---------- */

// Styled replacement for window.confirm(). Resolves true only when the action button is used.
function confirmDialog({ title, text = '', ok = t('common.ok'), danger = false }) {
  const dlg = $('#confirm');
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  $('#confirm-text').hidden = !text;
  const okBtn = $('#confirm-ok');
  okBtn.textContent = ok;
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
  const wrap = h('div', { class: 'sym-wrap' }, input, blankIcon && h('span', { class: 'sym-default', 'aria-hidden': 'true' }, blankIcon), clear);

  function set(em) {
    const old = input.value;
    const { fontSize, fontWeight, color } = getComputedStyle(input); // (before sync() restyles a letter)
    input.value = em;
    err.textContent = '';
    input.dispatchEvent(new Event('input', { bubbles: true })); // (syncs the grid; a live preview hears it too)
    if (em !== old) popSymbol(old, { fontSize, fontWeight, color });
    if (em) recordEmoji(em);
  }
  // Picked or cleared (not typed): the old symbol shrinks away over the box while the new one springs
  // in, the box itself staying put. Both are copies laid over the box (inside the dialog, which sits
  // above the page) and scaled with a transform: animating the input's own font size made the glyph
  // bob as each size was laid out again. The copies are inputs too (bare: no border or fill), so the
  // glyph sits exactly where the box draws it. The box's own text is hidden while the new copy grows.
  let popping = null; // { anim, copy }
  const overBox = (text, look) => {
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
    if (popping) { popping.anim.cancel(); popping.copy.remove(); popping = null; input.style.fontSize = ''; }
    if (input.value) {
      const copy = overBox(input.value, getComputedStyle(input));
      input.style.fontSize = '0px';
      const anim = copy.animate([{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: SPRING });
      const mine = popping = { anim, copy };
      anim.finished.catch(() => {}).then(() => {
        if (popping !== mine) return;
        popping = null;
        copy.remove();
        input.style.fontSize = '';
      });
    }
    if (!old) return;
    const copy = overBox(old, was);
    copy.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 130, easing: 'ease-in', fill: 'forwards' })
      .finished.catch(() => {}).then(() => copy.remove());
  }
  function sync() {
    wrap.classList.toggle('blank', !input.value);
    input.classList.toggle('letter', T.isLetterSymbol(input.value));
    for (const b of grid.children) b.classList.toggle('selected', b.dataset.emoji === input.value);
  }
  function show(list, note = '') {
    grid.replaceChildren(...list.map((e) => h('button', {
      type: 'button', title: e.name || e.unicode, dataset: { emoji: e.unicode }, onclick: () => set(e.unicode),
    }, T.isLetterSymbol(e.unicode) ? symbolEl(e.unicode) : e.unicode)));
    status.textContent = note;
    sync();
  }

  const defaults = () => EMOJIS.map((unicode) => ({ unicode }));
  async function showDefaults() {
    show(defaults());
    try {
      const recent = await favoriteEmoji(16);
      if (search.value.trim()) return;
      const seen = new Set();
      show([...recent, ...defaults()].filter((e) => !seen.has(e.unicode) && seen.add(e.unicode)).slice(0, 40));
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
    if (e.key === 'Enter') { e.preventDefault(); grid.querySelector('button')?.click(); }
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
  const [id] = (await apply({ op: 'create', parentId: null, node: { type: 'workspace', ...v, categories: [{ type: 'category', name: t('def.category') }] } })) || [];
  if (id) select(id);
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
  if (removed) await apply({ op: 'patch', id: node.id, fields: { items } });
  toast(t('toast.removedDupes', { n: removed }));
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
    toast(one ? t('toast.deleted', { name: groups[0].name }) : t('toast.deletedGroups', { n: groups.length }), t('common.undo'), () => apply({ op: 'replace', state: snapshot }));
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

// Shift-drag anywhere on the board: a box that works out what you mean as it grows. Covering two or
// more groups, a group's whole header, or most of a group selects groups; a box within one group
// selects its links / folders (within the group of an existing item selection). Shift inverts what
// the box covers, as with clicks.
function smartBox(e) {
  e.preventDefault(); // no native drag of what is under the pointer
  e.stopImmediatePropagation();
  const baseGroups = new Set(selected), baseItems = new Set(pickedItems), baseItemGroup = pickedGroup;
  const x0 = e.clientX, y0 = e.clientY;
  const box = h('div', { id: 'marquee' });
  let moved = false;
  const meets = (a, r) => a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top;
  const covers = (r, a) => r.left <= a.left && r.right >= a.right && r.top <= a.top && r.bottom >= a.bottom;
  const overlap = (a, r) => Math.max(0, Math.min(a.right, r.right) - Math.max(a.left, r.left)) * Math.max(0, Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top));
  const invert = (set, base, ids) => { set.clear(); base.forEach((id) => set.add(id)); ids.forEach((id) => (base.has(id) ? set.delete(id) : set.add(id))); };
  const onMove = (ev) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
    if (!moved) { moved = true; hideTip(); document.body.append(box); document.body.classList.add('selecting'); }
    const r = { left: Math.min(x0, ev.clientX), top: Math.min(y0, ev.clientY), right: Math.max(x0, ev.clientX), bottom: Math.max(y0, ev.clientY) };
    Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.right - r.left + 'px', height: r.bottom - r.top + 'px' });
    const hit = [...document.querySelectorAll('#board .group')].filter((c) => meets(c.getBoundingClientRect(), r));
    let mode = 'none';
    if (hit.length >= 2) mode = 'groups';
    else if (hit.length === 1) {
      const c = hit[0].getBoundingClientRect();
      const head = hit[0].querySelector(':scope > .group-head').getBoundingClientRect();
      mode = covers(r, head) || overlap(c, r) > 0.6 * c.width * c.height ? 'groups' : 'items';
    }
    if (mode === 'groups') {
      pickedItems.clear(); pickedGroup = null;
      invert(selected, baseGroups, hit.map((c) => c.dataset.id));
    } else if (mode === 'items') {
      selected.clear();
      const gid = hit[0].dataset.id;
      const rows = [...hit[0].querySelectorAll('.link-row, .folder-head')].filter((row) => meets(row.getBoundingClientRect(), r));
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
  e.preventDefault(); // no native drag of the item under the pointer
  const base = new Set(pickedItems);
  const x0 = e.clientX, y0 = e.clientY;
  const bound = body.getBoundingClientRect();
  const box = h('div', { id: 'marquee' });
  let moved = false;
  const onMove = (ev) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
    if (!moved) { moved = true; hideTip(); document.body.append(box); document.body.classList.add('selecting'); }
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const x1 = clamp(ev.clientX, bound.left, bound.right), y1 = clamp(ev.clientY, bound.top, bound.bottom);
    const r = { left: Math.min(x0, x1), top: Math.min(y0, y1), right: Math.max(x0, x1), bottom: Math.max(y0, y1) };
    Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.right - r.left + 'px', height: r.bottom - r.top + 'px' });
    pickedItems.clear();
    base.forEach((id) => pickedItems.add(id));
    for (const row of body.querySelectorAll('.link-row, .folder-head')) {
      const c = row.getBoundingClientRect();
      if (c.left < r.right && c.right > r.left && c.top < r.bottom && c.bottom > r.top) pickedItems.add(row.closest('.item').dataset.id);
    }
    pickedGroup = pickedItems.size ? gid : null;
    if (selected.size) clearSelection();
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
});

const pickedNodes = () => [...pickedItems].map((id) => T.locate(state, id)?.node).filter(Boolean);

async function deleteItems() {
  const nodes = pickedNodes();
  clearItems();
  if (!nodes.length) return;
  const snapshot = structuredClone(state);
  await animateOut(nodes.map((n) => n.id));
  if (await apply(...nodes.map((n) => ({ op: 'remove', id: n.id })))) {
    toast(t('toast.deletedItems', { n: nodes.length }), t('common.undo'), () => apply({ op: 'replace', state: snapshot }));
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

const hLine = (r, before) => ({ x: r.left + 4, y: (before ? r.top : r.bottom) - 1, w: r.width - 8, h: 2 });
const vLine = (r, before, gap = 7) => ({ x: (before ? r.left - gap : r.right + gap) - 1, y: r.top, w: 3, h: r.height });

function resolveDrop(e, d) {
  const el = e.target instanceof Element ? e.target : e.target.parentElement;
  if (!el || el.closest('dialog, #menu')) return null;
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
  return d.kind === 'node' && !!el.closest(`[data-id="${CSS.escape(d.id)}"]`);
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

async function performDrop(d, t, e) {
  if (t.action === 'open') {
    const r = T.locate(state, d.id);
    if (r) await run(B.call('openUrls', { urls: T.collectLinks(r.node).map((l) => l.url), windowId: t.windowId }));
    return;
  }
  if (d.kind === 'node') markMoving(d.ids || [d.id]);
  if (t.action === 'merge') return mergeGroups(d.id, t.targetId);
  if (t.action === 'column') return moveToColumn(d.ids || [d.id], t);
  const pre = targetOps(t, d.kind === 'window' ? tr('name.window', { date: new Date().toLocaleString(getLang()) }) : null);
  const parentId = pre.length ? '$0' : t.parentId;

  if (d.kind === 'node') {
    await apply(...pre, ...(d.ids || [d.id]).map((id) => ({ op: 'move', id, parentId, index: t.index })));
    return;
  }
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

// Moves every item (and the note) of group `fromId` to the end of group `intoId`, then deletes `fromId`.
async function mergeGroups(fromId, intoId) {
  const from = T.locate(state, fromId)?.node;
  const into = T.locate(state, intoId)?.node;
  if (!from || !into) return;
  const label = (g) => `${g.symbol ? g.symbol + ' ' : ''}${g.name}`;
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
  if (ok) toast(`Merged into “${into.name}”`, 'Undo', () => apply({ op: 'replace', state: snapshot }));
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
  h('label', { class: 'swatch', dataset: { accent: name, i18nAttr: `title:accent.${name}` }, style: `--hue: ${hue}` },
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
  }
}
for (const input of document.querySelectorAll('#settings-form input[type=number]')) {
  const wrap = h('div', { class: 'stepper' });
  input.replaceWith(wrap);
  const step = (dir) => {
    const before = input.value;
    if (dir > 0) input.stepUp(); else input.stepDown();
    if (input.value === before) return false;
    input.animate([{ transform: `translateY(${dir * -7}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: SPRING });
    syncSteppers();
    return true;
  };
  const save = () => input.dispatchEvent(new Event('change', { bubbles: true }));
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
  wrap.append(input, button(-1), button(1));
  input.addEventListener('input', syncSteppers);
}

function fillSettings() {
  const f = $('#settings-form');
  f.closeOnSave.checked = settings.closeOnSave;
  f.groupTabs.checked = settings.groupTabs !== false;
  f.autoSuspendMinutes.value = settings.autoSuspendMinutes;
  f.language.value = Object.hasOwn(LANGS, settings.language) ? settings.language : 'auto';
  f.theme.value = settings.theme;
  f.accent.value = ACCENTS[settings.accent] != null ? settings.accent : 'orange';
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
    autoSuspendMinutes: Math.max(0, parseInt(f.autoSuspendMinutes.value, 10) || 0),
    language: f.language.value,
    theme: f.theme.value,
    accent: f.accent.value,
    columns: Math.min(MAX_COLUMNS, Math.max(1, parseInt(f.columns.value, 10) || 3)),
  }));
  if (s) { switchTheme(s); relayoutBoard(); switchLang(s.language); }
});

// Apply new settings; a changed theme or accent cross-fades the whole page from the old look.
let lookShown = ''; // `${theme}|${accent}` last applied or on its way (a transition applies it a frame later)
function switchTheme(s) {
  const look = `${s.theme}|${s.accent}`;
  const changed = look !== (lookShown || `${settings.theme}|${settings.accent}`);
  lookShown = look;
  const swap = () => { settings = s; applyTheme(); };
  if (changed && document.startViewTransition) document.startViewTransition(swap);
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
  document.startViewTransition(swap).finished.finally(() => named.forEach(([el]) => {
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
    await B.apply(...picked.map((node) => ({ op: 'create', parentId: null, node })));
    toast(t('toast.imported', { n: picked.length }));
  } catch (err) {
    toast(t('toast.importFailed', { error: err.message }));
  }
});

// Portable settings: per-machine values (dashboard address, last used group) stay out of the file.
const SETTINGS_IO = {
  language: (v) => v === 'auto' || Object.hasOwn(LANGS, v),
  closeOnSave: (v) => typeof v === 'boolean',
  groupTabs: (v) => typeof v === 'boolean',
  autoSuspendMinutes: (v) => Number.isInteger(v) && v >= 0,
  theme: (v) => ['auto', 'light', 'dark'].includes(v),
  accent: (v) => Object.hasOwn(ACCENTS, v),
  columns: (v) => Number.isInteger(v) && v >= 1 && v <= MAX_COLUMNS,
};

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
    fillSettings();
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
  const dlg = $('#info');
  dlg.showModal();
  dlg.querySelector('button').blur();
});

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
    ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: 'ease-in', fill: 'forwards' })
      .finished.catch(() => {}).then(() => ghost.remove());
  }
  tipEl = null;
  tip.hidden = true;
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
  if (!el || drag || el.closest('dialog, #menu')) return;
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

const PANEL_FLIP = '.brand-logo, .ws-item, .side-btn, #tabs-toggle, .panel-actions .btn, .win-head, .tab-row';
const panelAnimTimer = {};

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
      setTimeout(() => { switchPanel(p); panel.classList.remove('fading'); panel.style.width = ''; }, 150);
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
  panelAnimTimer[p.el] = setTimeout(() => panel.classList.remove('panel-anim'), 450);
  ui[p.collapsed] = !ui[p.collapsed];
  applyPanels();
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
    if (Math.abs(dx) + Math.abs(dy) > 1) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 400, easing: SPRING });
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
  if (n != null) toast(t('toast.closedDupes', { n }));
});


document.addEventListener('keydown', (e) => {
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
B.on('ready', () => { if (state) refresh(); }); // reconnected after the service worker restarted
B.on('disconnected', () => showNoExtension());

function showNoExtension() {
  $('#no-ext-origin').textContent = location.origin;
  $('#no-ext').hidden = false;
}

async function refresh() {
  [state, settings] = await Promise.all([B.call('getState'), B.call('getSettings')]);
  await switchLang(settings.language, false);
  applyTheme();
  render();
  renderTabs();
}

// Oldest extension this dashboard works with (an older one silently drops newer fields).
const MIN_EXTENSION = '0.2.5'; // (0.2.5: group colours)
let extVersion = null; // the connected extension's (shown in About)
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
  const ext = await B.connect();
  extVersion = ext?.version || null;
  if (!ext) return showNoExtension();
  $('#no-ext').hidden = true;
  if (olderThan(ext.version, MIN_EXTENSION)) {
    toast(t('noext.old', { version: ext.version, min: MIN_EXTENSION }));
  }
  await refresh();
}

$('#no-ext-retry').addEventListener('click', () => location.reload());
init();
