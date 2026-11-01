import * as S from './lib/store.js';
import * as A from './lib/actions.js';
import * as I from './lib/i18n.js';

/* ================= setup ================= */

// The toolbar icon in the accent colour, as the pages draw the logo. The packaged icons are the logo in
// the default accent, which keeps the drawing's lightness: painting another hue over them ('color')
// gives the same as painting it over the drawing itself.
async function tintActionIcon() {
  const { accent } = await S.loadSettings();
  const imageData = {};
  for (const n of [16, 32]) {
    const bmp = await createImageBitmap(await (await fetch(`icons/icon${n}.png`)).blob());
    const g = new OffscreenCanvas(n, n).getContext('2d');
    g.drawImage(bmp, 0, 0);
    g.globalCompositeOperation = 'color';
    g.fillStyle = S.accentColor(accent);
    g.fillRect(0, 0, n, n);
    g.globalCompositeOperation = 'destination-in'; // back to the logo's shape
    g.drawImage(bmp, 0, 0);
    imageData[n] = g.getImageData(0, 0, n, n);
  }
  await chrome.action.setIcon({ imageData }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(async () => {
  await init(); // sets the language first, so the seeded names are in it
  // seed initial data
  const r = await chrome.storage.local.get(S.KEY);
  if (!r[S.KEY]) await S.save(S.defaultState());
});

// Context menu entries, titled in the current language; rebuilt when the language changes.
const MENUS = [
  ['go-tabcat', 'menuOpen', ['action']],
  ['save-tab', 'menuSaveTab', ['page', 'action']],
  ['save-link', 'menuSaveLink', ['link']],
  ['save-window', 'menuSaveWindow', ['page', 'action']],
  ['suspend', 'menuSuspend', ['page', 'action']],
  ['dedupe', 'menuDedupe', ['action']],
];
let menus = Promise.resolve();
function buildMenus() {
  // chained: two overlapping rebuilds would create the same ids twice
  menus = menus.then(() => new Promise((done) => chrome.contextMenus.removeAll(() => {
    for (const [id, key, contexts] of MENUS) chrome.contextMenus.create({ id, title: I.t(key), contexts }, () => void chrome.runtime.lastError);
    done();
  })));
  return menus;
}

// Closes tabs (or a whole window), remembered: undo opens them again where they were. Returns the
// history entry's id (for the dashboard's toast), or true when there was nothing to remember.
async function closeTabs(tabs, what, close = () => chrome.tabs.remove(tabs.map((t) => t.id))) {
  const keep = tabs.filter((t) => (t.url || t.pendingUrl) && !A.isDashboard(t.url || t.pendingUrl) && !A.isNewTab(t.url || t.pendingUrl)); // (a new tab: nothing to bring back)
  const closed = await A.tabInfos(keep);
  await close();
  if (!closed.length) return true;
  const id = S.uid();
  await withHistory((h) => pushChange(h, { id, what: { ...what, n: closed.length }, closed }));
  return id;
}

/* ================= recently deleted ================= */

// What was deleted from the board (links, folders, groups, categories, workspaces), kept 30 days to be
// put back one by one, or deleted for good. Newest first, each { id, node, parentId, index, trail,
// deletedAt }: the node as it was, its place, and its ancestors then ({ id, type, name, symbol },
// outermost first). An entry whose node is on the board again (an undo or Restore put it back) isn't
// listed, but stays, so undoing that brings it back to the list; deleted again, a new entry replaces it.
const TRASH_KEY = 'tabcat:trash';
const TRASH_DAYS = 30;
let trashChain = Promise.resolve();
function withTrash(fn) { // serialized; `fn` may change the list in place (entries past 30 days: gone)
  const run = trashChain.then(async () => {
    const since = Date.now() - TRASH_DAYS * 864e5;
    const list = ((await chrome.storage.local.get(TRASH_KEY))[TRASH_KEY] || []).filter((e) => e.deletedAt >= since);
    const out = await fn(list);
    await chrome.storage.local.set({ [TRASH_KEY]: list });
    return out;
  });
  trashChain = run.catch(() => {});
  return run;
}
function trashEntry(state, id) {
  const r = S.locate(state, id);
  if (!r) return null;
  return {
    id: S.uid(), node: structuredClone(r.node), parentId: r.parent?.id ?? null, index: r.index, deletedAt: Date.now(),
    trail: r.ancestors.map(({ id: aid, type, name, symbol }) => ({ id: aid, type, name: name || '', symbol: symbol || '' })),
  };
}
async function addToTrash(entries) {
  // (one inside another deleted at the same time is in that one already)
  const ids = new Set(entries.map((e) => e.node.id));
  const add = entries.filter((e) => !e.trail.some((a) => ids.has(a.id)));
  await withTrash((list) => {
    const again = new Set(add.map((e) => e.node.id));
    list.splice(0, list.length, ...add.reverse(), ...list.filter((e) => !again.has(e.node.id)));
  });
  broadcast('trash');
}
// Puts a deleted node back in its place; that gone, into the nearest of its old ancestors still there
// (into its first group, say, for a link whose group is gone, keeping it in its workspace); failing all
// of them, the first group (the Inbox), category or workspace there is.
function putBack(state, e) {
  const node = structuredClone(e.node);
  if (S.insertNode(state, e.parentId, node, e.index)) return true;
  // the first place under `n` that can hold the node, going down by first children
  const into = (n) => {
    for (let c = n; c; c = S.children(c)?.[0]) if (S.ACCEPTS[c.type]?.includes(node.type)) return c;
    return null;
  };
  for (const a of e.trail.slice(0, -1).reverse()) {
    const r = S.locate(state, a.id);
    const at = r && into(r.node);
    if (at && S.insertNode(state, at.id, node, at.id === a.id ? null : 0)) return true;
  }
  if (node.type === 'workspace') return S.insertNode(state, null, node, e.index);
  S.ensureGroup(state, null);
  const at = into(state.workspaces[0]);
  return !!at && S.insertNode(state, at.id, node, 0);
}
const trashHandlers = {
  // the entries not on the board again, newest first
  getTrash: () => withTrash(async (list) => {
    const state = await S.load();
    return list.filter((e) => !S.locate(state, e.node.id));
  }),
  // puts entry `id` back (remembered, for undo); returns the node's id, or null
  restoreTrash: ({ id }) => withTrash(async (list) => {
    const e = list.find((x) => x.id === id);
    if (!e) return null;
    const before = await S.load();
    if (S.locate(before, e.node.id)) return null;
    if (!(await S.update((state) => putBack(state, e)))) return null;
    await withHistory(async (h) => pushChange(h, { id: await snap(before), data: true, what: { verb: 'restore', type: e.node.type, n: 1 } }));
    broadcast('trash');
    return e.node.id;
  }),
  // deletes entry `id` for good, or every one (`id` left out)
  async emptyTrash({ id } = {}) {
    await withTrash((list) => { list.splice(0, list.length, ...(id == null ? [] : list.filter((e) => e.id !== id))); });
    broadcast('trash');
    return true;
  },
};

chrome.runtime.onStartup.addListener(init);
init();
chrome.runtime.onInstalled.addListener(retirePinnedDashboards);
// newly installed: the dashboard comes up (and offers its tour)
chrome.runtime.onInstalled.addListener(({ reason }) => { if (reason === 'install') openDashboard(); });
tintActionIcon();
relinkAll(); // tab groups restored before the worker woke up (a browser restart)

async function init() {
  const s = await S.loadSettings();
  I.setLang(s.language);
  A.setDashboardUrl(s.dashboardUrl);
  await buildMenus();
  await chrome.alarms.clear('autosuspend');
  if (s.autoSuspendMinutes > 0) chrome.alarms.create('autosuspend', { periodInMinutes: 1 });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'autosuspend') return;
  const s = await S.loadSettings();
  if (s.autoSuspendMinutes > 0) await A.suspendTabs({ olderThanMs: s.autoSuspendMinutes * 60_000 });
});

/* ================= the dashboard ================= */

const isDashTab = (t) => A.isDashboard(t.url || t.pendingUrl || '');

// The pinned dashboard (a setting until 0.2.11) is gone: the dashboard opens as an app window or a tab
// when wanted. Ones pinned before go once: the one a window is showing becomes a plain tab.
async function retirePinnedDashboards() {
  const s = (await chrome.storage.local.get(S.SETTINGS_KEY))[S.SETTINGS_KEY];
  if (!s || !('pinDashboard' in s)) return;
  if (s.pinDashboard) {
    const tabs = (await chrome.tabs.query({ pinned: true })).filter(isDashTab);
    for (const t of tabs.filter((t) => t.active)) await chrome.tabs.update(t.id, { pinned: false }).catch(() => {});
    const rest = tabs.filter((t) => !t.active).map((t) => t.id);
    if (rest.length) await chrome.tabs.remove(rest).catch(() => {});
  }
  const { pinDashboard, ...kept } = s;
  await chrome.storage.local.set({ [S.SETTINGS_KEY]: kept });
}

// The dashboard comes to you: shortcut, popup, menu, or its address typed / a link to it, it shows in the
// window you're in as that window's first tab, pinned (just an icon there). There is one: opened, or moved
// over from another window (as it is: no reload), or pinned if it was a plain tab. Nothing else is
// imposed: unpin it or close it as you like. The shortcut also goes back: pressed on the dashboard, it
// returns to the tab it was pressed on. (That tab is kept in session storage: the worker may sleep
// between the two presses.)
const CAME_FROM = 'tabcat:cameFrom';
async function dashboardHere(windowId, keep = null) {
  const s = await S.loadSettings();
  A.setDashboardUrl(s.dashboardUrl);
  // (an installed app window's dashboard can't move into a browser window: only tabs count)
  const dash = (await chrome.tabs.query({ windowType: 'normal' })).filter((t) => isDashTab(t) && t.id !== keep)
    .sort((a, b) => b.pinned - a.pinned)[0];
  if (dash) {
    if (dash.windowId !== windowId) await chrome.tabs.move(dash.id, { windowId, index: 0 });
    await chrome.tabs.update(dash.id, { pinned: true, active: true });
    await chrome.tabs.move(dash.id, { index: 0 });
  } else await chrome.tabs.create({ windowId, url: s.dashboardUrl, pinned: true, index: 0 });
  await chrome.windows.update(windowId, { focused: true });
}
// Pinned, it stays the window's first tab: another tab pinned, dragged or moved in ahead of it, it goes
// back in front. (While a tab is being dragged, tabs can't be moved: it tries again a moment later.)
async function keepDashboardFirst(windowId) {
  A.setDashboardUrl((await S.loadSettings()).dashboardUrl);
  for (let i = 0; i < 10; i++) {
    const tabs = await chrome.tabs.query({ windowId, pinned: true }).catch(() => []);
    const dash = tabs.find(isDashTab);
    if (!dash || dash.index === 0) return;
    if (await chrome.tabs.move(dash.id, { index: 0 }).then(() => true, () => false)) continue;
    await new Promise((r) => setTimeout(r, 200));
  }
}
chrome.tabs.onMoved.addListener((id, { windowId }) => keepDashboardFirst(windowId));
chrome.tabs.onAttached.addListener((id, { newWindowId }) => keepDashboardFirst(newWindowId));
chrome.tabs.onUpdated.addListener((id, change, tab) => { if ('pinned' in change) keepDashboardFirst(tab.windowId); });
chrome.tabs.onCreated.addListener((tab) => { if (tab.pinned) keepDashboardFirst(tab.windowId); });
// The window to bring it to: the tab's, unless that has no tab strip (a popup): the last browser window
async function windowFor(tab) {
  if (tab && (await chrome.windows.get(tab.windowId)).type === 'normal') return tab.windowId;
  return (await chrome.windows.getLastFocused({ windowTypes: ['normal'] })).id;
}
const activeTab = async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
async function toggleDashboard(tab) {
  tab ??= await activeTab();
  A.setDashboardUrl((await S.loadSettings()).dashboardUrl);
  if (tab && isDashTab(tab)) {
    const from = (await chrome.storage.session.get(CAME_FROM))[CAME_FROM];
    const back = from != null && await chrome.tabs.get(from).catch(() => null); // (closed since: stay)
    if (back) {
      await chrome.tabs.update(back.id, { active: true });
      await chrome.windows.update(back.windowId, { focused: true });
    }
    return;
  }
  if (tab) await chrome.storage.session.set({ [CAME_FROM]: tab.id });
  await dashboardHere(await windowFor(tab));
}
async function openDashboard() {
  const tab = await activeTab();
  if (tab && !isDashTab(tab)) await chrome.storage.session.set({ [CAME_FROM]: tab.id });
  await dashboardHere(await windowFor(tab));
}

// Going to its address (typed, a bookmark, a link) brings it the same way, and the tab that went there
// goes back to what it showed. A new tab, with nothing to go back to, becomes the dashboard if there is
// none yet, else closes. (What each tab showed is kept in session storage, for a worker woken by the
// visit: from when the browser starts or the extension is installed, and as tabs open; a tab opened
// straight onto the dashboard counts as a new one. Not known: it goes back if it can, else closes.)
const SHOWN = 'tabcat:tabUrls';
let shownChain = Promise.resolve();
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (!change.url) return;
  const step = shownChain.then(async () => {
    const shown = (await chrome.storage.session.get(SHOWN))[SHOWN] || {};
    const before = shown[tabId];
    shown[tabId] = change.url;
    await chrome.storage.session.set({ [SHOWN]: shown });
    A.setDashboardUrl((await S.loadSettings()).dashboardUrl);
    if (!isDashTab(tab) || before === change.url || (before && A.isDashboard(before))) return; // (not a visit: moves within it)
    // (pinned: it is the dashboard already, e.g. the one dashboardHere just opened; or the app window)
    if (tab.pinned || (await chrome.windows.get(tab.windowId)).type !== 'normal') return;
    const others = (await chrome.tabs.query({ windowType: 'normal' })).filter((t) => t.id !== tabId && isDashTab(t));
    const wasNew = before == null ? !others.length : A.isNewTab(before); // (not known: see above)
    if (wasNew && !others.length) { // this new tab becomes the dashboard
      await chrome.tabs.update(tabId, { pinned: true });
      await chrome.tabs.move(tabId, { index: 0 });
      return;
    }
    await dashboardHere(tab.windowId, tabId);
    if (wasNew) return void chrome.tabs.remove(tabId);
    // (the visit is reported as it starts: there is a page to go back to only once it commits)
    let back = false;
    for (let i = 0; i < 15 && !back; i++) {
      back = await chrome.tabs.goBack(tabId).then(() => true, () => false);
      if (!back) await new Promise((r) => setTimeout(r, 100));
    }
    if (back) await chrome.storage.session.set({ [CAME_FROM]: tabId }); // (the shortcut goes back there)
    else await chrome.tabs.remove(tabId).catch(() => {});
  });
  shownChain = step.catch(() => {});
});
// (tabs not known yet: what they show now; one opening straight onto the dashboard: as a new tab)
function recordShown(tabs) {
  shownChain = shownChain.then(async () => {
    const shown = (await chrome.storage.session.get(SHOWN))[SHOWN] || {};
    A.setDashboardUrl((await S.loadSettings()).dashboardUrl);
    for (const t of tabs) {
      const url = t.url || t.pendingUrl || '';
      if (!(t.id in shown)) shown[t.id] = A.isDashboard(url) ? '' : url;
    }
    await chrome.storage.session.set({ [SHOWN]: shown });
  }).catch(() => {});
}
chrome.tabs.onCreated.addListener((tab) => recordShown([tab]));
const seedShown = async () => recordShown(await chrome.tabs.query({}));
chrome.runtime.onStartup.addListener(seedShown);
chrome.runtime.onInstalled.addListener(seedShown);
chrome.tabs.onRemoved.addListener((tabId) => {
  shownChain = shownChain.then(async () => {
    const shown = (await chrome.storage.session.get(SHOWN))[SHOWN] || {};
    if (!(tabId in shown)) return;
    delete shown[tabId];
    await chrome.storage.session.set({ [SHOWN]: shown });
  }).catch(() => {});
});

/* ================= context menu & shortcuts ================= */

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'go-tabcat':
      await openDashboard();
      break;
    case 'save-tab':
      if (tab) await saveTabs([tab]);
      break;
    case 'save-link': {
      const s = await S.loadSettings();
      await S.update((state) => {
        const gid = S.ensureGroup(state, s.lastGroupId, { allowFolder: true });
        S.insertNode(state, gid, S.makeLink({ url: info.linkUrl, name: info.selectionText || info.linkUrl }));
      });
      break;
    }
    case 'save-window':
      if (tab) await saveWindow(tab.windowId);
      break;
    case 'suspend':
      await A.suspendTabs({ windowId: tab?.windowId });
      break;
    case 'dedupe':
      await closeDuplicates();
      break;
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'save-tab') {
    const [t] = tab ? [tab] : await chrome.tabs.query({ active: true, currentWindow: true });
    if (t) await saveTabs([t]);
  } else if (command === 'save-window') {
    const w = await chrome.windows.getLastFocused();
    await saveWindow(w.id);
  } else if (command === 'open-dashboard') {
    await toggleDashboard(tab);
  }
});

/* ================= RPC (popup messages + dashboard bridge) ================= */

// Every handler receives (args, senderTab). senderTab is the dashboard's own tab when called via the bridge.
// tabcat group colours are Chrome's tab group colours (the plain card -> grey; older names mapped)
const TAB_GROUP_COLOR = {
  red: 'red', orange: 'orange', yellow: 'yellow', green: 'green', cyan: 'cyan', blue: 'blue', purple: 'purple', pink: 'pink',
  lime: 'green', teal: 'cyan', sky: 'blue',
};

// Tab groups opened from a group or folder keep following its name, emoji and colour: tab group id ->
// node id, in session storage (tab group ids don't outlive the browser session).
const TAB_GROUPS_KEY = 'tabcat:tabGroups';
const tabGroupMap = async () => (await chrome.storage.session.get(TAB_GROUPS_KEY))[TAB_GROUPS_KEY] || {};
// A restored tab group (a reopened window, a browser restart, a saved tab group opened again) comes
// back with a new id, so each group / folder's tab group title and colour are also kept (node id ->
// { title, color }, lasting): a new tab group that matches exactly one of them is linked again.
const TAB_LINKS_KEY = 'tabcat:tabGroupLinks';
const tabGroupLinks = async () => (await chrome.storage.local.get(TAB_LINKS_KEY))[TAB_LINKS_KEY] || {};
async function rememberTabGroup(groupId, nodeId, look) {
  const m = await tabGroupMap();
  m[groupId] = nodeId;
  await chrome.storage.session.set({ [TAB_GROUPS_KEY]: m });
  if (look) {
    const links = await tabGroupLinks();
    links[nodeId] = look;
    await chrome.storage.local.set({ [TAB_LINKS_KEY]: links });
  }
}
async function relinkTabGroup(g) {
  if (!g.title || (await tabGroupMap())[g.id] != null) return;
  const links = await tabGroupLinks();
  const state = await S.load();
  const hits = new Set();
  for (const [nodeId, was] of Object.entries(links)) {
    const now = tabGroupLook(state, nodeId);
    if (!now) continue; // (deleted)
    if ([was, now].some((l) => l.title === g.title && l.color === g.color)) hits.add(nodeId);
  }
  if (hits.size !== 1) return; // none, or can't tell which
  const [nodeId] = hits;
  await rememberTabGroup(g.id, nodeId, null);
  await syncTabGroups(state); // (catches up with a rename made while it was closed... if it was found)
}
async function relinkAll() {
  if (!chrome.tabGroups) return;
  for (const g of await chrome.tabGroups.query({})) await relinkTabGroup(g);
}
// a folder takes the colour of the group it is in; an emoji symbol leads the title (the logo as a cat; not a letter)
function tabGroupLook(state, nodeId) {
  const r = S.locate(state, nodeId);
  if (!r) return null;
  const n = r.node;
  const group = n.type === 'group' ? n : r.ancestors.find((a) => a.type === 'group');
  return { title: S.textSymbol(n.symbol) ? `${S.textSymbol(n.symbol)} ${n.name}` : n.name || '', color: TAB_GROUP_COLOR[group?.color] || 'grey' };
}
async function syncTabGroups(state, saved = true) {
  if (!chrome.tabGroups) return;
  const m = await tabGroupMap();
  const links = await tabGroupLinks();
  let gone = false;
  for (const [id, nodeId] of Object.entries(m)) {
    const look = tabGroupLook(state, nodeId);
    if (!look) continue; // (the group or folder was deleted: its tab group is left as it is)
    try {
      const g = await chrome.tabGroups.get(+id);
      if (g.title !== look.title || g.color !== look.color) await chrome.tabGroups.update(+id, look);
      if (saved) links[nodeId] = look; // (not an unsaved preview)
    } catch { delete m[id]; gone = true; } // the tab group was closed
  }
  for (const nodeId of Object.keys(links)) if (saved && !S.locate(state, nodeId)) delete links[nodeId];
  if (gone) await chrome.storage.session.set({ [TAB_GROUPS_KEY]: m });
  if (saved) await chrome.storage.local.set({ [TAB_LINKS_KEY]: links });
}
chrome.tabGroups?.onCreated.addListener((g) => relinkTabGroup(g));
chrome.tabGroups?.onUpdated.addListener((g) => relinkTabGroup(g));
chrome.tabGroups?.onRemoved.addListener(async (g) => {
  const m = await tabGroupMap();
  if (!(g.id in m)) return;
  delete m[g.id];
  await chrome.storage.session.set({ [TAB_GROUPS_KEY]: m });
});

/* ================= undo / redo ================= */

// One history for every open dashboard, so Ctrl+Z in any of them undoes the last delete / move made in
// any. An entry is the whole state from before a change (the last 50 kept); undoing puts it back and
// keeps the state it replaces for redo. Undoing an older one (from its toast) undoes what came after it.
// Each state is stored under its own key (they can be large); their order in HISTORY_KEY. Cleared when
// the browser starts. Closing tabs (duplicates) is in it too: such an entry keeps the tabs instead
// (`closed`: opened again on undo; `opened`: closed again on redo).
const HISTORY_KEY = 'tabcat:history';
const SNAP = 'tabcat:snap:';
const HISTORY_MAX = 50;
let historyChain = Promise.resolve();
function withHistory(fn) { // serialized: two tabs undoing at once take turns
  const run = historyChain.then(async () => {
    const h = (await chrome.storage.local.get(HISTORY_KEY))[HISTORY_KEY] || { undo: [], redo: [] };
    const out = await fn(h);
    await chrome.storage.local.set({ [HISTORY_KEY]: h });
    return out;
  });
  historyChain = run.catch(() => {});
  return run;
}
const dropSnaps = (entries) => entries.length && chrome.storage.local.remove(entries.map((e) => SNAP + e.id));
async function snap(state) {
  const id = S.uid();
  await chrome.storage.local.set({ [SNAP + id]: state });
  return id;
}
// Puts back what `entry` kept (the state, closed tabs, or both), returning a new entry that keeps what
// it replaced (for redo, or undo again)
async function restore(entry) {
  const out = { id: S.uid(), what: entry.what };
  if (entry.closed) out.opened = await A.reopenTabs(entry.closed);
  if (entry.opened) {
    await chrome.tabs.remove(entry.opened.map((t) => t.id)).catch(() => {});
    out.closed = entry.opened;
  }
  if (entry.data) {
    const before = (await chrome.storage.local.get(SNAP + entry.id))[SNAP + entry.id];
    if (!before) return null;
    await S.update(async (state) => {
      await chrome.storage.local.set({ [SNAP + out.id]: structuredClone(state) });
      S.applyOp(state, { op: 'replace', state: before });
    });
    out.data = true;
  }
  return out;
}
// A new change: on top of the undo list (the oldest falls off past HISTORY_MAX); nothing left to redo
function pushChange(h, entry) {
  h.undo.push(entry);
  const dropped = [...h.redo, ...h.undo.splice(0, Math.max(0, h.undo.length - HISTORY_MAX))];
  h.redo = [];
  return dropSnaps(dropped);
}
const historyHandlers = {
  // `before`: the state from before a change just made; `what` names it for the toasts. Returns its id.
  remember: ({ before, what }) => withHistory(async (h) => {
    const id = await snap(S.normalize(before));
    await pushChange(h, { id, data: true, what: what ?? null });
    return id;
  }),
  // the last change, or the one with `id` (and everything after it); returns { what } or null
  undo: ({ id } = {}) => withHistory(async (h) => {
    const i = id == null ? h.undo.length - 1 : h.undo.findIndex((e) => e.id === id);
    if (i < 0) return null;
    // (an older data change put back takes the later ones with it, though closing tabs alone stays
    // undoable; closed tabs opened again take nothing else with them)
    const gone = h.undo[i].data ? h.undo.splice(i) : h.undo.splice(i, 1);
    const back = await restore(gone[0]);
    await dropSnaps(gone);
    if (gone.length > 1) h.undo.push(...gone.slice(1).filter((e) => !e.data));
    if (!back) return null;
    h.redo.push(back);
    return { what: back.what };
  }),
  redo: () => withHistory(async (h) => {
    const entry = h.redo.pop();
    if (!entry) return null;
    const back = await restore(entry);
    await dropSnaps([entry]);
    if (!back) return null;
    h.undo.push(back);
    return { what: back.what };
  }),
};
// Closes duplicate tabs, remembered for undo; returns how many
// Saves tabs (closing them, as set), remembered: undo takes the links out and opens the tabs again
async function saveTabs(tabs, opts = {}, save = () => A.saveTabs(tabs, opts)) {
  const settings = await S.loadSettings();
  A.setDashboardUrl(settings.dashboardUrl);
  const saving = tabs.filter(A.isSaveable);
  const before = await S.load();
  const result = await save();
  if (result == null || !saving.length) return result;
  const close = opts.close ?? settings.closeOnSave;
  const closed = close && await A.tabInfos(saving);
  await withHistory(async (h) => pushChange(h, {
    id: await snap(before), data: true, what: { verb: 'save', n: saving.length }, ...(close && { closed }),
  }));
  return result;
}
async function saveWindow(windowId, opts = {}) {
  const tabs = (await chrome.tabs.query({ windowId })).filter((t) => !t.pinned);
  return saveTabs(tabs, opts, () => A.saveWindow(windowId, opts));
}

async function closeDuplicates() {
  const closed = await A.closeDuplicates();
  if (closed.length) await withHistory((h) => pushChange(h, { id: S.uid(), what: { verb: 'closeDupes' }, closed }));
  return closed.length;
}
chrome.runtime.onStartup.addListener(() => withHistory(async (h) => {
  await dropSnaps([...h.undo, ...h.redo]);
  h.undo = []; h.redo = [];
}));

const handlers = {
  ...historyHandlers,
  getState: () => S.load(),
  getSettings: () => S.loadSettings(),
  saveSettings: (patch) => S.saveSettings(patch),
  // ops: array of store ops, applied atomically; returns array of results. A remove marked `trash` (a
  // delete) keeps what it removed in Recently deleted.
  async apply(ops) {
    const gone = [];
    const results = await S.update((state) => {
      for (const o of ops) if (o.op === 'remove' && o.trash) gone.push(trashEntry(state, o.id));
      return S.applyOps(state, ops);
    });
    if (gone.some(Boolean)) await addToTrash(gone.filter(Boolean));
    return results;
  },
  ...trashHandlers,

  async getTabs(_args, senderTab) {
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    const groupsBy = Map.groupBy((await chrome.tabGroups?.query({}).catch(() => [])) || [], (g) => g.windowId);
    for (const [w, gs] of groupsBy) groupsBy.set(w, gs.map(({ id, title, color, collapsed }) => ({ id, title: title || '', color, collapsed })));
    return {
      currentWindowId: senderTab?.windowId ?? null,
      windows: windows.map((w) => ({
        id: w.id,
        focused: w.focused,
        tabs: w.tabs
          .filter((t) => t.id !== senderTab?.id && !A.isDashboard(t.url || t.pendingUrl))
          .map((t) => ({
            id: t.id, windowId: t.windowId, url: t.url || t.pendingUrl || '', title: t.title || '',
            favIconUrl: t.favIconUrl || '', active: t.active, pinned: t.pinned, discarded: t.discarded, audible: t.audible,
            groupId: t.groupId ?? -1,
          })),
        // its tab groups: { id, title, color, collapsed }
        groups: groupsBy.get(w.id) || [],
      })),
    };
  },
  async saveTabs({ tabIds, tabs, ...opts }) {
    if (tabIds) tabs = (await Promise.all(tabIds.map((id) => chrome.tabs.get(id).catch(() => null)))).filter(Boolean);
    return saveTabs(tabs || [], opts);
  },
  saveWindow: ({ windowId, ...opts }) => saveWindow(windowId, opts),
  closeDuplicates: () => closeDuplicates(),
  suspendTabs: (args) => A.suspendTabs(args || {}),
  // `groups` ([{ title, color, urls }], optional): open those instead, each set in its own tab group
  // named after it (older dashboards send only `urls`)
  async openUrls({ urls, groups, newWindow, windowId, active }, senderTab) {
    const ok = (u) => /^(https?|ftp|file|chrome|edge|brave|about):/i.test(u);
    const sets = groups?.length && chrome.tabGroups
      ? groups.map((g) => ({ ...g, urls: (g.urls || []).filter(ok) })).filter((g) => g.urls.length)
      : [{ urls: (urls || []).filter(ok) }];
    const all = sets.flatMap((g) => g.urls);
    if (!all.length) return 0;
    let tabIds;
    if (newWindow) {
      const w = await chrome.windows.create({ url: all, focused: true });
      tabIds = w.tabs.map((t) => t.id);
    } else {
      // open next to the dashboard tab, in the requested (or dashboard's) window
      const target = windowId ?? senderTab?.windowId;
      tabIds = [];
      for (let i = 0; i < all.length; i++) {
        tabIds.push((await chrome.tabs.create({ url: all[i], windowId: target, active: !!active && i === 0 })).id);
      }
    }
    let at = 0;
    for (const g of sets) {
      const ids = tabIds.slice(at, at += g.urls.length);
      if (!('title' in g) || !ids.length) continue;
      try {
        const groupId = await chrome.tabs.group({ tabIds: ids });
        await chrome.tabGroups.update(groupId, { title: g.title || '', color: TAB_GROUP_COLOR[g.color] || 'grey', collapsed: false });
        if (g.id) await rememberTabGroup(groupId, g.id, { title: g.title || '', color: TAB_GROUP_COLOR[g.color] || 'grey' });
      } catch { /* left ungrouped (e.g. the window closed meanwhile) */ }
    }
    return all.length;
  },
  // the dashboard's group / folder editor, as it is edited: its tab groups follow the unsaved
  // fields (`fields` null: back to the saved ones)
  async previewTabGroups({ id, fields }) {
    if (!Object.keys(await tabGroupMap()).length) return true;
    let state = await S.load();
    if (fields) {
      state = structuredClone(state);
      const r = S.locate(state, id);
      if (r) Object.assign(r.node, fields);
    }
    await syncTabGroups(state, !fields);
    return true;
  },
  // wake suspended tabs without switching to them (reloading a discarded tab loads it in the background)
  async wakeTabs({ tabIds }) {
    let n = 0;
    for (const id of tabIds) {
      try { await chrome.tabs.reload(id); n++; } catch { /* closed meanwhile */ }
    }
    return n;
  },
  async activateTab({ tabId }) {
    const t = await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(t.windowId, { focused: true });
    return true;
  },
  async closeTabs({ tabIds }) {
    const tabs = (await Promise.all(tabIds.map((id) => chrome.tabs.get(id).catch(() => null)))).filter(Boolean);
    return closeTabs(tabs, { verb: 'closeTabs' });
  },
  // unload the given tabs from memory (the active tab of a window can't be discarded and is skipped)
  async discardTabs({ tabIds }) {
    let n = 0;
    for (const id of tabIds) {
      try { if (await chrome.tabs.discard(id)) n++; } catch { /* active or not discardable */ }
    }
    return n;
  },
  // move the given tabs, in order, into one new window
  async moveToNewWindow({ tabIds }) {
    if (!tabIds?.length) return null;
    const win = await chrome.windows.create({ tabId: tabIds[0], focused: false });
    if (tabIds.length > 1) await chrome.tabs.move(tabIds.slice(1), { windowId: win.id, index: -1 });
    return win.id;
  },
  async closeWindow({ windowId }) {
    return closeTabs(await chrome.tabs.query({ windowId }), { verb: 'closeWindow' }, () => chrome.windows.remove(windowId));
  },
  openDashboard: () => openDashboard(),
  // { command name: its keys ('' when none: Chrome leaves one unset whose keys another extension has) }
  getShortcuts: () => chrome.commands.getAll().then((cs) => Object.fromEntries(cs.map((c) => [c.name, c.shortcut || '']))),
};

async function handle(msg, senderTab) {
  const fn = handlers[msg?.cmd];
  if (!fn) throw new Error('unknown command ' + msg?.cmd);
  return fn(msg.args || {}, senderTab);
}

// popup → background (popup closes as soon as tabs are created/closed, so it delegates here)
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  handle(msg, sender.tab).then((result) => respond({ result }), (e) => respond({ error: e.message }));
  return true;
});

// dashboard bridge: content.js opens a long-lived port per dashboard tab
const ports = new Set();

chrome.runtime.onConnect.addListener(async (port) => {
  if (port.name !== 'tabcat-bridge' || !port.sender?.tab) return;
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));
  port.onMessage.addListener(async (msg) => {
    try {
      const result = await handle(msg, port.sender.tab);
      port.postMessage({ reply: msg.id, result });
    } catch (e) {
      port.postMessage({ reply: msg.id, error: e.message });
    }
  });
  // remember where the dashboard lives so the popup / shortcut can open it
  const url = port.sender.url || port.sender.tab.url;
  if (url) {
    const u = new URL(url);
    const dash = u.origin + u.pathname;
    const s = await S.loadSettings();
    if (s.dashboardUrl !== dash) await S.saveSettings({ dashboardUrl: dash });
    A.setDashboardUrl(dash);
  }
});

function broadcast(event, data) {
  for (const p of ports) {
    try { p.postMessage({ event, data }); } catch { ports.delete(p); }
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[S.KEY]) {
    const state = S.normalize(changes[S.KEY].newValue);
    broadcast('state', state);
    syncTabGroups(state);
  }
  if (changes[S.SETTINGS_KEY]) {
    const o = changes[S.SETTINGS_KEY].oldValue || {};
    const n = { ...S.DEFAULT_SETTINGS, ...(changes[S.SETTINGS_KEY].newValue || {}) };
    if (o.autoSuspendMinutes !== n.autoSuspendMinutes || o.dashboardUrl !== n.dashboardUrl || o.language !== n.language) init();
    if (o.accent !== n.accent) tintActionIcon();
    broadcast('settings', n);
  }
});

let tabsTimer;
function tabsChanged() {
  clearTimeout(tabsTimer);
  tabsTimer = setTimeout(() => broadcast('tabs'), 100);
}
for (const ev of ['onCreated', 'onRemoved', 'onUpdated', 'onMoved', 'onAttached', 'onDetached', 'onActivated', 'onReplaced']) {
  chrome.tabs[ev].addListener(tabsChanged);
}
chrome.windows.onRemoved.addListener(tabsChanged);
