// Tab-level operations shared by background, popup and dashboard.
import * as S from './store.js';
import { t } from './i18n.js';

// Base URL of the web dashboard (kept in sync with settings.dashboardUrl by the background worker).
let dashboardBase = S.DEFAULT_SETTINGS.dashboardUrl;
export function setDashboardUrl(url) {
  try { const u = new URL(url); dashboardBase = u.origin + u.pathname.replace(/[^/]*$/, ''); } catch { /* keep previous */ }
}
export const dashboardUrl = () => dashboardBase;

export function isDashboard(url) {
  return !!url && (url.startsWith(dashboardBase) || /^(chrome|edge|brave):\/\/newtab\/?$/.test(url));
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

export async function closeDuplicates() {
  const tabs = await chrome.tabs.query({});
  const seen = new Map();
  const dupes = [];
  // keep the active tab of each url if possible
  tabs.sort((a, b) => Number(b.active) - Number(a.active));
  for (const t of tabs) {
    const key = (t.url || '').replace(/#.*$/, '');
    if (!key || isDashboard(key)) continue;
    if (seen.has(key)) dupes.push(t.id);
    else seen.set(key, t.id);
  }
  if (dupes.length) await chrome.tabs.remove(dupes);
  return dupes.length;
}

// Discard (unload from memory) inactive tabs. olderThanMs filters by lastAccessed.
export async function suspendTabs({ windowId, olderThanMs = 0 } = {}) {
  const tabs = await chrome.tabs.query(windowId ? { windowId } : {});
  const now = Date.now();
  let n = 0;
  for (const t of tabs) {
    if (t.active || t.discarded || t.audible || t.pinned) continue;
    if (!/^https?:/.test(t.url || '')) continue;
    if (olderThanMs && t.lastAccessed && now - t.lastAccessed < olderThanMs) continue;
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
