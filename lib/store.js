// tabcat data model & persistence (shared by background, popup and dashboard)
//
// state = { version, workspaces: [Workspace] }
//   Workspace { id, type:'workspace', name, symbol, description, categories: [Category] }
//   Category  { id, type:'category',  name, groups: [Group] }
//   Group     { id, type:'group',     name, symbol, note, collapsed, column, items: [Folder|Link] }   (column: board column index, or null = automatic)
//   Folder    { id, type:'folder',    name, symbol, collapsed, items: [Folder|Link] }
//   Link      { id, type:'link',      url, name, icon, description, createdAt }

export const KEY = 'tabcat';
export const SETTINGS_KEY = 'tabcat:settings';
export const VERSION = 1;

export const DEFAULT_SETTINGS = {
  closeOnSave: true,        // close tabs after saving them into a group
  autoSuspendMinutes: 0,    // discard inactive tabs after N minutes (0 = off)
  theme: 'auto',            // auto | light | dark
  accent: 'orange',         // accent colour: one of the ten in the dashboard's Settings
  columns: 3,               // board columns per row in the dashboard (1–7)
  lastGroupId: null,        // last group or folder used by popup / context menu
  dashboardUrl: 'https://tabcat.ghyeok.com/', // where the web dashboard is served (updated when it connects)
};

// which child types each parent accepts ('root' = top level)
export const ACCEPTS = {
  root: ['workspace'],
  workspace: ['category'],
  category: ['group'],
  group: ['link', 'folder'],
  folder: ['link', 'folder'],
};

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ---------- constructors ---------- */

export const makeWorkspace = (p = {}) => ({
  id: uid(), type: 'workspace', name: p.name || 'Workspace', symbol: p.symbol || '',
  description: p.description || '', categories: p.categories || [],
});
// Board layout: the dashboard shows settings.columns columns; a group sits in column `column`
// (null until placed: pinned round-robin by position on load).
export const MAX_COLUMNS = 7;
const toColumn = (v) => (Number.isInteger(v) && v >= 0 && v < MAX_COLUMNS ? v : null);

export const makeCategory = (p = {}) => ({
  id: uid(), type: 'category', name: p.name || 'Category', groups: p.groups || [],
});
export const makeGroup = (p = {}) => ({
  id: uid(), type: 'group', name: p.name || 'Group', symbol: p.symbol || '',
  note: p.note || '', collapsed: false, column: toColumn(p.column), items: p.items || [],
});
export const makeFolder = (p = {}) => ({
  id: uid(), type: 'folder', name: p.name || 'Folder', symbol: p.symbol || '',
  collapsed: false, items: p.items || [],
});
export const makeLink = (p = {}) => ({
  id: uid(), type: 'link', url: p.url || '', name: p.name || p.url || 'Untitled',
  icon: p.icon || '', description: p.description || '', createdAt: Date.now(),
});

export function linkFromTab(tab) {
  const icon = tab.favIconUrl && /^(https?:|data:image\/)/.test(tab.favIconUrl) ? tab.favIconUrl : '';
  return makeLink({ url: tab.url || tab.pendingUrl, name: tab.title || tab.url, icon });
}

export function defaultState() {
  return {
    version: VERSION,
    workspaces: [
      makeWorkspace({
        name: 'My Workspace', symbol: '🐱', description: '',
        categories: [makeCategory({ name: 'General', groups: [makeGroup({ name: 'Inbox', symbol: '📥' })] })],
      }),
    ],
  };
}

/* ---------- tree helpers ---------- */

export function children(node) {
  if (!node) return null;
  switch (node.type) {
    case 'workspace': return node.categories;
    case 'category': return node.groups;
    case 'group':
    case 'folder': return node.items;
    default: return null;
  }
}

// Returns { node, list, index, parent, ancestors } or null.
export function locate(state, id) {
  const stack = [];
  function rec(list, parent) {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.id === id) return { node: n, list, index: i, parent, ancestors: [...stack] };
      const c = children(n);
      if (c) {
        stack.push(n);
        const r = rec(c, n);
        stack.pop();
        if (r) return r;
      }
    }
    return null;
  }
  return rec(state.workspaces, null);
}

export function walk(list, cb, ancestors = []) {
  for (const n of list) {
    cb(n, ancestors);
    const c = children(n);
    if (c) walk(c, cb, [...ancestors, n]);
  }
}

// Folders nest at most MAX_FOLDER_DEPTH deep (a folder directly in a group is at depth 1).
export const MAX_FOLDER_DEPTH = 4;

// Levels of folders in `node` itself (0 for a link, 1 for a folder without subfolders, ...).
export const folderHeight = (n) =>
  (n?.type === 'folder' ? 1 + Math.max(0, ...(n.items || []).map(folderHeight)) : 0);

// How many folders enclose the list of `parentId` (0 inside a group).
export function folderDepth(state, parentId) {
  const r = parentId && locate(state, parentId);
  return r ? [...r.ancestors, r.node].filter((n) => n.type === 'folder').length : 0;
}

export const fitsDepth = (state, parentId, node) => folderDepth(state, parentId) + folderHeight(node) <= MAX_FOLDER_DEPTH;

export function contains(node, id) {
  let found = false;
  const c = children(node);
  if (c) walk(c, (n) => { if (n.id === id) found = true; });
  return found;
}

export function countLinks(node) {
  let n = 0;
  const c = children(node);
  if (c) walk(c, (x) => { if (x.type === 'link') n++; });
  return n;
}

export function collectLinks(node) {
  if (node.type === 'link') return [node];
  const out = [];
  const c = children(node);
  if (c) walk(c, (x) => { if (x.type === 'link') out.push(x); });
  return out;
}

export function allGroups(state) {
  const out = [];
  for (const ws of state.workspaces)
    for (const cat of ws.categories)
      for (const g of cat.groups) out.push({ ws, cat, group: g });
  return out;
}

// Every place links can be saved into: groups and (nested) folders, in tree order.
// Each entry: { ws, cat, group, node, depth, trail } where trail is the group/folder names above node.
export function allTargets(state) {
  const out = [];
  const folders = (items, base, depth, trail) => {
    for (const n of items) {
      if (n.type !== 'folder') continue;
      out.push({ ...base, node: n, depth, trail });
      folders(n.items, base, depth + 1, [...trail, n.name]);
    }
  };
  for (const { ws, cat, group } of allGroups(state)) {
    out.push({ ws, cat, group, node: group, depth: 0, trail: [] });
    folders(group.items, { ws, cat, group }, 1, [group.name]);
  }
  return out;
}

// Move node `id` into parent `parentId` (null = root) at `index`. Returns true on success.
export function moveNode(state, id, parentId, index) {
  const src = locate(state, id);
  if (!src) return false;
  let parent = null, list = state.workspaces;
  if (parentId) {
    const p = locate(state, parentId);
    if (!p) return false;
    parent = p.node;
    list = children(parent);
  }
  if (!ACCEPTS[parent ? parent.type : 'root'].includes(src.node.type)) return false;
  if (parent && (parent.id === id || contains(src.node, parent.id))) return false;
  if (!fitsDepth(state, parentId, src.node)) return false;
  if (parent?.type === 'group' && !list.length) parent.collapsed = false; // first item: show it
  // `index` refers to positions before removal; compensate when moving within the same list
  if (index == null || index > list.length) index = list.length;
  if (list === src.list && index > src.index) index--;
  src.list.splice(src.index, 1);
  list.splice(index, 0, src.node);
  return true;
}

export function insertNode(state, parentId, node, index) {
  let list = state.workspaces, type = 'root';
  if (parentId) {
    const p = locate(state, parentId);
    if (!p) return false;
    list = children(p.node);
    type = p.node.type;
  }
  if (!ACCEPTS[type].includes(node.type)) return false;
  if (!fitsDepth(state, parentId, node)) return false;
  if (index == null || index > list.length) index = list.length;
  if (type === 'group' && !list.length) locate(state, parentId).node.collapsed = false; // first item: show it
  list.splice(index, 0, node);
  return true;
}

export function removeNode(state, id) {
  const r = locate(state, id);
  if (!r) return null;
  r.list.splice(r.index, 1);
  return r.node;
}

// Deep copy with fresh ids (used for import / duplicate).
export function reId(node) {
  const copy = { ...node, id: uid() };
  for (const k of ['categories', 'groups', 'items']) if (Array.isArray(node[k])) copy[k] = node[k].map(reId);
  return copy;
}

// Make sure at least one group exists; return the preferred group id (or the first one).
// Returns the id of a group to insert into: `preferredId` if it still exists (a folder is also
// accepted with allowFolder), otherwise the first group, creating the default tree if needed.
export function ensureGroup(state, preferredId, { allowFolder = false } = {}) {
  if (preferredId) {
    const r = locate(state, preferredId);
    if (r && (r.node.type === 'group' || (allowFolder && r.node.type === 'folder'))) return preferredId;
  }
  if (!state.workspaces.length) state.workspaces.push(makeWorkspace({ name: 'My Workspace', symbol: '🐱' }));
  const ws = state.workspaces[0];
  if (!ws.categories.length) ws.categories.push(makeCategory({ name: 'General' }));
  const cat = ws.categories[0];
  if (!cat.groups.length) cat.groups.push(makeGroup({ name: 'Inbox', symbol: '📥' }));
  return cat.groups[0].id;
}

/* ---------- validation ---------- */

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;

let RGI_EMOJI = null;
try { RGI_EMOJI = new RegExp('^\\p{RGI_Emoji}$', 'v'); } catch { /* no /v flag support */ }

export function isSingleEmoji(s) {
  if (!s) return true; // symbol is optional
  if (RGI_EMOJI?.test(s)) return true;
  const graphemes = segmenter ? [...segmenter.segment(s)].length : [...s].length;
  return graphemes === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(s);
}

// A symbol is optional: a single emoji, or one capital letter / digit (shown as a badge).
export const isLetterSymbol = (s) => /^[A-Z0-9]$/.test(s);
export const normalizeSymbol = (s) => {
  s = String(s ?? '').trim();
  return /^[a-z]$/.test(s) ? s.toUpperCase() : s;
};
export const isValidSymbol = (s) => !s || isLetterSymbol(s) || isSingleEmoji(s);

export function normalizeUrl(u) {
  u = (u || '').trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  return u;
}

export function normalizeNode(n) {
  if (!n || typeof n !== 'object' || !ACCEPTS.root.concat(...Object.values(ACCEPTS)).includes(n.type)) return null;
  const base = { workspace: makeWorkspace, category: makeCategory, group: makeGroup, folder: makeFolder, link: makeLink }[n.type]();
  const out = { ...base, ...n, id: n.id || base.id };
  if ('symbol' in base) out.symbol = isValidSymbol(normalizeSymbol(n.symbol)) ? normalizeSymbol(n.symbol) : '';
  if ('column' in base) out.column = toColumn(n.column);
  for (const k of ['categories', 'groups', 'items']) {
    if (k in base) out[k] = (Array.isArray(n[k]) ? n[k] : []).map(normalizeNode).filter(Boolean);
  }
  // pin unplaced groups to the column they are shown in, so later edits don't reshuffle them
  if (out.type === 'category') out.groups.forEach((g, i) => { if (g.column == null) g.column = i % DEFAULT_SETTINGS.columns; });
  return out;
}

export function normalize(raw) {
  if (!raw || !Array.isArray(raw.workspaces)) return defaultState();
  return { version: VERSION, workspaces: raw.workspaces.map(normalizeNode).filter((n) => n && n.type === 'workspace') };
}

/* ---------- ops (sent by the web dashboard) ---------- */

const PATCHABLE = {
  workspace: ['name', 'symbol', 'description'],
  category: ['name'],
  group: ['name', 'symbol', 'note', 'collapsed', 'column', 'items'],
  folder: ['name', 'symbol', 'collapsed', 'items'],
  link: ['url', 'name', 'icon', 'description'],
};

// Apply one op to `state` in place. Returns an op-specific result (e.g. the created id).
//   { op:'create', parentId, node, index }  -> new id
//   { op:'patch',  id, fields }             -> true
//   { op:'move',   id, parentId, index }    -> true/false
//   { op:'remove', id }                     -> true/false
//   { op:'firstGroup', categoryId }         -> id of first group (created if missing)
//   { op:'firstCategory', workspaceId }     -> id of first category (created if missing)
//   { op:'replace', state }                 -> true (used for undo / import)
export function applyOp(state, o) {
  switch (o.op) {
    case 'create': {
      const n = normalizeNode(o.node);
      const node = n && reId(n); // always fresh ids (imports may contain duplicates)
      if (!node || !insertNode(state, o.parentId || null, node, o.index)) throw new Error('cannot create here');
      return node.id;
    }
    case 'patch': {
      const r = locate(state, o.id);
      if (!r) throw new Error('not found');
      for (const k of PATCHABLE[r.node.type]) {
        if (!(k in o.fields)) continue;
        if (k === 'items') {
          r.node.items = o.fields.items.map(normalizeNode).filter((n) => n && ACCEPTS[r.node.type].includes(n.type));
        } else if (k === 'collapsed') r.node.collapsed = !!o.fields.collapsed;
        else if (k === 'symbol') r.node.symbol = normalizeSymbol(o.fields.symbol);
        else if (k === 'column') r.node.column = toColumn(o.fields.column);
        else r.node[k] = String(o.fields[k] ?? '');
      }
      if (!isValidSymbol(r.node.symbol)) throw new Error('Symbol must be one emoji, letter or digit');
      return true;
    }
    case 'move': return moveNode(state, o.id, o.parentId || null, o.index);
    case 'remove': return !!removeNode(state, o.id);
    case 'firstGroup': {
      const c = locate(state, o.categoryId);
      if (!c || c.node.type !== 'category') throw new Error('category not found');
      if (!c.node.groups.length) c.node.groups.push(makeGroup({ name: 'Inbox', symbol: '📥' }));
      return c.node.groups[0].id;
    }
    case 'firstCategory': {
      const w = locate(state, o.workspaceId);
      if (!w || w.node.type !== 'workspace') throw new Error('workspace not found');
      if (!w.node.categories.length) w.node.categories.push(makeCategory({ name: 'General' }));
      return w.node.categories[0].id;
    }
    case 'replace':
      state.workspaces = normalize(o.state).workspaces;
      return true;
    default:
      throw new Error('unknown op ' + o.op);
  }
}

// Apply a list of ops in order. A string "$n" in id/parentId refers to the result of op n.
export function applyOps(state, ops) {
  const results = [];
  const ref = (v) => (typeof v === 'string' && /^\$\d+$/.test(v) ? results[+v.slice(1)] : v);
  for (const o of ops) results.push(applyOp(state, { ...o, id: ref(o.id), parentId: ref(o.parentId) }));
  return results;
}

/* ---------- persistence ---------- */

export async function load() {
  const r = await chrome.storage.local.get(KEY);
  return normalize(r[KEY]);
}

export async function save(state) {
  await chrome.storage.local.set({ [KEY]: state });
}

let chain = Promise.resolve();
// Serialized read-modify-write. `fn` mutates the state in place and may return a value.
export function update(fn) {
  const run = chain.then(async () => {
    const state = await load();
    const result = await fn(state);
    if (result !== false) await save(state);
    return result;
  });
  chain = run.catch(() => {});
  return run;
}

export async function loadSettings() {
  const r = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(r[SETTINGS_KEY] || {}) };
}

export async function saveSettings(patch) {
  const s = { ...(await loadSettings()), ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: s });
  return s;
}

export function faviconFor(pageUrl, size = 32) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl || '');
  u.searchParams.set('size', String(size));
  return u.toString();
}
