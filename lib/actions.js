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
  return !!url && ((url.startsWith(dashboardBase) && /^(index\.html)?([?#]|$)/.test(url.slice(dashboardBase.length)))
    || /^(chrome|edge|brave):\/\/newtab\/?$/.test(url));
}

export function isSaveable(tab) {
  const url = tab.url || tab.pendingUrl;
  return !!url && !isDashboard(url) && !url.startsWith('about:blank');
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

// A tab as undo keeps it, to open it again where it was (see reopenTabs)
export const tabInfo = ({ id, url, windowId, index, pinned, groupId }) => ({ id, url, windowId, index, pinned, groupId });

// Tabs whose URL (ignoring the #fragment) another tab has open: the ones closeDuplicates would close
export function duplicateTabs(tabs) {
  const seen = new Set();
  const dupes = [];
  // keep the active tab of each url if possible
  for (const t of [...tabs].sort((a, b) => Number(b.active) - Number(a.active))) {
    const key = (t.url || '').replace(/#.*$/, '');
    if (!key || isDashboard(key)) continue;
    if (seen.has(key)) dupes.push(t);
    else seen.add(key);
  }
  return dupes;
}

// Closes duplicate tabs; returns them as they were (for undo)
export async function closeDuplicates() {
  const dupes = duplicateTabs(await chrome.tabs.query({}));
  if (dupes.length) await chrome.tabs.remove(dupes.map((t) => t.id));
  return dupes.map(tabInfo);
}

// Opens closed tabs again where they were (window, place, tab group; a window or group gone since:
// the current window / no group); returns them with their new ids
export async function reopenTabs(tabs) {
  const out = [];
  for (const t of [...tabs].sort((a, b) => a.index - b.index)) {
    const windowId = await chrome.windows.get(t.windowId).then((w) => w.id, () => undefined);
    const tab = await chrome.tabs.create({ windowId, url: t.url, index: windowId == null ? undefined : t.index, pinned: t.pinned, active: false });
    if (t.groupId > -1 && windowId != null) await chrome.tabs.group({ groupId: t.groupId, tabIds: [tab.id] }).catch(() => {});
    out.push({ ...t, id: tab.id, windowId: tab.windowId });
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
