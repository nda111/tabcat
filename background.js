import * as S from './lib/store.js';
import * as A from './lib/actions.js';
import * as I from './lib/i18n.js';
import * as Y from './lib/sync.js';

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
  menus = menus.then(async () => {
    const { server } = await S.loadSettings();
    // (on the toolbar button: connect to the user's own server, or disconnect from it. The button's menu shows
    // at most ACTION_MENU_TOP_LEVEL_LIMIT (6) items, separators included: this is the sixth)
    const serverItem = ['server', server ? I.t('menuDisconnect', { host: new URL(server).host }) : I.t('menuConnect'), ['action']];
    await new Promise((done) => chrome.contextMenus.removeAll(() => {
      for (const [id, key, contexts] of MENUS) chrome.contextMenus.create({ id, title: I.t(key), contexts }, () => void chrome.runtime.lastError);
      chrome.contextMenus.create({ id: serverItem[0], title: serverItem[1], contexts: serverItem[2] }, () => void chrome.runtime.lastError);
      done();
    }));
    gateMenus();
  });
  return menus;
}

// Closes tabs (or a whole window), remembered: undo opens them again where they were. Returns the
// history entry's id (for the dashboard's toast), or true when there was nothing to remember.
async function closeTabs(tabs, what, close = () => chrome.tabs.remove(tabs.map((t) => t.id))) {
  const keep = tabs.filter((t) => (t.url || t.pendingUrl) && !A.isDashboard(t.url || t.pendingUrl));
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
const SYNC_KEY = 'tabcat:sync'; // (where sync keeps its part: see the sync section)
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
// Installed: the welcome page (the three ways to use tabcat: the online dashboard, a copy served here, a server of
// one's own), in a tab of its own; the dashboard comes from there, or from the shortcut
const WELCOME = 'https://tabcat.ghyeok.com/welcome';
chrome.runtime.onInstalled.addListener(({ reason }) => { if (reason === 'install') chrome.tabs.create({ url: WELCOME }); });
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
  if (GATED_MENUS.includes(info.menuItemId) && await blockedSave()) return; // (greyed out meanwhile: in case)
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
        const gid = S.ensureGroup(state, s.defaultGroupId || s.lastGroupId, { allowFolder: true }); // (the default group, set in the dashboard; else the last used)
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
    case 'server':
      if ((await S.loadSettings()).server) await disconnectServer();
      else {
        // (looking at a tabcat dashboard on some server, as when it says to connect: its address, filled in)
        let address = '';
        try {
          const u = new URL(tab?.url || '');
          const ours = ['tabcat.ghyeok.com', 'localhost', '127.0.0.1'].includes(u.hostname);
          if (/^https?:$/.test(u.protocol) && !ours && /^tabcat\b/.test(tab.title || '')) address = u.origin;
        } catch { /* no page */ }
        // (and the look, to show from its first paint: see connect-look.js)
        const { theme, accent } = await S.loadSettings();
        const q = new URLSearchParams({ theme, accent, hue: S.ACCENT_HUES[accent] ?? '' });
        if (address) q.set('address', address);
        await chrome.windows.create({ url: `connect.html?${q}`, type: 'popup', width: 440, height: 250, focused: true }); // (it then fits its content)
      }
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
    if (await blockedSave()) return; // (connected to a server, not signed in: its sign-in instead)
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
  // (a change made elsewhere than in the data, on the server say: the dashboard does it, `run`; what does the
  // opposite is kept for redo, or undo again. feature: actHistory)
  if (entry.act) { out.act = { back: entry.act.forth, forth: entry.act.back }; out.run = entry.act.back; }
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
  // a change the dashboard made outside the data (a device renamed on the server...): `act.back` undoes it,
  // `act.forth` does it again, each a plain object the dashboard knows what to do with. Returns its id.
  rememberAct: ({ act, what }) => withHistory(async (h) => {
    const id = S.uid();
    await pushChange(h, { id, act, what: what ?? null });
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
    h.redo.push({ ...back, run: undefined });
    return { what: back.what, run: back.run ?? null };
  }),
  redo: () => withHistory(async (h) => {
    const entry = h.redo.pop();
    if (!entry) return null;
    const back = await restore(entry);
    await dropSnaps([entry]);
    if (!back) return null;
    h.undo.push({ ...back, run: undefined });
    return { what: back.what, run: back.run ?? null };
  }),
};
// Closes duplicate tabs, remembered for undo; returns how many
// Saves tabs (closing them, as set), remembered: undo takes the links out and opens the tabs again
// While connected to a server, saving needs an account there: the server set up, and signed in. Asked of the
// server (the sign-in cookie goes with the extension's request: it may reach that site). Not reached: saving
// goes on (tabcat works offline; the data is in the browser, as it is until syncing comes). Returns what's
// needed ({ server, need: 'setup' | 'signin' }), or null.
async function serverGate() {
  const { server } = await S.loadSettings();
  if (!server) return null;
  const ask = (path) => fetch(`${server}/api/${path}`, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(4000) });
  try {
    if ((await (await ask('server')).json()).setup) return { server, need: 'setup' };
    if ((await ask('me')).status === 401) return { server, need: 'signin' };
  } catch { return null; /* not reached */ }
  await ensureAccount(); // (signed in: their data, not another account's)
  return null;
}
// The menu's items (all but connecting to a server), greyed out while tabcat needs the server's account
// first: looked at again on connecting and disconnecting, when a page of the server loads (signing in and out
// happen there), and when a browser window comes to the front
const GATED_MENUS = MENUS.map(([id]) => id);
let gating = null;
function gateMenus() {
  gating ||= (async () => {
    const gate = await serverGate();
    for (const id of GATED_MENUS) chrome.contextMenus.update(id, { enabled: !gate }, () => void chrome.runtime.lastError);
  })().finally(() => { gating = null; });
  return gating;
}
chrome.tabs.onUpdated.addListener(async (_id, change, tab) => {
  if (change.status !== 'complete' || !tab.url) return;
  const { server } = await S.loadSettings();
  if (server && new URL(tab.url).origin === server) gateMenus();
});
chrome.windows.onFocusChanged.addListener(async (id) => {
  if (id !== chrome.windows.WINDOW_ID_NONE && (await S.loadSettings()).server) { gateMenus(); syncSoon(0); }
});

// Anything of tabcat's from the menu or a shortcut while that's needed: the server's page for it opens instead
async function blockedSave() {
  const gate = await serverGate();
  if (!gate) return false;
  await chrome.tabs.create({ url: `${gate.server}/${gate.need === 'setup' ? 'setup' : 'login'}` });
  return true;
}

async function saveTabs(tabs, opts = {}, save = () => A.saveTabs(tabs, opts)) {
  if (await blockedSave()) return null;
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
  // (what a page may change: the user's settings, never where the data goes (the server, its account, the dashboard's
  // address): those only through connect.html and the extension itself, or any page the bridge reaches could send
  // everything elsewhere)
  saveSettings: (patch) => S.saveSettings(Object.fromEntries(Object.entries(patch || {}).filter(([k]) => !PRIVATE_SETTINGS.has(k)))),
  // ops: array of store ops, applied atomically; returns array of results. A remove marked `trash` (a
  // delete) keeps what it removed in Recently deleted.
  async apply(ops) {
    // (a shared workspace isn't deleted as others are: left, or deleted for everyone by its owner; see leaveShare)
    if (ops.some((o) => o.op === 'remove')) {
      const now = await S.load();
      if (ops.some((o) => o.op === 'remove' && now.workspaces.some((w) => w.id === o.id && w.share))) throw new Error('shared');
    }
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
            groupId: t.groupId ?? -1, index: t.index,
          })),
        // its tab groups: { id, title, color, collapsed }
        groups: groupsBy.get(w.id) || [],
      })),
    };
  },
  // Moves tabs (in the order given) to `index` of window `windowId` (the place before the tab now at that
  // index; -1: the end), as the open tabs panel shows them dropped. Landing between two tabs of one tab
  // group, they join it; landing outside, they leave theirs. (feature: moveTabs)
  // The favicons at these chrome-extension://…/_favicon/ addresses, as data: URLs (null where there's none),
  // for a dashboard that may not load them itself (feature: favicons)
  async favicons({ urls }) {
    const base = chrome.runtime.getURL('/_favicon/');
    return Promise.all((urls || []).slice(0, 500).map(async (u) => {
      if (typeof u !== 'string' || !u.startsWith(base)) return null;
      try {
        const r = await fetch(u);
        if (!r.ok) return null;
        const bytes = new Uint8Array(await r.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return `data:${r.headers.get('content-type') || 'image/png'};base64,${btoa(bin)}`;
      } catch { return null; }
    }));
  },
  async moveTabs({ tabIds, windowId, index }) {
    const tabs = (await Promise.all(tabIds.map((id) => chrome.tabs.get(id).catch(() => null)))).filter(Boolean);
    if (!tabs.length) return false;
    const ids = tabs.map((t) => t.id);
    // each goes, in turn, just before the tab now at `index` (one not moving), or to the end
    const anchorId = index < 0 ? null : (await chrome.tabs.query({ windowId })).find((t) => t.index >= index && !ids.includes(t.id))?.id;
    for (const id of ids) {
      const anchor = anchorId && await chrome.tabs.get(anchorId).catch(() => null);
      const tab = await chrome.tabs.get(id);
      const at = !anchor ? -1 : tab.windowId === windowId && tab.index < anchor.index ? anchor.index - 1 : anchor.index;
      await chrome.tabs.move(id, { windowId, index: at });
    }
    const all = await chrome.tabs.query({ windowId });
    const pos = all.findIndex((t) => t.id === ids[0]);
    const before = all[pos - 1], after = all[pos + ids.length];
    const group = before && after && before.groupId !== -1 && before.groupId === after.groupId ? before.groupId : -1;
    if (group !== -1) await chrome.tabs.group({ tabIds: ids, groupId: group }).catch(() => {});
    else {
      const grouped = ids.filter((id) => all.find((t) => t.id === id)?.groupId !== -1);
      if (grouped.length) await chrome.tabs.ungroup(grouped).catch(() => {});
    }
    return true;
  },
  async saveTabs({ tabIds, tabs, ...opts }) {
    if (tabIds) tabs = (await Promise.all(tabIds.map((id) => chrome.tabs.get(id).catch(() => null)))).filter(Boolean);
    return saveTabs(tabs || [], opts);
  },
  saveWindow: ({ windowId, ...opts }) => saveWindow(windowId, opts),
  // (for the popup: what saving needs first on a server, or null)
  serverStatus: () => { gateMenus(); return serverGate(); },
  closeDuplicates: () => closeDuplicates(),
  suspendTabs: (args) => A.suspendTabs(args || {}),
  // `groups` ([{ title, color, urls }], optional): open those instead, each set in its own tab group
  // named after it (older dashboards send only `urls`)
  // (`index`: where in the window, as the open tabs panel shows them dropped; none, the end. feature: deviceTabs)
  async openUrls({ urls, groups, newWindow, windowId, active, index }, senderTab) {
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
        tabIds.push((await chrome.tabs.create({ url: all[i], windowId: target, active: !!active && i === 0, ...(Number.isInteger(index) && index >= 0 ? { index: index + i } : {}) })).id);
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

const PRIVATE_SETTINGS = new Set(['server', 'serverUser', 'dashboardUrl', 'lastGroupId']);
async function handle(msg, senderTab) {
  const fn = handlers[msg?.cmd];
  if (!fn) throw new Error('unknown command ' + msg?.cmd);
  return fn(msg.args || {}, senderTab);
}

// popup → background (popup closes as soon as tabs are created/closed, so it delegates here)
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  // (connecting to a server: only from the extension's own pages, never a dashboard through the bridge)
  const own = sender.url?.startsWith(chrome.runtime.getURL(''));
  const job = own && SERVER_CMDS[msg.cmd] ? SERVER_CMDS[msg.cmd](msg.args || {}) : handle(msg, sender.tab);
  job.then((result) => respond({ result }), (e) => respond({ error: e.message }));
  return true;
});

/* ================= the user's own server ================= */

// Connected to a server (its origin, allowed by the user in connect.html), the extension links up with the
// dashboard it hosts as it does with tabcat.ghyeok.com: content.js runs there too (registered here, the
// manifest can't list it), and the shortcut and toolbar open it. Disconnecting hands the permission back and
// goes back to tabcat.ghyeok.com.
const SERVER_SCRIPT = 'tabcat-server';
// (permissions go by host, any port, both schemes: as the manifest's optional ones list them, one per scheme)
const hostPatterns = (origin) => ['https', 'http'].map((p) => `${p}://${new URL(origin).hostname}/*`);
const DEFAULT_DASHBOARD = S.DEFAULT_SETTINGS?.dashboardUrl || 'https://tabcat.ghyeok.com/';
async function linkServer(origin) {
  await chrome.scripting.unregisterContentScripts({ ids: [SERVER_SCRIPT] }).catch(() => {});
  if (!origin) return;
  await chrome.scripting.registerContentScripts([{ id: SERVER_SCRIPT, matches: hostPatterns(origin), js: ['content.js'], runAt: 'document_start' }]);
}
// Each server has data of its own, apart from the browser's own (what tabcat.ghyeok.com shows): connecting
// puts the one in use away under its space's name and takes out the server's (new: a fresh start), and
// disconnecting does the reverse. The undo history starts over. (The server keeps its copy in step: later.)
const SPACE_KEYS = [S.KEY, TRASH_KEY, 'tabcat:tabGroupLinks', SYNC_KEY];
const LOOK_KEY = 'tabcat:look', LOOK = Y.LOOK; // (each space's look: see switchSpace)
// (an account's space new to this browser starts from a copy of the browser's own data and look: what the
// server keeps for the account, if it has anything yet, takes its place once sync reaches it)
const isAccountSpace = (space) => space.includes('|');
function switchSpace(from, to) {
  return withSpace(async () => {
    const named = (k, space) => `${k}@${space}`;
    const now = await chrome.storage.local.get(SPACE_KEYS);
    const next = await chrome.storage.local.get(SPACE_KEYS.map((k) => named(k, to)));
    const fresh = isAccountSpace(to) && next[named(S.KEY, to)] === undefined;
    const browser = fresh && (from === 'local' ? now : Object.fromEntries(Object.entries(
      await chrome.storage.local.get(SPACE_KEYS.map((k) => named(k, 'local'))),
    ).map(([k, v]) => [k.slice(0, -'@local'.length), v])));
    const out = {}, gone = SPACE_KEYS.map((k) => named(k, to));
    for (const k of SPACE_KEYS) {
      if (now[k] !== undefined) out[named(k, from)] = now[k];
      const v = next[named(k, to)] ?? (fresh && k !== SYNC_KEY ? structuredClone(browser[k]) : undefined);
      if (v !== undefined) out[k] = v;
      else if (k === SYNC_KEY) gone.push(k); // (never synced: sync starts it)
      else out[k] = k === S.KEY ? S.defaultState() : k === TRASH_KEY ? [] : {};
    }
    // the settings (the dashboard's Settings: the look, the language...) are each space's own too: this one's kept,
    // the next one's taken up; one that never set them gets the defaults (kept apart, not swapped: settings stay where
    // the rest of tabcat reads them). (Kept from before only the look was: the rest as they are now.)
    const settings = await S.loadSettings();
    const keyOf = named(LOOK_KEY, to), localKey = named(LOOK_KEY, 'local');
    const stored = await chrome.storage.local.get([keyOf, localKey]);
    const look = stored[keyOf] || (fresh && (from === 'local' ? settings : stored[localKey])) || {};
    out[named(LOOK_KEY, from)] = Object.fromEntries(LOOK.map((k) => [k, settings[k]]));
    out[S.SETTINGS_KEY] = { ...settings, ...Object.fromEntries(LOOK.map((k) => [k, look[k] ?? (Object.keys(look).length ? settings[k] : S.DEFAULT_SETTINGS[k])])) };
    await chrome.storage.local.remove(gone.filter((k) => !(k in out)));
    await chrome.storage.local.set(out);
    await withHistory(async (h) => { await dropSnaps([...h.undo, ...h.redo]); h.undo = []; h.redo = []; });
  });
}
// The dashboards open now (here, on tabcat.ghyeok.com or on `also`) load again, to show what they now are
async function reloadDashboards(also) {
  const ids = new Set([...ports].map((p) => p.sender.tab.id));
  if (also) for (const t of await chrome.tabs.query({ url: hostPatterns(also) })) ids.add(t.id);
  for (const t of await chrome.tabs.query({ url: ['https://tabcat.ghyeok.com/*', 'http://localhost/*', 'http://127.0.0.1/*'] })) {
    if (A.isDashboard(t.url) || /^https:\/\/tabcat\.ghyeok\.com\/(index\.html)?([?#]|$)/.test(t.url)) ids.add(t.id);
  }
  await Promise.all([...ids].map((id) => chrome.tabs.reload(id).catch(() => {})));
}
// Updated (or reloaded by hand), the dashboards open are left cut off from the extension: each loads again at once,
// looked at or not (one in the background would find out only later, its timers slowed or the tab frozen meanwhile),
// except one with a dialog open (an edit under way, kept in storage as it goes: see content.js) and the one being
// looked at (in front, in the window in use): those reload themselves once nothing is being edited (the dashboard's
// reloadWhenIdle). (The server's account and admin pages don't use the extension: they needn't load again.)
const EDITING_KEY = 'tabcat:editing';
const editingTabs = async () => new Set((await chrome.storage.local.get(EDITING_KEY))[EDITING_KEY] || []);
async function markEditing(tabId, on) {
  const ids = await editingTabs();
  if (on === ids.has(tabId)) return;
  if (on) ids.add(tabId); else ids.delete(tabId);
  await chrome.storage.local.set({ [EDITING_KEY]: [...ids] });
}
async function reloadDashboardsAfterUpdate() {
  A.setDashboardUrl((await S.loadSettings()).dashboardUrl);
  const editing = await editingTabs();
  const tabs = await chrome.tabs.query({}), open = new Set(tabs.map((t) => t.id));
  await chrome.storage.local.set({ [EDITING_KEY]: [...editing].filter((id) => open.has(id)) }); // (tabs since closed: forgotten)
  // (the one looked at: the front tab of the window in use, none if it's another app's; a window behind, its front
  // tab is not looked at, and loads again with the rest)
  const win = await chrome.windows.getLastFocused().catch(() => null);
  const front = win?.focused ? tabs.find((t) => t.active && t.windowId === win.id) : null;
  const ids = tabs.filter((t) => t !== front && !t.discarded && !editing.has(t.id)
    && (A.isDashboard(t.url) || /^https:\/\/tabcat\.ghyeok\.com\/(index\.html)?([?#]|$)/.test(t.url || ''))).map((t) => t.id);
  await Promise.all(ids.map((id) => chrome.tabs.reload(id).catch(() => {})));
}
chrome.runtime.onInstalled.addListener(({ reason }) => { if (reason === 'update') reloadDashboardsAfterUpdate(); });

// Each account on a server has data of its own too: the space in use is named for the server and, once someone
// has signed in there, their account. Who's signed in is asked of the server as a dashboard links up and before
// saving: another account than the space's, and the space changes to theirs (signed out, it stays, all of tabcat
// locked meanwhile). Not reached: as it was.
const spaceName = (server, user) => (user ? `${server}|${user}` : server);
let accountCheck = null;
function ensureAccount() {
  accountCheck ||= (async () => {
    const s = await S.loadSettings();
    if (!s.server) return false;
    let me;
    try {
      const r = await fetch(`${s.server}/api/me`, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(4000) });
      if (!r.ok) return false;
      me = await r.json();
    } catch { return false; }
    // (the account's own key for its data: never another's, even one deleted under the same name; a server
    // from before keys gave only its id)
    const user = me?.space ? String(me.space) : me?.id != null ? String(me.id) : null;
    if (!user || user === (s.serverUser ?? null)) return false;
    await switchSpace(spaceName(s.server, s.serverUser), spaceName(s.server, user));
    await S.saveSettings({ serverUser: user });
    syncSoon();
    return true;
  })().finally(() => { accountCheck = null; });
  return accountCheck;
}

async function connectServer({ origin }) {
  const u = new URL(origin);
  if (!/^https?:$/.test(u.protocol) || u.origin !== origin) throw new Error('bad-origin');
  if (!(await chrome.permissions.contains({ origins: hostPatterns(origin) }))) throw new Error('not-allowed');
  const before = (await S.loadSettings()).server;
  if (before === origin) { await openDashboard(); return true; }
  if (before && new URL(before).hostname !== new URL(origin).hostname) await chrome.permissions.remove({ origins: hostPatterns(before) }).catch(() => {});
  await linkServer(origin);
  const { serverUser } = await S.loadSettings();
  await switchSpace(before ? spaceName(before, serverUser) : 'local', origin);
  await S.saveSettings({ server: origin, serverUser: null, dashboardUrl: `${origin}/` });
  A.setDashboardUrl(`${origin}/`);
  await buildMenus();
  await reloadDashboards(origin);
  // (a page of the server open already, as its sign-in or setup asking to connect: that one, loaded again;
  // else its dashboard, opened)
  const open = (await chrome.tabs.query({ url: hostPatterns(origin) }))[0];
  if (open) {
    await chrome.tabs.update(open.id, { active: true });
    await chrome.windows.update(open.windowId, { focused: true });
  } else await openDashboard();
  return true;
}
async function disconnectServer() {
  const { server, serverUser } = await S.loadSettings();
  await linkServer(null);
  if (server) await switchSpace(spaceName(server, serverUser), 'local');
  await S.saveSettings({ server: null, serverUser: null, dashboardUrl: DEFAULT_DASHBOARD });
  A.setDashboardUrl(DEFAULT_DASHBOARD);
  await buildMenus();
  if (server) await reloadDashboards(server);
  if (server) await chrome.permissions.remove({ origins: hostPatterns(server) }).catch(() => {});
  return true;
}
// A page on this computer (localhost, 127.0.0.1: any program here may serve one) is linked up with the extension only
// once the user has allowed its address, in a window of the extension's own (allow.html); tabcat.ghyeok.com and the
// connected server's dashboard always are
const ALLOWED_KEY = 'tabcat:allowedOrigins';
const isLocal = (origin) => { try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname); } catch { return false; } };
async function originAllowed(origin) {
  if (!isLocal(origin)) return true;
  const { server } = await S.loadSettings();
  if (server && origin === server) return true;
  return ((await chrome.storage.local.get(ALLOWED_KEY))[ALLOWED_KEY] || []).includes(origin);
}
const asking = new Map(); // origin -> the window asking
async function askToAllow(origin) {
  if (asking.has(origin)) { chrome.windows.update(asking.get(origin), { focused: true }).catch(() => {}); return; }
  asking.set(origin, null);
  const { theme, accent } = await S.loadSettings();
  const q = new URLSearchParams({ origin, theme, accent, hue: S.ACCENT_HUES[accent] ?? '' });
  const w = await chrome.windows.create({ url: `allow.html?${q}`, type: 'popup', width: 440, height: 260, focused: true }).catch(() => null);
  if (!w) { asking.delete(origin); return; }
  asking.set(origin, w.id);
  const gone = (id) => { if (id !== w.id) return; asking.delete(origin); chrome.windows.onRemoved.removeListener(gone); };
  chrome.windows.onRemoved.addListener(gone);
}
async function allowOrigin({ origin }) {
  if (!isLocal(origin)) return false;
  const list = (await chrome.storage.local.get(ALLOWED_KEY))[ALLOWED_KEY] || [];
  if (!list.includes(origin)) await chrome.storage.local.set({ [ALLOWED_KEY]: [...list, origin] });
  // (its pages, waiting: loaded again, linked up now)
  for (const t of await chrome.tabs.query({})) { try { if (new URL(t.url).origin === origin) chrome.tabs.reload(t.id); } catch { /* no page */ } }
  return true;
}
const SERVER_CMDS = { connectServer, disconnectServer, allowOrigin };
// (the registration and the permission can go apart: taken back in chrome://extensions, the server is gone)
async function checkServer() {
  const { server } = await S.loadSettings();
  if (!server) return linkServer(null);
  if (await chrome.permissions.contains({ origins: hostPatterns(server) })) return linkServer(server);
  await disconnectServer();
}
chrome.runtime.onStartup.addListener(checkServer);
chrome.runtime.onInstalled.addListener(checkServer);
chrome.permissions.onRemoved.addListener(checkServer);

/* ================= sync ================= */

// Signed in to an account on the user's own server, its data (the tree, Recently deleted, the look) is kept
// in step with the server, and through it with the account's other browsers (see lib/sync.js for how).
// The browser's own data never goes there: only an account's space syncs.
//
// What sync keeps, in the space (SYNC_KEY, put away and taken out with it, so a queue waits for its account):
//   { space, seq, snapAt, base, shadow, pending: [{ id, body, seq? }], n }
//   base: the doc as the server has it after change number `seq`; shadow: this browser's doc as last looked
//   at; pending: this browser's changes the server hasn't handed back yet (`seq`: it has them, numbered),
//   in order: the browser's doc is always `base` with them done on top. `snapAt`: the server's whole copy.
// Nothing is lost offline: what changed is found by comparing the doc with `shadow` (both kept in storage), and
// a change leaves `pending` only once it comes back from the server, in its place among everyone's.
const DEVICE_KEY = 'tabcat:device';
const SNAPSHOT_EVERY = 200; // (changes after the server's whole copy before this browser sends a new one)
let spaceChain = Promise.resolve();
function withSpace(fn) { // (the space in use, changing or being written by sync: one at a time)
  const run = spaceChain.then(fn);
  spaceChain = run.catch(() => {});
  return run;
}
const accountSpace = (s) => (s.server && s.serverUser ? spaceName(s.server, s.serverUser) : null);
async function deviceId() {
  let id = (await chrome.storage.local.get(DEVICE_KEY))[DEVICE_KEY];
  if (!id) await chrome.storage.local.set({ [DEVICE_KEY]: (id = S.uid() + S.uid()) });
  return id;
}

// `fn(sync, doc, settings)` with the data held still (nothing else writes it meanwhile), after what changed
// here since last time is queued. It may change `sync` and return a doc for the browser to show: all of it
// written at once (never the one without the other). Not in an account's space (or another than `space`): null.
// `pre(sync, doc)`, before that: may change both (a workspace shared, say), what's shown following.
// What changed is split between the account's own data and each shared workspace's (see lib/sync.js join and
// split): each part queued with its own; a viewer's changes to a shared workspace are not, and what's shown goes
// back to the share's as it was.
function syncTxn(space, fn, pre = null) {
  return withSpace(() => withTrash(async (trash) => {
    let out = null;
    await S.update(async (state) => {
      const settings = await S.loadSettings();
      if (accountSpace(settings) !== space) return false;
      let sync = (await chrome.storage.local.get(SYNC_KEY))[SYNC_KEY] || null;
      if (sync && sync.space !== space) sync = null;
      const was = Y.docOf({ state, trash, settings });
      const now = pre ? Y.clone(was) : was;
      const write = {};
      let joined = null;
      if (sync) {
        sync.shares ||= {};
        if (pre && (await pre(sync, now)) !== false) write[SYNC_KEY] = sync;
        const { personal, parts } = Y.split(now, sync.shadow, sync.shares);
        const ops = Y.diff(sync.shadow, personal);
        if (ops.length) {
          sync.pending.push({ id: `${await deviceId()}.${++sync.n}`, body: Y.body(ops) });
          write[SYNC_KEY] = sync;
        }
        sync.shadow = personal;
        for (const [sid, sh] of Object.entries(sync.shares)) {
          const sops = Y.diff(sh.shadow, parts[sid]);
          if (!sops.length || sh.role === 'viewer') continue; // (a viewer's: not kept, shown as it was below)
          sh.pending.push({ id: `${await deviceId()}.${++sync.n}`, body: Y.body(sops) });
          sh.shadow = parts[sid];
          write[SYNC_KEY] = sync;
        }
        joined = Y.join(sync.shadow, shadows(sync));
      }
      const res = fn ? await fn(sync, now, settings) : null;
      if (res?.sync) write[SYNC_KEY] = res.sync;
      if (res && res.sync === null) { await chrome.storage.local.remove(SYNC_KEY); sync = null; delete write[SYNC_KEY]; }
      const show = res?.show || (sync && joined);
      if (show) {
        // (only what's different: an unchanged tree written again would draw the dashboards again)
        const ws = Y.keepLocal(show.workspaces, was.workspaces); // (cards open or shut as they are here: not kept in step)
        if (!same(ws, was.workspaces)) write[S.KEY] = { version: S.VERSION, workspaces: ws };
        if (!same(show.trash, was.trash)) { write[TRASH_KEY] = show.trash; trash.splice(0, trash.length, ...show.trash); }
        if (!same(show.look, was.look)) write[S.SETTINGS_KEY] = { ...settings, ...show.look };
        if (res?.show) write[SYNC_KEY] = res.sync || sync;
      }
      if (Object.keys(write).length) await chrome.storage.local.set(write);
      out = { sync: write[SYNC_KEY] || sync, trashChanged: TRASH_KEY in write, res };
      return false; // (written above, all at once)
    });
    return out;
  }));
}
const same = Y.same;
const shadows = (sync) => Object.fromEntries(Object.entries(sync.shares || {}).map(([id, sh]) => [id, sh.shadow]));
// the browser's doc: the server's, with this browser's changes not handed back yet on top (the account's, and each
// shared workspace's: what's shown from now on, so each part's shadow too)
function shown(sync) {
  sync.shadow = Y.apply(Y.clone(sync.base), sync.pending.flatMap((p) => Y.opsOf(p.body)));
  for (const sh of Object.values(sync.shares ||= {})) sh.shadow = Y.apply(Y.clone(sh.base), sh.pending.flatMap((p) => Y.opsOf(p.body)));
  return Y.join(sync.shadow, shadows(sync));
}

class SyncError extends Error {}
async function syncApi(s, path, { method = 'GET', json } = {}) {
  // (only to a server the user let the extension talk to (connect.html asked the browser): never one set some other way)
  if (!(await chrome.permissions.contains({ origins: hostPatterns(s.server) }))) { checkServer(); throw new SyncError('not-allowed'); }
  const opts = { method, credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(20000), headers: { 'X-Tabcat-Account': s.serverUser } };
  if (json !== undefined) {
    const { body, headers } = await Y.packed(json);
    opts.body = body;
    Object.assign(opts.headers, { 'Content-Type': 'application/json' }, headers);
  }
  const r = await fetch(`${s.server}/api/sync/${path}`, opts);
  if (r.status === 409 && (await r.clone().json().catch(() => ({}))).detail === 'another account is signed in') {
    ensureAccount();
    throw new SyncError('account');
  }
  if (!r.ok) throw Object.assign(new SyncError(`${r.status}`), { status: r.status });
  return r.json();
}

// The account's data as the server has it (a whole copy, and the changes after it), in place of this browser's:
// this browser's changes not handed back yet stay, on top (those already in it go)
function takeServers(space, st, keepPending = true) {
  return syncTxn(space, async (sync) => {
    const base = Y.clone(st.snapshot?.body || { workspaces: [], trash: [], look: {} });
    base.workspaces ||= []; base.trash ||= []; base.look ||= {};
    let seq = st.snapshot?.seq || 0;
    const ids = new Set();
    for (const op of st.ops) { Y.apply(base, Y.opsOf(op.body)); seq = op.seq; ids.add(op.id); }
    const pending = keepPending && sync ? sync.pending.filter((p) => !ids.has(p.id) && !(p.seq != null && p.seq <= seq)) : [];
    const next = { space, seq, snapAt: st.snapshot?.seq || 0, base, shadow: null, pending, n: sync?.n || 0, shares: sync?.shares || {} };
    return { sync: next, show: shown(next) };
  });
}

// The first time here: nothing on the server yet, this browser's data becomes the account's (its first whole
// copy); else the server's takes the place of this browser's
async function firstContact(s, space) {
  const st = await syncApi(s, 'state');
  if (st.snapshot || st.ops.length) return takeServers(space, st, false);
  const start = (await syncTxn(space, async (_sync, now) => ({ doc: now })))?.res?.doc;
  if (!start) return null;
  try {
    await syncApi(s, 'snapshot', { method: 'PUT', json: { seq: 0, first: true, body: start } });
  } catch (e) {
    if (e.status === 409) return takeServers(space, await syncApi(s, 'state'), false); // (another browser was first)
    throw e;
  }
  await syncTxn(space, async (sync) => (sync ? null : { sync: { space, seq: 0, snapAt: 0, base: start, shadow: start, pending: [], n: 0 } }));
  return syncTxn(space, null); // (what changed here while it went: queued, as any change after it)
}

const syncInfo = { lastOk: null, lastError: null, fails: 0 };
let syncRunning = null, syncAgain = false, syncTimer = null, retryTimer = null;
function syncSoon(ms = 0) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, ms);
}
function syncNow() {
  if (syncRunning) { syncAgain = true; return syncRunning; }
  syncRunning = (async () => {
    do { syncAgain = false; await syncOnce(); } while (syncAgain);
  })().finally(() => { syncRunning = null; });
  return syncRunning;
}
async function syncOnce() {
  const s = await S.loadSettings();
  const space = accountSpace(s);
  if (!space) return;
  clearTimeout(retryTimer);
  try {
    let sync = (await syncTxn(space, null))?.sync; // (what changed here: queued first, online or not)
    if (!sync) { await firstContact(s, space); sync = (await syncTxn(space, null))?.sync; }
    if (!sync) return;
    // send what the server doesn't have yet, in order (each kept there once: sending again does no harm)
    const unsent = sync.pending.filter((p) => p.seq == null);
    for (let i = 0; i < unsent.length; i += 200) {
      const part = unsent.slice(i, i + 200);
      const r = await syncApi(s, 'ops', { method: 'POST', json: { device: await deviceId(), ops: part.map(({ id, body }) => ({ id, body })) } });
      const got = new Map(r.acked.map((a) => [a.id, a.seq]));
      sync = (await syncTxn(space, async (y) => {
        if (!y) return null;
        for (const p of y.pending) if (got.has(p.id)) p.seq = got.get(p.id);
        return { sync: y };
      }))?.sync || sync;
    }
    // take what came after, everyone's in the server's order (this browser's own among them: done with)
    const ops = [];
    let after = sync.seq, head = 0;
    for (;;) {
      const r = await syncApi(s, `ops?after=${after}`);
      head = r.head;
      if (r.reload) { await takeServers(space, await syncApi(s, 'state')); break; }
      ops.push(...r.ops);
      if (r.ops.length) after = r.ops[r.ops.length - 1].seq;
      if (!r.more) break;
    }
    if (head < sync.seq) {
      // (the server has less than this browser took from it: its data was put back from an older copy, or let
      // go; this browser's goes up again as the account's, if it has nothing now)
      await syncTxn(space, async () => ({ sync: null }));
      return syncOnce();
    }
    if (ops.length) {
      const res = await syncTxn(space, async (y) => {
        if (!y || y.seq !== sync.seq) return null; // (changed meanwhile: next time)
        const mine = new Set(y.pending.map((p) => p.id));
        const others = ops.some((op) => !mine.has(op.id));
        for (const op of ops) {
          if (op.seq <= y.seq) continue;
          Y.apply(y.base, Y.opsOf(op.body));
          y.seq = op.seq;
        }
        const back = new Set(ops.map((op) => op.id));
        y.pending = y.pending.filter((p) => !back.has(p.id));
        return others ? { sync: y, show: shown(y) } : { sync: y };
      });
      if (res?.trashChanged) broadcast('trash');
      sync = res?.sync || sync;
    }
    // the shared workspaces the account is in, each in step the same way (after the account's own: a stub it has
    // now, its share is on the server already)
    await syncShares(s, space);
    // now and then a whole copy, so the server can let older changes go
    if (sync.seq - (sync.snapAt || 0) >= SNAPSHOT_EVERY) {
      const at = sync.seq, copy = Y.clone(sync.base);
      await syncApi(s, 'snapshot', { method: 'PUT', json: { seq: at, body: copy } }).catch(() => null);
      await syncTxn(space, async (y) => (y && y.seq >= at ? { sync: { ...y, snapAt: at } } : null));
    }
    syncInfo.lastOk = Date.now(); syncInfo.lastError = null; syncInfo.fails = 0;
    if (!tabsSent) sendTabsSoon(0); // (newly linked up, or the worker woken: this browser's tabs told at once)
  } catch (e) {
    // offline, the server down or signed out: tried again (sooner at first, then less often), and on coming
    // back online, a dashboard opening, a window coming to the front; the alarm wakes the worker meanwhile
    syncInfo.lastError = e.message || String(e);
    syncInfo.fails++;
    retryTimer = setTimeout(syncNow, Math.min(300, 5 * 2 ** (syncInfo.fails - 1)) * 1000);
  }
}
// Shared workspaces (see lib/sync.js join): which the account is in, asked of the server each time; one newly in,
// its data taken, and a stub for it put in the account's list (last: where it goes, kept by the account, moved as
// any workspace); one left, let go (its stub too). Each then kept in step as the account's own data is: this
// browser's changes sent (a viewer's never are; refused, now a viewer say, they go), everyone's taken in order.
// Sharing, leaving and deleting go one at a time with this (withShares), never between its asking and its taking.
let shareChain = Promise.resolve();
function withShares(fn) {
  const run = shareChain.then(fn);
  shareChain = run.catch(() => {});
  return run;
}
const shareBase = (st) => {
  const base = Y.clone(st.snapshot?.body || { workspaces: [] });
  base.workspaces ||= []; base.trash = []; base.look = {};
  let seq = st.snapshot?.seq || 0;
  for (const op of st.ops) { Y.apply(base, Y.opsOf(op.body)); seq = op.seq; }
  return { base, seq, snapAt: st.snapshot?.seq || 0 };
};
function syncShares(s, space) {
  return withShares(async () => {
    const list = (await syncApi(s, 'shares')).shares;
    const want = new Map(list.map((x) => [x.id, x]));
    let sync = (await syncTxn(space, null))?.sync;
    if (!sync) return;
    const fresh = {};
    for (const x of list) if (!sync.shares?.[x.id]) fresh[x.id] = shareBase(await syncApi(s, `shares/${x.id}/state`));
    sync = (await syncTxn(space, async (y) => {
      if (!y) return null;
      let changed = false;
      for (const id of Object.keys(y.shares)) if (!want.has(id)) { delete y.shares[id]; changed = true; }
      for (const x of list) {
        const sh = y.shares[x.id];
        if (sh) { if (sh.role !== x.role) { sh.role = x.role; changed = true; } continue; }
        if (!fresh[x.id]) continue;
        y.shares[x.id] = { root: x.root, role: x.role, ...fresh[x.id], shadow: null, pending: [] };
        changed = true;
      }
      // (the account's list: a stub for each, none for one let go)
      const mine = Y.apply(Y.clone(y.base), y.pending.flatMap((p) => Y.opsOf(p.body))).workspaces;
      const ops = [];
      let last = mine.at(-1)?.id ?? null;
      for (const x of list) {
        if (mine.some((w) => w.id === x.root)) continue;
        ops.push({ o: 'add', id: x.root, p: null, a: last, f: { type: 'workspace', share: x.id } });
        last = x.root;
      }
      for (const w of mine) if (w.share && !want.has(w.share)) ops.push({ o: 'del', id: w.id });
      if (ops.length) y.pending.push({ id: `${await deviceId()}.${++y.n}`, body: Y.body(ops) });
      return changed || ops.length ? { sync: y, show: shown(y) } : null;
    }))?.sync || sync;
    for (const id of Object.keys(sync.shares || {})) await syncShare(s, space, id);
  });
}
async function syncShare(s, space, id) {
  const path = `shares/${id}`;
  const txn = (fn) => syncTxn(space, async (y) => (y?.shares?.[id] ? fn(y, y.shares[id]) : null));
  let sh = (await syncTxn(space, null))?.sync?.shares?.[id];
  if (!sh) return;
  const unsent = sh.pending.filter((p) => p.seq == null);
  try {
    for (let i = 0; i < unsent.length; i += 200) {
      const part = unsent.slice(i, i + 200);
      const r = await syncApi(s, `${path}/ops`, { method: 'POST', json: { device: await deviceId(), ops: part.map(({ id: pid, body }) => ({ id: pid, body })) } });
      const got = new Map(r.acked.map((a) => [a.id, a.seq]));
      await txn((y, x) => { for (const p of x.pending) if (got.has(p.id)) p.seq = got.get(p.id); return { sync: y }; });
    }
  } catch (e) {
    if (e.status !== 403) throw e;
    // (not allowed to change it, made a viewer meanwhile: what this browser changed goes, the share's as it is shown)
    await txn((y, x) => { x.pending = x.pending.filter((p) => p.seq != null); x.role = 'viewer'; return { sync: y, show: shown(y) }; });
  }
  sh = (await syncTxn(space, null))?.sync?.shares?.[id];
  if (!sh) return;
  const ops = [];
  let after = sh.seq, head = 0, reload = false;
  for (;;) {
    const r = await syncApi(s, `${path}/ops?after=${after}`);
    head = r.head;
    if (r.reload) { reload = true; break; }
    ops.push(...r.ops);
    if (r.ops.length) after = r.ops[r.ops.length - 1].seq;
    if (!r.more) break;
  }
  if (reload || head < sh.seq) {
    const st = shareBase(await syncApi(s, `${path}/state`));
    const ids = new Set();
    await txn((y, x) => {
      Object.assign(x, st);
      x.pending = x.pending.filter((p) => !ids.has(p.id) && !(p.seq != null && p.seq <= st.seq));
      return { sync: y, show: shown(y) };
    });
    return;
  }
  if (ops.length) {
    await txn((y, x) => {
      if (x.seq !== sh.seq) return null; // (changed meanwhile: next time)
      const mine = new Set(x.pending.map((p) => p.id));
      const others = ops.some((op) => !mine.has(op.id));
      for (const op of ops) { if (op.seq > x.seq) { Y.apply(x.base, Y.opsOf(op.body)); x.seq = op.seq; } }
      const back = new Set(ops.map((op) => op.id));
      x.pending = x.pending.filter((p) => !back.has(p.id));
      return others ? { sync: y, show: shown(y) } : { sync: y };
    });
  }
  sh = (await syncTxn(space, null))?.sync?.shares?.[id];
  if (sh && sh.role !== 'viewer' && sh.seq - (sh.snapAt || 0) >= SNAPSHOT_EVERY) {
    const at = sh.seq, copy = Y.clone(sh.base);
    await syncApi(s, `${path}/snapshot`, { method: 'PUT', json: { seq: at, body: copy } }).catch(() => null);
    await txn((y, x) => (x.seq >= at ? (x.snapAt = at, { sync: y }) : null));
  }
}
// A workspace of the account's, shared from now on (its owner the account; asking others is the dashboard's, by
// mail): its data goes up as it is, its own from then on, the account's list keeping a stub where it is
handlers.shareWorkspace = ({ id }) => withShares(async () => {
  const s = await S.loadSettings();
  const space = accountSpace(s);
  if (!space) throw new Error('not-signed-in');
  const sync = (await syncTxn(space, null))?.sync;
  if (!sync) throw new Error('not-synced');
  const w = (await S.load()).workspaces.find((x) => x.id === id);
  if (!w) throw new Error('not-found');
  if (w.share && sync.shares?.[w.share]?.root === id) return { id: w.share };
  const { share, ...own } = Y.clone(w);
  const doc = { workspaces: [own], trash: [], look: {} };
  const r = await syncApi(s, 'shares', { method: 'POST', json: { root: id, body: doc } });
  const st = r.created ? { base: doc, seq: 0, snapAt: 0 } : shareBase(await syncApi(s, `shares/${r.id}/state`));
  await syncTxn(space, null, async (y, now) => {
    const ws = now.workspaces.find((x) => x.id === id);
    if (!ws) return false;
    y.shares[r.id] = { root: id, role: 'owner', ...st, shadow: Y.clone(st.base), pending: [] };
    ws.share = r.id;
  });
  syncSoon(0);
  return { id: r.id };
});
// Leaving a shared workspace (anyone but its owner): gone from here at once (its stub, from the account's list, next)
handlers.leaveShare = ({ id }) => withShares(async () => {
  const s = await S.loadSettings();
  const space = accountSpace(s);
  if (!space) throw new Error('not-signed-in');
  await syncApi(s, `shares/${id}`, { method: 'DELETE' });
  await syncTxn(space, null, async (y) => { delete y.shares[id]; });
  syncSoon(0);
  return true;
});
// Its owner deleting it: gone for everyone; this account keeps it in Recently deleted (put back, its own workspace)
handlers.deleteShare = ({ id }) => withShares(async () => {
  const s = await S.loadSettings();
  const space = accountSpace(s);
  if (!space) throw new Error('not-signed-in');
  const state = await S.load();
  const index = state.workspaces.findIndex((w) => w.share === id);
  await syncApi(s, `shares/${id}`, { method: 'DELETE' });
  await syncTxn(space, null, async (y, now) => {
    delete y.shares[id];
    if (index < 0) return;
    now.workspaces = now.workspaces.filter((w) => w.id !== state.workspaces[index].id);
    const { share, ...node } = Y.clone(state.workspaces[index]);
    now.trash.unshift({ id: S.uid(), node, parentId: null, index, deletedAt: Date.now(), trail: [] });
  });
  broadcast('trash');
  syncSoon(0);
  return true;
});

async function syncAlarm() {
  const s = await S.loadSettings();
  if (s.server) chrome.alarms.create('sync', { periodInMinutes: 1 });
  else chrome.alarms.clear('sync');
}
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'sync') { syncNow(); sendTabs(); } });
self.addEventListener('online', () => syncNow());
chrome.runtime.onStartup.addListener(() => syncNow());
syncAlarm();
syncSoon(1000); // (the worker woke: anything left over)
handlers.syncNow = () => { syncSoon(0); return true; };
handlers.syncStatus = async () => {
  const s = await S.loadSettings();
  const sync = (await chrome.storage.local.get(SYNC_KEY))[SYNC_KEY];
  return {
    space: accountSpace(s), seq: sync?.seq ?? null, snapAt: sync?.snapAt ?? null,
    pending: sync?.pending.length ?? 0, unsent: sync?.pending.filter((p) => p.seq == null).length ?? 0, ...syncInfo,
  };
};

// dashboard bridge: content.js opens a long-lived port per dashboard tab
const ports = new Set();

chrome.runtime.onConnect.addListener(async (port) => {
  if (port.name !== 'tabcat-bridge' || !port.sender?.tab) return;
  // (a page on this computer not allowed yet: nothing for it (no answers, nothing sent its way); the user asked)
  const origin = new URL(port.sender.url || port.sender.tab.url).origin;
  const allowed = originAllowed(origin);
  // (listened to at once, what comes meanwhile answered once it's known whether the page may)
  port.onMessage.addListener(async (msg) => {
    if (!(await allowed)) { if (!('editing' in msg)) port.postMessage({ reply: msg.id, error: 'not-allowed' }); return; }
    if ('editing' in msg) return markEditing(port.sender.tab.id, msg.editing);
    try {
      // (connected to a server, only its dashboard has the data: another one is told where it is)
      const { server } = await S.loadSettings();
      const from = new URL(port.sender.url || port.sender.tab.url).origin;
      if (server && from !== server) throw new Error(`tabcat is connected to ${server}`);
      // (the server's dashboard: the signed-in account's data, looked at once as it links up)
      if (server) await (port.account ||= ensureAccount());
      const result = await handle(msg, port.sender.tab);
      port.postMessage({ reply: msg.id, result });
    } catch (e) {
      port.postMessage({ reply: msg.id, error: e.message });
    }
  });
  if (!(await allowed)) { askToAllow(origin); return; }
  ports.add(port);
  syncSoon(0); // (a dashboard opening: up to date with the server)
  sendTabsSoon(0, true); // (signed in again, maybe: told at once, a browser hidden from the list is shown again then)
  port.onDisconnect.addListener(() => { ports.delete(port); markEditing(port.sender.tab.id, false); });
  // remember where the dashboard lives so the popup / shortcut can open it
  const url = port.sender.url || port.sender.tab.url;
  if (url) {
    const u = new URL(url);
    const dash = u.origin + u.pathname;
    const s = await S.loadSettings();
    if (s.server && u.origin !== s.server) return; // (not the dashboard while connected to a server)
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
  // (sync: what changed here goes to the server soon, a few changes in a row together)
  if (changes[S.KEY] || changes[TRASH_KEY]) syncSoon(500);
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
    if (o.server !== n.server) syncAlarm();
    if (Y.LOOK.some((k) => o[k] !== n[k])) syncSoon(500);
    broadcast('settings', n);
  }
});

let tabsTimer;
function tabsChanged() {
  clearTimeout(tabsTimer);
  tabsTimer = setTimeout(() => broadcast('tabs'), 100);
  sendTabsSoon();
}
for (const ev of ['onCreated', 'onRemoved', 'onUpdated', 'onMoved', 'onAttached', 'onDetached', 'onActivated', 'onReplaced']) {
  chrome.tabs[ev].addListener(tabsChanged);
}
chrome.windows.onRemoved.addListener(tabsChanged);
for (const ev of ['onCreated', 'onUpdated', 'onRemoved']) chrome.tabGroups?.[ev]?.addListener(() => sendTabsSoon());

/* ================= this browser's open tabs, for the account's others ================= */

// Connected to a server and signed in, this browser tells it which windows and tabs it has open (the latest only:
// see /api/sync/tabs), a moment after they change, so the account's other browsers show them in their open tabs
// panel (feature: deviceTabs). Not its private windows, nor the dashboard, nor new tabs, nor tabcat's own pages. The same as last sent:
// not again, but now and then all the same (the alarm), to say it's still there.
let tabsSent = '', tabsSentAt = 0, tabsSendTimer = null;
function sendTabsSoon(ms = 2000, again = false) {
  clearTimeout(tabsSendTimer);
  tabsSendTimer = setTimeout(() => sendTabs(again), ms);
}
// (what this browser calls itself: "Chrome on Windows", as the server's list of devices does)
function browserName() {
  const ua = navigator.userAgentData;
  const brand = ua?.brands?.map((b) => b.brand).find((b) => !/not.?a.?brand|^chromium$/i.test(b)) || 'Chromium';
  const os = { macOS: 'macOS', Windows: 'Windows', Linux: 'Linux', 'Chrome OS': 'ChromeOS', ChromeOS: 'ChromeOS', Android: 'Android' }[ua?.platform] || ua?.platform || '';
  return [brand.replace(/^(Google|Microsoft) /, ''), os].filter(Boolean).join(' on ');
}
// (`again`: sent even if the same as last time)
async function sendTabs(again = false) {
  const s = await S.loadSettings();
  if (!s.server || !s.serverUser) return;
  A.setDashboardUrl(s.dashboardUrl);
  const [wins, groups] = await Promise.all([chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }), chrome.tabGroups?.query({}).catch(() => []) ?? []]);
  const own = chrome.runtime.getURL(''); // (tabcat's own pages: another browser's tabcat is another extension)
  const windows = wins.filter((w) => !w.incognito).map((w) => ({
    tabs: w.tabs.map((t) => ({ t, url: t.url || t.pendingUrl || '' })).filter(({ url }) => url && !A.isDashboard(url) && !A.isNewTab(url) && !url.startsWith(own))
      .map(({ t, url }) => ({ url, title: t.title || '', icon: /^https?:/.test(t.favIconUrl || '') ? t.favIconUrl : '', pinned: t.pinned, group: t.groupId ?? -1 })),
    groups: groups.filter((g) => g.windowId === w.id).map(({ id, title, color }) => ({ id, title: title || '', color })),
  })).filter((w) => w.tabs.length);
  const now = JSON.stringify([s.server, s.serverUser, windows]);
  if (again !== true && now === tabsSent && Date.now() - tabsSentAt < 10 * 60_000) return;
  try {
    await syncApi(s, 'tabs', { method: 'PUT', json: { device: await deviceId(), name: browserName(), windows } });
    tabsSent = now; tabsSentAt = Date.now();
  } catch { /* (offline, or signed out: next time) */ }
}
handlers.deviceId = () => deviceId(); // (for the dashboard: which of the account's browsers is this one)
