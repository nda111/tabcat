import * as B from './bridge.js';
import * as T from './tree.js';
import { renderMarkdown, toggleTask } from './markdown.js';
import { typesetMath } from './math.js';
import { searchEmoji, favoriteEmoji, recordEmoji } from './emoji.js';
import { icon, hydrateIcons } from './icons.js';

const $ = (sel, root = document) => root.querySelector(sel);

let state = null;
let settings = { closeOnSave: true, autoSuspendMinutes: 0, theme: 'auto' };
let ui = loadUi();          // per-device view state: selected workspace / category, panel visibility
let query = '';
let editingNoteId = null;
let drag = null;            // { kind:'node', id, type } | { kind:'tab', tabIds } | { kind:'window', windowId } | { kind:'external' }
let pendingRender = false;
let pendingTabsRender = false;
let currentWindowId = null; // browser window that hosts this dashboard

const EMOJIS = ['🐱', '📁', '📂', '📌', '⭐', '🔥', '💡', '📚', '🧪', '💼', '🏠', '🎮', '🎵', '🎬', '🛒', '✈️',
  '💻', '🧠', '📝', '📊', '🔧', '🎨', '📰', '💬', '🔒', '🌱', '❤️', '✅', '🚀', '📥', '🗂️', '🏷️'];

const FIELDS = {
  workspace: [['name', 'Name', 'text', true], ['symbol', 'Symbol', 'emoji'], ['description', 'Description', 'textarea']],
  category: [['name', 'Name', 'text', true]],
  group: [['name', 'Name', 'text', true], ['symbol', 'Symbol', 'emoji'], ['note', 'Note (markdown)', 'textarea']],
  folder: [['name', 'Name', 'text', true], ['symbol', 'Symbol', 'emoji']],
  link: [['url', 'URL', 'url', true], ['name', 'Name', 'text', true], ['icon', 'Icon', 'icon'], ['description', 'Description', 'textarea']],
};
const TYPE_LABEL = { workspace: 'Workspace', category: 'Category', group: 'Group', folder: 'Folder', link: 'Link' };

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
function symbolEl(symbol, fallback = '') {
  const s = symbol || fallback;
  return T.isLetterSymbol(s)
    ? h('span', { class: 'sym sym-letter' }, h('span', { class: 'sym-glyph' }, s))
    : h('span', { class: 'sym' }, s);
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

let toastTimer;
function toast(msg, actionLabel, action) {
  const t = $('#toast');
  t.replaceChildren(h('span', {}, msg));
  if (actionLabel) t.append(h('button', { onclick: () => { t.hidden = true; action(); } }, actionLabel));
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
}

// Run an extension call, surfacing failures as a toast.
async function run(promise) {
  try { return await promise; } catch (err) { toast(err.message); return undefined; }
}
const apply = (...ops) => run(B.apply(...ops));

function applyTheme() {
  if (settings.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = settings.theme;
}

const currentWs = () => state.workspaces.find((w) => w.id === ui.ws) || state.workspaces[0] || null;
function currentCat(ws = currentWs()) {
  if (!ws) return null;
  return ws.categories.find((c) => c.id === ui.cat[ws.id]) || ws.categories[0] || null;
}
function select(wsId, catId) {
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
  renderSidebar();
  renderHead();
  renderCats();
  renderBoard();
  restoreHover();
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
      onclick: () => { clearSearch(); select(ws.id); },
      ondblclick: () => editNode(ws),
      oncontextmenu: (e) => nodeMenu(e, ws),
    },
    symbolEl(ws.symbol, '🗃️'),
    h('span', { class: 'name' }, ws.name),
    h('span', { class: 'count' }, T.countLinks(ws)))));
}

function renderHead() {
  const ws = currentWs();
  const head = $('#ws-head');
  if (!ws) { head.replaceChildren(h('h1', {}, 'No workspace')); head.onclick = null; return; }
  head.replaceChildren(
    h('h1', {}, ws.symbol && symbolEl(ws.symbol), ws.name),
    h('span', { class: 'desc' }, ws.description || ''));
  head.title = 'Click to edit workspace';
  head.onclick = () => editNode(ws);
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
      onclick: () => { clearSearch(); select(ws.id, c.id); },
      ondblclick: () => editNode(c),
      oncontextmenu: (e) => nodeMenu(e, c),
    }, c.name, h('span', { class: 'count' }, T.countLinks(c)))),
    btn(plus(), 'New category', () => addCategory(ws)),
    cur && columnControl());
}

// Board column count (a setting; stepper at the right end of the category bar).
const boardColumns = () => Math.min(MAX_COLUMNS, Math.max(1, settings.columns || 3));
async function setColumns(v) {
  const s = await run(B.call('saveSettings', { columns: Math.min(MAX_COLUMNS, Math.max(1, v)) }));
  if (s) { settings = s; fillSettings(); renderCats(); renderBoard(); }
}

function columnControl() {
  const n = boardColumns();
  const set = setColumns;
  return h('div', { class: 'col-ctl', title: 'Columns' },
    icon('columns', 15),
    Object.assign(btn(icon('minus', 13), 'Fewer columns', () => set(n - 1)), { disabled: n <= 1 }),
    h('span', { class: 'col-n' }, n),
    Object.assign(btn(icon('plus', 13), 'More columns', () => set(n + 1)), { disabled: n >= MAX_COLUMNS }));
}

function renderBoard() {
  const board = $('#board');
  delete board.dataset.parent;
  if (query) return renderSearch(board);
  const ws = currentWs();
  if (!ws) {
    board.replaceChildren(h('div', { class: 'empty' }, h('p', {}, 'No workspace yet.'),
      h('button', { class: 'btn primary', onclick: addWorkspace }, plus(), 'Create workspace')));
    return;
  }
  const cat = currentCat(ws);
  if (!cat) {
    board.replaceChildren(h('div', { class: 'empty' }, h('p', {}, 'This workspace has no categories.'),
      h('button', { class: 'btn primary', onclick: () => addCategory(ws) }, plus(), 'Create category')));
    return;
  }
  board.dataset.parent = cat.id;
  const n = visibleColumns();
  board.dataset.cols = n;
  const cols = layoutColumns(cat, n);
  // each column: groups with clickable gaps between them ("new group here"), then a tail whose
  // New group card shows when the pointer is below the column's last group
  board.replaceChildren(h('div', { class: 'columns' }, cols.map((list, i) => {
    const column = storedColumn(cat, n, i);
    return h('div', { class: 'col', dataset: { col: i } },
      list.flatMap((g, k) => [
        k > 0 && h('div', {
          class: 'gap-slot', dataset: { before: g.id },
          onclick: () => addGroup(cat, columnOf(cat, ...groupAt(cat, g.id)), { beforeId: g.id }),
        }),
        renderGroup(g),
      ]),
      h('div', { class: 'col-tail' },
        h('div', {
          class: 'add-group', dataset: { col: i }, title: 'New group\nOr drop tabs here',
          onclick: () => addGroup(cat, column),
        }, icon('plus', 28))));
  })));
  typesetMath(board);
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


function renderGroup(g) {
  const editing = editingNoteId === g.id;
  let note = null;
  if (editing) {
    note = h('textarea', { class: 'note-edit', placeholder: 'Markdown note…  (Ctrl+Enter to save)' });
    note.value = g.note || '';
    note.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); note.blur(); }
    });
    note.addEventListener('blur', () => saveNote(g.id, g.note, note.value));
  } else if (g.note) {
    note = h('div', { class: 'note', html: renderMarkdown(g.note), title: 'Click to edit note' });
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
  return h('div', { class: 'group' + (empty ? ' empty-group' : g.collapsed ? ' collapsed' : ''), dataset: { id: g.id, type: 'group' } },
    h('div', {
      class: 'group-head', draggable: 'true',
      ondblclick: () => editNode(g), oncontextmenu: (e) => nodeMenu(e, g),
    },
    g.symbol && h('div', { class: 'node-sym' }, symbolEl(g.symbol)), // no symbol: the name and tools take the room
    h('div', { class: 'node-info' },
      h('div', { class: 'node-line' },
        h('span', { class: 'name' }, g.name),
        h('span', { class: 'count' }, T.countLinks(g)),
        !empty && Object.assign(btn(icon('chevron'), g.collapsed ? 'Expand' : 'Collapse', () => toggleCollapse(g)), { className: 'icon-btn collapse-btn' })),
      // always-visible tools: add buttons | divider | everything else
      h('div', { class: 'node-tools' },
        btn(icon('linkPlus'), 'Add link', () => addLink(g.id)),
        btn(icon('folderPlus'), 'Add folder', () => addFolder(g.id)),
        h('span', { class: 'tools-split' }),
        btn(icon('note'), 'Edit note', () => startNoteEdit(g.id)),
        btn(icon('open'), 'Open all links', () => openAll(g)),
        btn(icon('more'), 'More', (e) => nodeMenu(e, g))))),
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
  return h('li', { class: 'item link', draggable: 'true', dataset: { id: l.id, type: 'link' } },
    h('div', {
      class: 'link-row', title: [l.name || l.url, l.url, l.description].filter(Boolean).join('\n'),
      onclick: (e) => openLink(l, e),
      onauxclick: (e) => { if (e.button === 1) { e.preventDefault(); openLink(l, { ctrlKey: true }); } },
      oncontextmenu: (e) => nodeMenu(e, l),
    },
    iconImg(l.url, l.icon),
    h('span', { class: 'name' }, l.name || l.url),
    l.description && h('span', { class: 'desc' }, l.description),
    h('span', { class: 'head-actions' },
      btn(icon('edit'), 'Edit', () => editNode(l)),
      btn(icon('close'), 'Delete', () => deleteNode(l)))));
}

// One compact row (folders sit among links): chevron, symbol, name, count; the action buttons
// appear on hover and take no space otherwise.
function renderFolder(f, depth) {
  return h('li', { class: 'item folder' + (f.collapsed ? ' collapsed' : ''), dataset: { id: f.id, type: 'folder' } },
    h('div', {
      class: 'folder-head', draggable: 'true',
      // click toggles; editing lives in the buttons/menu so rapid clicks never open the editor
      onclick: () => toggleCollapse(f),
      ondblclick: (e) => e.stopPropagation(),
      oncontextmenu: (e) => nodeMenu(e, f),
    },
    h('span', { class: 'twisty' }, icon('chevron', 13)),
    symbolEl(f.symbol, '📁'),
    h('span', { class: 'node-line' },
      h('span', { class: 'name' }, f.name),
      h('span', { class: 'count' }, T.countLinks(f))),
    h('span', { class: 'head-actions' },
      btn(icon('linkPlus'), 'Add link', () => addLink(f.id)),
      depth < T.MAX_FOLDER_DEPTH && btn(icon('folderPlus'), 'Add subfolder', () => addFolder(f.id)),
      h('span', { class: 'tools-split' }),
      btn(icon('edit'), 'Edit folder', () => editNode(f)),
      btn(icon('open'), 'Open all links', () => openAll(f)),
      btn(icon('more'), 'More', (e) => nodeMenu(e, f)))),
    renderItems(f.items, f.id, depth));
}

/* ---------- search ---------- */

function clearSearch() {
  query = '';
  $('#search').value = '';
}

function renderSearch(board) {
  const q = query.toLowerCase();
  const links = [], containers = [];
  T.walk(state.workspaces, (n, anc) => {
    const path = anc.map((a) => (a.symbol ? a.symbol + ' ' : '') + a.name).join(' › ');
    if (n.type === 'link') {
      if ([n.name, n.url, n.description].some((x) => (x || '').toLowerCase().includes(q))) links.push({ n, anc, path });
    } else if ((n.name || '').toLowerCase().includes(q) || (n.note || '').toLowerCase().includes(q) ||
               (n.description || '').toLowerCase().includes(q)) {
      containers.push({ n, anc, path });
    }
  });
  const section = (title, rows) => rows.length ? [h('h4', {}, `${title} (${rows.length})`), ...rows.slice(0, 200)] : [];
  const linkRows = links.map(({ n, path }) => h('div', {
    class: 'result', title: n.url,
    onclick: (e) => openLink(n, e), oncontextmenu: (e) => nodeMenu(e, n),
  }, iconImg(n.url, n.icon), h('span', { class: 'name' }, highlight(n.name, q),
    h('span', { class: 'muted small' }, '  ', highlight(n.url, q))), h('span', { class: 'path' }, path)));
  const contRows = containers.map(({ n, anc, path }) => h('div', {
    class: 'result', onclick: () => reveal(n, anc),
  }, symbolEl(n.symbol, { workspace: '🗃️', category: '🏷️', group: '🗂️', folder: '📁' }[n.type]),
  h('span', { class: 'name' }, highlight(n.name, q), h('span', { class: 'muted small' }, '  ' + TYPE_LABEL[n.type])),
  h('span', { class: 'path' }, path)));
  const body = [...section('Links', linkRows), ...section('Workspaces, groups & folders', contRows)];
  board.replaceChildren(h('div', { class: 'results' }, body.length ? body : h('p', { class: 'muted', style: 'padding:8px' }, 'No results.')));
}

function reveal(node, anc) {
  const ws = node.type === 'workspace' ? node : anc[0];
  const cat = node.type === 'category' ? node : anc[1];
  clearSearch();
  select(ws.id, cat?.id);
  const target = anc[2] || node;
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-id="${CSS.escape(target.id)}"]`);
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); }
  });
}

/* ---------- open tabs panel ---------- */

async function renderTabs() {
  if (drag) { pendingTabsRender = true; return; }
  pendingTabsRender = false;
  const data = await run(B.call('getTabs'));
  if (!data) return;
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
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const blocks = wins.map((w, i) => {
    const label = `${w.id === currentWindowId ? 'This window' : 'Window ' + (i + 1)} · ${plural(w.tabs.length, 'tab')}`;
    return h('div', { class: 'win', dataset: { window: w.id } },
      h('div', { class: 'win-head', draggable: 'true', title: `${label}\nDrag onto a group to save it` },
        h('span', { class: 'grow' }, chunks(label.split(' · '))),
        h('span', { class: 'win-count' }, w.tabs.length),
        btn(icon('save'), w.id === currentWindowId ? 'Save this window' : 'Save window', () => saveWindow(w.id)),
        w.tabs.some(canSuspend) && btn(icon('suspend'), 'Suspend inactive tabs', () => suspend({ windowId: w.id }))),
      w.tabs.map((t) => h('div', {
        class: 'tab-row' + (t.active ? ' active' : '') + (t.discarded ? ' discarded' : ''),
        draggable: 'true', dataset: { tab: t.id, url: t.url },
        title: [t.title || t.url, t.url, t.discarded ? 'Suspended' : t.active ? 'Active tab' : ''].filter(Boolean).join('\n'),
        onclick: () => run(B.call('activateTab', { tabId: t.id })),
      },
      iconImg(t.url, /^(https?:|data:)/.test(t.favIconUrl) ? t.favIconUrl : ''),
      h('span', { class: 'name' }, t.title || t.url),
      t.discarded && h('span', { class: 'muted' }, icon('suspend', 13)),
      btn(icon('save'), 'Save tab', () => saveTabsTo([t.id])),
      btn(icon('close'), 'Close tab', () => run(B.call('closeTabs', { tabIds: [t.id] }))))));
  });
  $('#tab-stats').replaceChildren(...chunks([plural(wins.length, 'window'), plural(all.length, 'tab'),
    sleeping && `${sleeping} suspended`, dupes && plural(dupes, 'duplicate')].filter(Boolean)));
  $('#btn-suspend').hidden = !suspendable;
  $('#btn-dedupe').hidden = !dupes;
  $('#windows').replaceChildren(...blocks);
  restoreHover();
}

let tabsTimer;
function scheduleTabs() { clearTimeout(tabsTimer); tabsTimer = setTimeout(renderTabs, 80); }

/* ================= mutations ================= */

function openLink(l, e = {}) {
  if (e.shiftKey) run(B.call('openUrls', { urls: [l.url], newWindow: true }));
  else run(B.call('openUrls', { urls: [l.url], active: !(e.ctrlKey || e.metaKey) }));
}

async function openAll(node, newWindow = false) {
  const urls = T.collectLinks(node).map((l) => l.url);
  if (urls.length > 20 && !(await confirmDialog({ title: `Open ${urls.length} tabs?`, ok: 'Open all' }))) return;
  run(B.call('openUrls', { urls, newWindow }));
}

const toggleCollapse = (node) => apply({ op: 'patch', id: node.id, fields: { collapsed: !node.collapsed } });

function startNoteEdit(id) {
  editingNoteId = id;
  render();
  const ta = document.querySelector(`.group[data-id="${CSS.escape(id)}"] .note-edit`);
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}

function saveNote(id, before, after) {
  editingNoteId = null;
  if (after !== (before || '')) apply({ op: 'patch', id, fields: { note: after } });
  else render();
}

async function deleteNode(node) {
  const n = T.countLinks(node);
  if ((node.type === 'workspace' || node.type === 'category') && n > 0 &&
      !(await confirmDialog({
        title: `Delete ${TYPE_LABEL[node.type].toLowerCase()} “${node.name}”?`,
        text: `Its ${n} link${n === 1 ? '' : 's'} will be deleted too.`,
        ok: 'Delete', danger: true,
      }))) return;
  const snapshot = structuredClone(state);
  if (await apply({ op: 'remove', id: node.id })) {
    toast(`Deleted “${node.name || node.url}”`, 'Undo', () => apply({ op: 'replace', state: snapshot }));
  }
}

const suspend = async (args) => {
  const n = await run(B.call('suspendTabs', args));
  if (n != null) toast(`Suspended ${n} tab${n === 1 ? '' : 's'}`);
};

// Save tabs into `parentId`, or into the first group of the current category.
async function saveTabsTo(tabIds, parentId, index) {
  if (!parentId) {
    const cat = currentCat();
    if (!cat) return toast('Create a category first');
    [parentId] = (await apply({ op: 'firstGroup', categoryId: cat.id })) || [];
    if (!parentId) return;
  }
  await run(B.call('saveTabs', { tabIds, parentId, index, close: settings.closeOnSave }));
}

async function saveWindow(windowId) {
  const id = await run(B.call('saveWindow', { windowId, newGroup: { categoryId: currentCat()?.id }, close: settings.closeOnSave }));
  toast(id ? 'Window saved as a new group' : 'Nothing to save');
}

/* ---------- confirm dialog ---------- */

// Styled replacement for window.confirm(). Resolves true only when the action button is used.
function confirmDialog({ title, text = '', ok = 'OK', danger = false }) {
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
function symbolField(label, input, err) {
  input.classList.add('sym-box');
  input.maxLength = 16;
  input.addEventListener('input', () => {
    const v = T.normalizeSymbol(input.value);
    if (v !== input.value) input.value = v;
  });
  const grid = h('div', { class: 'emoji-grid' });
  const status = h('div', { class: 'emoji-status muted small' });
  const search = h('input', { type: 'search', class: 'emoji-search', placeholder: 'Search emoji, or type a letter / digit', autocomplete: 'off' });
  const clear = h('button', { type: 'button', class: 'sym-clear', title: 'Remove symbol', onclick: () => set('') }, icon('close', 11));
  const wrap = h('div', { class: 'sym-wrap' }, input, clear);

  function set(em) {
    input.value = em;
    err.textContent = '';
    sync();
    if (em) recordEmoji(em);
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
    const letter = /^[a-z0-9]$/i.test(q) ? [{ unicode: q.toUpperCase(), name: `Letter ${q.toUpperCase()}` }] : [];
    timer = setTimeout(async () => {
      const mine = ++seq;
      try {
        const found = [...letter, ...await searchEmoji(q)];
        if (mine === seq) show(found, found.length ? '' : 'No emoji found.');
      } catch {
        if (mine === seq) show(letter, 'Could not load the emoji list (offline?). You can still paste an emoji into the box.');
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
  return h('div', { class: 'field' }, h('span', { class: 'field-label' }, label + ' (emoji, letter or digit, optional)'),
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

function openEditor(type, data = {}, title) {
  const dlg = $('#editor');
  const form = $('#editor-form');
  const fields = $('#editor-fields');
  const err = $('#editor-error');
  $('#editor-title').textContent = title || `Edit ${TYPE_LABEL[type].toLowerCase()}`;
  err.textContent = '';
  const inputs = {};
  fields.replaceChildren(...FIELDS[type].map(([key, label, kind, required]) => {
    const input = kind === 'textarea'
      ? h('textarea', {
        name: key, placeholder: 'Ctrl+Enter to save',
        onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } },
      })
      : h('input', { name: key, type: 'text', required: required ? true : null, autocomplete: 'off' });
    input.value = data[key] || '';
    inputs[key] = input;
    if (kind === 'emoji') return symbolField(label, input, err);
    if (kind === 'icon') {
      const preview = iconImg(data.url || '', data.icon || '');
      input.placeholder = 'Image URL, or upload a file. Empty: site favicon';
      input.addEventListener('input', () => { preview.src = input.value || T.faviconFor(inputs.url.value); });
      const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
      file.addEventListener('change', async () => {
        const f = file.files[0];
        file.value = '';
        if (!f) return;
        try {
          input.value = await imageToDataUrl(f);
          input.dispatchEvent(new Event('input'));
          err.textContent = '';
        } catch { err.textContent = 'Could not read that image.'; }
      });
      return h('label', {}, label, h('div', { class: 'icon-preview' }, preview, input, file,
        h('button', { class: 'btn small', type: 'button', onclick: () => file.click() }, 'Upload'),
        btn(icon('close'), 'Clear', () => { input.value = ''; input.dispatchEvent(new Event('input')); })));
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
      $('#editor-cancel').removeEventListener('click', onCancel);
      dlg.removeEventListener('close', onCancel);
      if (dlg.open) dlg.close();
      resolve(v);
    };
    const onCancel = () => finish(null);
    const onSubmit = (e) => {
      e.preventDefault();
      const v = {};
      for (const [k, el] of Object.entries(inputs)) v[k] = k === 'note' || k === 'description' ? el.value : el.value.trim();
      if ('url' in v) {
        v.url = T.normalizeUrl(v.url);
        if (!v.url) return void (err.textContent = 'URL is required.');
        try { new URL(v.url); } catch { return void (err.textContent = 'URL is not valid.'); }
        if (!v.name) v.name = v.url;
      }
      if (!v.name) return void (err.textContent = 'Name is required.');
      if ('symbol' in v) v.symbol = T.normalizeSymbol(v.symbol);
      if ('symbol' in v && !T.isValidSymbol(v.symbol)) return void (err.textContent = 'Symbol must be one emoji, letter or digit.');
      finish(v);
    };
    form.addEventListener('submit', onSubmit);
    $('#editor-cancel').addEventListener('click', onCancel);
    dlg.addEventListener('close', onCancel);
    dlg.showModal();
    (inputs.url && !data.url ? inputs.url : inputs.name).focus();
  });
}

async function editNode(node) {
  const v = await openEditor(node.type, node);
  if (v) apply({ op: 'patch', id: node.id, fields: v });
}

async function addWorkspace() {
  const v = await openEditor('workspace', {}, 'New workspace');
  if (!v) return;
  const [id] = (await apply({ op: 'create', parentId: null, node: { type: 'workspace', ...v, categories: [{ type: 'category', name: 'General' }] } })) || [];
  if (id) select(id);
}

async function addCategory(ws) {
  const v = await openEditor('category', {}, 'New category');
  if (!v) return;
  const [id] = (await apply({ op: 'create', parentId: ws.id, node: { type: 'category', ...v } })) || [];
  if (id) select(ws.id, id);
}

async function addNode(type, parentId, title, extra = {}) {
  const v = await openEditor(type, {}, title);
  if (v) apply({ op: 'create', parentId, node: { type, ...extra, ...v } });
}
// A new group in `column`: before group `beforeId`, or at the end of that column.
async function addGroup(cat, column = null, { beforeId = null } = {}) {
  const v = await openEditor('group', {}, 'New group');
  if (v) apply({ op: 'create', parentId: cat.id, index: columnIndex(cat, column, { beforeId }), node: { type: 'group', column, ...v } });
}
const addLink = (parentId) => addNode('link', parentId, 'New link');
const addFolder = (parentId) => addNode('folder', parentId, 'New folder');

/* ---------- context menu ---------- */

function showMenu(e, entries) {
  e.preventDefault();
  e.stopPropagation();
  const menu = $('#menu');
  menu.replaceChildren(...entries.filter(Boolean).map((it) => (it === '-' ? h('hr') :
    h('button', { class: it.danger ? 'danger' : '', onclick: () => { hideMenu(); it.fn(); } }, it.icon && icon(it.icon), it.label))));
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(e.clientX, innerWidth - r.width - 8) + 'px';
  menu.style.top = Math.min(e.clientY, innerHeight - r.height - 8) + 'px';
}
function hideMenu() { $('#menu').hidden = true; }

function nodeMenu(e, node) {
  const n = T.countLinks(node);
  const open = n ? [{ icon: 'open', label: `Open all (${n})`, fn: () => openAll(node) },
    { icon: 'window', label: 'Open all in new window', fn: () => openAll(node, true) }] : [];
  const del = { icon: 'trash', label: 'Delete', danger: true, fn: () => deleteNode(node) };
  const edit = { icon: 'edit', label: 'Edit…', fn: () => editNode(node) };
  const menus = {
    workspace: [edit, { icon: 'category', label: 'New category', fn: () => addCategory(node) }, ...open,
      { icon: 'download', label: 'Export…', fn: () => exportData(node.id) }, '-', del],
    category: [edit, { icon: 'group', label: 'New group', fn: () => addGroup(node) }, ...open, '-', del],
    group: [edit, { icon: 'note', label: 'Edit note', fn: () => startNoteEdit(node.id) },
      { icon: 'link', label: 'Add link', fn: () => addLink(node.id) }, { icon: 'folder', label: 'Add folder', fn: () => addFolder(node.id) },
      { icon: 'tabs', label: 'Add all tabs of this window', fn: () => addWindowTabs(node.id) },
      ...open, { icon: 'sort', label: 'Sort links by name', fn: () => sortItems(node) },
      { icon: 'dedupe', label: 'Remove duplicate links', fn: () => dedupeLinks(node) }, '-', del],
    folder: [edit, { icon: 'link', label: 'Add link', fn: () => addLink(node.id) }, T.folderDepth(state, node.id) < T.MAX_FOLDER_DEPTH && { icon: 'folder', label: 'Add subfolder', fn: () => addFolder(node.id) },
      ...open, { icon: 'sort', label: 'Sort links by name', fn: () => sortItems(node) }, '-', del],
    link: [{ icon: 'open', label: 'Open', fn: () => openLink(node) }, { icon: 'window', label: 'Open in new window', fn: () => openLink(node, { shiftKey: true }) },
      edit, { icon: 'copy', label: 'Copy URL', fn: () => navigator.clipboard.writeText(node.url).then(() => toast('URL copied')) }, '-', del],
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
  toast(`Removed ${removed} duplicate link${removed === 1 ? '' : 's'}`);
}

/* ================= drag & drop ================= */

const line = $('#drop-line');
let intoEl = null;

function clearIndicator() {
  line.hidden = true;
  intoEl?.classList.remove('drop-into');
  intoEl = null;
  document.querySelector('.add-group.drop-new')?.classList.remove('drop-new');
}

function showIndicator(t) {
  clearIndicator();
  if (!t) return;
  if (t.line) {
    Object.assign(line.style, { left: t.line.x + 'px', top: t.line.y + 'px', width: t.line.w + 'px', height: t.line.h + 'px' });
    line.hidden = false;
  } else if (t.mode === 'newGroup') {
    t.el?.classList.add('drop-new'); // the column's New group card stands for "new group"
  } else if (t.el) {
    intoEl = t.el;
    intoEl.classList.add('drop-into');
  }
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
    return { mode: 'newGroup', categoryId: cat.id, column: storedColumn(cat, +board.dataset.cols, +col.dataset.col),
      el: col.querySelector('.add-group') };
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
    const cards = [...col.querySelectorAll(':scope > .group')].filter((c) => c.dataset.id !== d.id);
    const card = el.closest('.group');
    if (card && card.dataset.id === d.id) return null;
    if (card) {
      // top / bottom edge: place before / after; the middle offers to merge the groups
      const r = card.getBoundingClientRect();
      const edge = Math.min(36, r.height * 0.25);
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

// Moves group `id` into `column` of its category: before `beforeId`, after `afterId`, or to the end.
function moveToColumn(id, t) {
  const cat = T.locate(state, t.categoryId).node;
  const index = columnIndex(cat, t.column, { beforeId: t.beforeId, afterId: t.afterId, skip: id });
  return apply({ op: 'move', id, parentId: cat.id, index }, { op: 'patch', id, fields: { column: t.column } });
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
    return [{ op: 'create', parentId: t.categoryId, index: columnIndex(cat, t.column, { beforeId: t.beforeId }),
      node: { type: 'group', name: groupName || 'New group', column: t.column ?? null } }];
  }
  return [];
}

async function performDrop(d, t, e) {
  if (t.action === 'open') {
    const r = T.locate(state, d.id);
    if (r) await run(B.call('openUrls', { urls: T.collectLinks(r.node).map((l) => l.url), windowId: t.windowId }));
    return;
  }
  if (t.action === 'merge') return mergeGroups(d.id, t.targetId);
  if (t.action === 'column') return moveToColumn(d.id, t);
  const pre = targetOps(t, d.kind === 'window' ? `Window ${new Date().toLocaleString()}` : null);
  const parentId = pre.length ? '$0' : t.parentId;

  if (d.kind === 'node') {
    await apply(...pre, { op: 'move', id: d.id, parentId, index: t.index });
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
    title: `Merge “${label(from)}” into “${label(into)}”?`,
    text: `Its ${n} link${n === 1 ? '' : 's'}, folders and note move to “${label(into)}”, then “${label(from)}” is removed.`,
    ok: 'Merge',
  }))) return;
  const note = [into.note, from.note].filter((n) => n && n.trim()).join('\n\n---\n\n');
  const snapshot = structuredClone(state);
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
    drag = { kind: 'tab', tabIds: [+src.dataset.tab] };
    dt.setData('text/plain', src.dataset.url || '');
  } else if (src.matches('.win-head')) {
    drag = { kind: 'window', windowId: +src.closest('.win').dataset.window };
    dt.setData('text/plain', 'tabcat-window');
  } else {
    const el = src.closest('[data-id]');
    if (!el) return;
    drag = { kind: 'node', id: el.dataset.id, type: el.dataset.type };
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
  endDrag();
  if (t) performDrop(d, t, e).catch((err) => toast('Drop failed: ' + err.message));
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
}

function fillSettings() {
  const f = $('#settings-form');
  f.closeOnSave.checked = settings.closeOnSave;
  f.autoSuspendMinutes.value = settings.autoSuspendMinutes;
  f.theme.value = settings.theme;
  f.columns.value = boardColumns();
}

function openSettings() {
  fillSettings();
  $('#settings').showModal();
}

$('#settings-form').addEventListener('change', async (e) => {
  if (e.target.id === 'import-file') return;
  const f = e.currentTarget;
  const s = await run(B.call('saveSettings', {
    closeOnSave: f.closeOnSave.checked,
    autoSuspendMinutes: Math.max(0, parseInt(f.autoSuspendMinutes.value, 10) || 0),
    theme: f.theme.value,
    columns: Math.min(MAX_COLUMNS, Math.max(1, parseInt(f.columns.value, 10) || 3)),
  }));
  if (s) { settings = s; applyTheme(); renderCats(); renderBoard(); }
});

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
    $('#picker-count').textContent = `${n} of ${leaves.length} selected`;
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
      kids.length ? Object.assign(btn('▾', 'Expand / collapse', () => li.classList.toggle('closed')), { className: 'icon-btn twisty' })
        : h('span', { class: 'twisty-gap' }),
      h('label', {}, box,
        symbolEl(node.symbol, node.type === 'category' ? '🏷️' : node.type === 'workspace' ? '🗃️' : '🗂️'),
        h('span', { class: 'name' }, node.name || '(untitled)'),
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
    title: 'Export data', ok: 'Export', workspaces: data.workspaces,
    initial: (ws) => !onlyId || ws.id === onlyId,
  });
  if (!workspaces) return;
  const name = workspaces.length === 1 && slug(workspaces[0].name) ? `tabcat-${slug(workspaces[0].name)}-${today()}.json` : `tabcat-${today()}.json`;
  download(name, { app: 'tabcat', kind: 'data', exportedAt: new Date().toISOString(), version: data.version, workspaces });
}

async function readJson(file) {
  try { return JSON.parse(await file.text()); } catch { throw new Error('not a JSON file'); }
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
    if (!list.length) throw new Error('no workspaces found');
    const picked = await pickNodes({ title: `Import from ${file.name}`, ok: 'Import', workspaces: list });
    if (!picked) return;
    await B.apply(...picked.map((node) => ({ op: 'create', parentId: null, node })));
    toast(`Imported ${picked.length} workspace${picked.length === 1 ? '' : 's'}`);
  } catch (err) {
    toast('Import failed: ' + err.message);
  }
});

// Portable settings: per-machine values (dashboard address, last used group) stay out of the file.
const SETTINGS_IO = {
  closeOnSave: (v) => typeof v === 'boolean',
  autoSuspendMinutes: (v) => Number.isInteger(v) && v >= 0,
  theme: (v) => ['auto', 'light', 'dark'].includes(v),
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
    if (raw.kind !== 'settings' || !raw.settings) throw new Error('not a tabcat settings file');
    const patch = Object.fromEntries(Object.entries(SETTINGS_IO)
      .filter(([k, ok]) => ok(raw.settings[k])).map(([k]) => [k, raw.settings[k]]));
    if (!Object.keys(patch).length) throw new Error('no valid settings found');
    const s = await B.call('saveSettings', patch);
    settings = s;
    applyTheme();
    fillSettings();
    toast('Settings imported');
  } catch (err) {
    toast('Import failed: ' + err.message);
  }
});

/* ================= wiring ================= */

$('#add-ws').addEventListener('click', addWorkspace);
$('#btn-settings').addEventListener('click', openSettings);

/* ---------- side panels: collapse and resize ---------- */

// Tooltips: every [title] outside dialogs shows in one styled tooltip (the native title is parked in
// data-tip while it is up). First line is the label, further lines are details. Rows of the side panels
// (and anything in a collapsed rail) show beside the panel; everything else shows below the element.
const tip = $('#tip');
const RAILS = 'body.ws-collapsed #sidebar, body.tabs-collapsed #tabs-panel';
const BESIDE = '.ws-item, .tab-row, .win-head';
const TIP_DELAY = 350;
let tipEl = null;
let tipTimer = null;
let tipHiddenAt = 0;

function hideTip() {
  clearTimeout(tipTimer);
  if (tipEl?.dataset.trunc) { delete tipEl.dataset.trunc; delete tipEl.dataset.tip; } // a borrowed full-name tip
  else if (tipEl?.dataset.tip != null) { tipEl.title = tipEl.dataset.tip; delete tipEl.dataset.tip; }
  if (!tip.hidden) tipHiddenAt = Date.now();
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
  const el = e.target instanceof Element ? e.target.closest('[title], [data-tip]') : null;
  if (el === tipEl) return;
  hideTip();
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
  ws: { el: '#sidebar', toggle: '#ws-toggle', width: 'wsWidth', collapsed: 'wsCollapsed', min: 160, max: 420, name: 'workspaces' },
  tabs: { el: '#tabs-panel', toggle: '#tabs-toggle', width: 'tabsWidth', collapsed: 'tabsCollapsed', min: 200, max: 520, name: 'open tabs' },
};

function applyPanels() {
  for (const [key, p] of Object.entries(PANELS)) {
    const collapsed = !!ui[p.collapsed];
    document.body.classList.toggle(`${key}-collapsed`, collapsed);
    document.body.style.setProperty(`--${key}-w`, ui[p.width] ? ui[p.width] + 'px' : null);
    $(p.toggle).title = `${collapsed ? 'Expand' : 'Collapse'} ${p.name}`;
  }
}

for (const p of Object.values(PANELS)) {
  $(p.toggle).addEventListener('click', () => {
    ui[p.collapsed] = !ui[p.collapsed];
    hideTip();
    applyPanels();
    // if the pointer is still on the button, show its new label right away
    const under = pointer && document.elementFromPoint(...pointer);
    if (under && $(p.toggle).contains(under)) showTip($(p.toggle));
    saveUi();
  });
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
  if (n != null) toast(`Closed ${n} duplicate tab${n === 1 ? '' : 's'}`);
});

const search = $('#search');
search.addEventListener('input', () => { query = search.value.trim(); renderBoard(); });
search.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { clearSearch(); renderBoard(); search.blur(); }
  if (e.key === 'Enter') $('#board .result')?.click();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideMenu();
  const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
  if (!typing && (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
    e.preventDefault();
    search.focus();
    search.select();
  }
});
document.addEventListener('click', (e) => { if (!e.target.closest('#menu')) hideMenu(); });
document.addEventListener('scroll', hideMenu, true);
window.addEventListener('blur', hideMenu);

// push events from the extension
B.on('state', (s) => { state = s; render(); });
B.on('settings', (s) => {
  const relayout = s.columns !== settings?.columns;
  settings = s;
  applyTheme();
  if (relayout && state) render(); // e.g. columns changed in another dashboard tab
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
  applyTheme();
  render();
  renderTabs();
}

// Oldest extension this dashboard works with (an older one silently drops newer fields).
const MIN_EXTENSION = '0.2.0';
const olderThan = (a, b) => {
  const [x, y] = [a, b].map((v) => String(v).split('.').map(Number));
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0);
  return false;
};

async function init() {
  hydrateIcons();
  applyPanels();
  const ext = await B.connect();
  if (!ext) return showNoExtension();
  $('#no-ext').hidden = true;
  if (olderThan(ext.version, MIN_EXTENSION)) {
    toast(`The tabcat extension (${ext.version}) is older than this dashboard needs (${MIN_EXTENSION}): reload or update it.`);
  }
  await refresh();
}

$('#no-ext-retry').addEventListener('click', () => location.reload());
init();
