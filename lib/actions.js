// Tab-level operations shared by background, popup and dashboard.
import * as S from './store.js';
import { t } from './i18n.js';

// Base URL of the web dashboard (kept in sync with settings.dashboardUrl by the background worker).
let dashboardBase = S.DEFAULT_SETTINGS.dashboardUrl;
export function setDashboardUrl(url) {
  try { const u = new URL(url); dashboardBase = u.origin + u.pathname.replace(/[^/]*$/, ''); } catch { /* keep previous */ }
}
export const dashboardUrl = () => dashboardBase;

// (the dashboard page itself, not the other pages beside it, such as privacy.html)
export function isDashboard(url) {
  return !!url && url.startsWith(dashboardBase) && /^(index\.html)?([?#]|$)/.test(url.slice(dashboardBase.length));
}
// A browser's new tab page (or a blank one)
export const NEW_TAB = /^($|about:(blank|newtab)$|[a-z-]+:\/\/(newtab|new-tab-page)\b)/;
export const isNewTab = (url) => NEW_TAB.test(url || '');

export function isSaveable(tab) {
  const url = tab.url || tab.pendingUrl;
  return !!url && !isDashboard(url) && !url.startsWith('about:blank'); // (a new tab page can be saved too)
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Close tabs without leaving their windows empty: if a window would close, open the dashboard first.
export async function closeTabsSafely(tabIds) {
  if (!tabIds.length) return;
  const tabs = await chrome.tabs.query({});
  const byWindow = new Map();
  for (const t of tabs) {
    if (!byWindow.has(t.windowId)) byWindow.set(t.windowId, []);
    byWindow.get(t.windowId).push(t.id);
  }
  const closing = new Set(tabIds);
  for (const [windowId, ids] of byWindow) {
    if (ids.length && ids.every((id) => closing.has(id))) {
      await chrome.tabs.create({ windowId, url: dashboardBase, active: true });
    }
  }
  await chrome.tabs.remove(tabIds);
}

/**
 * Save tabs as links.
 * opts.parentId  – group/folder id to insert into (default: settings.lastGroupId / first group)
 * opts.index     – insert position (default: end)
 * opts.newGroup  – { categoryId, name, index } create a new group instead
 * opts.close     – close tabs afterwards (default: settings.closeOnSave)
 */
export async function saveTabs(tabs, opts = {}) {
  tabs = tabs.filter(isSaveable);
  if (!tabs.length) return null;
  const settings = await S.loadSettings();
  setDashboardUrl(settings.dashboardUrl);
  tabs = tabs.filter(isSaveable);
  if (!tabs.length) return null;
  const close = opts.close ?? settings.closeOnSave;
  const target = await S.update((state) => {
    const links = tabs.map(S.linkFromTab);
    let parentId = opts.parentId;
    if (opts.newGroup) {
      let catId = opts.newGroup.categoryId;
      const cat = catId && S.locate(state, catId);
      if (!cat || cat.node.type !== 'category') {
        const gid = S.ensureGroup(state, settings.lastGroupId);
        catId = S.locate(state, gid).parent.id;
      }
      const g = S.makeGroup({ name: opts.newGroup.name || t('savedAt', { date: stamp() }), symbol: opts.newGroup.symbol || '', column: opts.newGroup.column });
      S.insertNode(state, catId, g, opts.newGroup.index);
      parentId = g.id;
    }
    if (!parentId || !S.locate(state, parentId)) parentId = S.ensureGroup(state, settings.lastGroupId, { allowFolder: true });
    const parent = S.locate(state, parentId).node;
    const list = S.children(parent);
    if (parent.type === 'group' && !list.length) parent.collapsed = false; // first links: show them
    let index = opts.index ?? list.length;
    for (const l of links) list.splice(index++, 0, l);
    return parentId;
  });
  if (close) await closeTabsSafely(tabs.map((t) => t.id));
  return target;
}

export async function saveWindow(windowId, opts = {}) {
  const tabs = await chrome.tabs.query({ windowId });
  return saveTabs(tabs.filter((t) => !t.pinned), { ...opts, newGroup: opts.newGroup || {} });
}

// Tabs as undo keeps them, to open them again where they were (see reopenTabs): with their tab group's
// look, to make the group again if it's gone by then
export async function tabInfos(tabs) {
  const looks = new Map();
  for (const id of new Set(tabs.map((t) => t.groupId).filter((g) => g > -1))) {
    const g = await chrome.tabGroups?.get(id).catch(() => null);
    if (g) looks.set(id, { title: g.title || '', color: g.color });
  }
  return tabs.map(({ id, url, pendingUrl, windowId, index, pinned, groupId }) => ({
    id, url: url || pendingUrl || '', windowId, index, pinned, groupId, ...(looks.has(groupId) && { group: looks.get(groupId) }),
  }));
}

// Tabs whose URL (ignoring the #fragment) another tab has open: the ones closeDuplicates would close
export function duplicateTabs(tabs) {
  const seen = new Set();
  const dupes = [];
  // keep the active tab of each url if possible
  for (const t of [...tabs].sort((a, b) => Number(b.active) - Number(a.active))) {
    const key = (t.url || '').replace(/#.*$/, '');
    if (!key || isDashboard(key) || isNewTab(key)) continue; // (new tabs are left alone)
    if (seen.has(key)) dupes.push(t);
    else seen.add(key);
  }
  return dupes;
}

// Closes duplicate tabs; returns them as they were (for undo)
export async function closeDuplicates() {
  const dupes = duplicateTabs(await chrome.tabs.query({}));
  const closed = await tabInfos(dupes);
  if (dupes.length) await chrome.tabs.remove(dupes.map((t) => t.id));
  return closed;
}

// Opens closed tabs again where they were: in their window, at their place, in their tab group. A window
// closed since: they open together in a new one; a tab group gone: it's made again, as it looked.
// Returns them with their new ids, windows and groups.
export async function reopenTabs(tabs) {
  const out = [];
  const windows = new Map(); // old window id -> { id, fresh } (fresh: opened for them, tabs go at its end)
  const groups = new Map(); // `${old window}:${old group}` -> new group id
  for (const t of [...tabs].sort((a, b) => a.windowId - b.windowId || a.index - b.index)) {
    let win = windows.get(t.windowId);
    let tab;
    if (!win) {
      const open = await chrome.windows.get(t.windowId).then((w) => w.id, () => null);
      if (open == null) {
        const w = await chrome.windows.create({ url: t.url, focused: true });
        win = { id: w.id, fresh: true };
        tab = w.tabs[0];
        if (t.pinned) await chrome.tabs.update(tab.id, { pinned: true }).catch(() => {});
      } else win = { id: open, fresh: false };
      windows.set(t.windowId, win);
    }
    tab ??= await chrome.tabs.create({ windowId: win.id, url: t.url, index: win.fresh ? undefined : t.index, pinned: t.pinned, active: false });
    let groupId = -1;
    if (t.groupId > -1 && chrome.tabGroups) {
      const key = `${t.windowId}:${t.groupId}`;
      if (groups.has(key)) groupId = await chrome.tabs.group({ groupId: groups.get(key), tabIds: [tab.id] }).catch(() => -1);
      else {
        // the group still there (in the same window), or a new one like it
        groupId = win.fresh ? -1 : await chrome.tabs.group({ groupId: t.groupId, tabIds: [tab.id] }).catch(() => -1);
        if (groupId < 0 && t.group) {
          groupId = await chrome.tabs.group({ tabIds: [tab.id], createProperties: { windowId: win.id } }).catch(() => -1);
          if (groupId > -1) await chrome.tabGroups.update(groupId, { title: t.group.title, color: t.group.color }).catch(() => {});
        }
        if (groupId > -1) groups.set(key, groupId);
      }
    }
    out.push({ ...t, id: tab.id, windowId: win.id, index: tab.index, groupId });
  }
  return out;
}

// Tabs suspendTabs would unload: inactive web pages, not playing sound or pinned (olderThanMs: not
// looked at for that long)
export function suspendableTabs(tabs, olderThanMs = 0) {
  const now = Date.now();
  return tabs.filter((t) => !t.active && !t.discarded && !t.audible && !t.pinned && /^https?:/.test(t.url || '')
    && !(olderThanMs && t.lastAccessed && now - t.lastAccessed < olderThanMs));
}

// Discard (unload from memory) inactive tabs. olderThanMs filters by lastAccessed.
export async function suspendTabs({ windowId, olderThanMs = 0 } = {}) {
  let n = 0;
  for (const t of suspendableTabs(await chrome.tabs.query(windowId ? { windowId } : {}), olderThanMs)) {
    try { await chrome.tabs.discard(t.id); n++; } catch { /* tab may refuse */ }
  }
  return n;
}

export async function openLinks(links, { newWindow = false, active = false } = {}) {
  const urls = links.map((l) => l.url).filter(Boolean);
  if (!urls.length) return;
  if (newWindow) {
    await chrome.windows.create({ url: urls, focused: true });
    return;
  }
  for (let i = 0; i < urls.length; i++) {
    await chrome.tabs.create({ url: urls[i], active: active && i === 0 });
  }
}
