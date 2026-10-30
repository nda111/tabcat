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

chrome.runtime.onStartup.addListener(init);
init();
// the pinned dashboards (see pinDashboards): checked when the browser starts (after the session is
// restored) or the extension is installed / updated, not each time this worker wakes, so a closed one
// stays closed until then
chrome.runtime.onStartup.addListener(() => setTimeout(pinDashboards, 1500));
chrome.runtime.onInstalled.addListener(() => pinDashboards());
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

/* ================= the pinned dashboard ================= */

// Settings > "pin the dashboard": every normal window keeps the dashboard as a pinned tab, which Chrome
// shows at the tab strip's left end as just its icon (the page tints it in the accent colour). Closing it
// is respected until the next window or browser start; turning the setting off takes them away.
const isDashTab = (t) => A.isDashboard(t.url || t.pendingUrl || '') && !/newtab/.test(t.url || t.pendingUrl || '');
const pinning = new Set(); // windows being looked at (startup, a new window and the setting can overlap)

async function pinDashboards() {
  const s = await S.loadSettings();
  if (!s.pinDashboard) return;
  A.setDashboardUrl(s.dashboardUrl);
  const wins = await chrome.windows.getAll({ windowTypes: ['normal'] });
  await Promise.all(wins.filter((w) => !w.incognito).map((w) => pinIn(w.id, s)));
}

async function pinIn(windowId, s) {
  if (pinning.has(windowId)) return;
  pinning.add(windowId);
  try {
    const tabs = await chrome.tabs.query({ windowId });
    const pinned = tabs.filter((t) => t.pinned && isDashTab(t));
    // (a restored session can bring one back beside ours: keep one)
    if (pinned.length > 1) await chrome.tabs.remove(pinned.slice(1).map((t) => t.id));
    if (pinned.length) return;
    const open = tabs.find(isDashTab); // a dashboard already open in the window becomes the pinned one
    if (open) {
      await chrome.tabs.update(open.id, { pinned: true });
      await chrome.tabs.move(open.id, { index: 0 });
    } else await chrome.tabs.create({ windowId, url: s.dashboardUrl, pinned: true, active: false, index: 0 });
  } catch { /* the window went away meanwhile */ } finally { pinning.delete(windowId); }
}

// Setting turned off: the pinned dashboards go; one a window is showing (e.g. the one the setting was
// turned off in) is only unpinned.
async function unpinDashboards() {
  const tabs = (await chrome.tabs.query({ pinned: true })).filter(isDashTab);
  for (const t of tabs.filter((t) => t.active)) await chrome.tabs.update(t.id, { pinned: false }).catch(() => {});
  const rest = tabs.filter((t) => !t.active).map((t) => t.id);
  if (rest.length) await chrome.tabs.remove(rest).catch(() => {});
}

chrome.windows.onCreated.addListener((w) => {
  if (w.type !== 'normal' || w.incognito) return;
  // (after a moment: a window restored by the session brings its own tabs, maybe its pinned dashboard)
  setTimeout(async () => {
    const s = await S.loadSettings();
    if (s.pinDashboard) pinIn(w.id, s);
  }, 1000);
});

// Focuses an open dashboard tab, or opens one; newTab always opens a fresh tab.
async function openDashboard({ newTab = false } = {}) {
  const s = await S.loadSettings();
  A.setDashboardUrl(s.dashboardUrl);
  const tabs = newTab ? [] : await chrome.tabs.query({});
  const existing = tabs.find((t) => A.isDashboard(t.url) && !/newtab/.test(t.url));
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: s.dashboardUrl });
  }
}

/* ================= context menu & shortcuts ================= */

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'go-tabcat':
      await openDashboard({ newTab: true });
      break;
    case 'save-tab':
      if (tab) await A.saveTabs([tab]);
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
      if (tab) await A.saveWindow(tab.windowId);
      break;
    case 'suspend':
      await A.suspendTabs({ windowId: tab?.windowId });
      break;
    case 'dedupe':
      await A.closeDuplicates();
      break;
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'save-tab') {
    const [t] = tab ? [tab] : await chrome.tabs.query({ active: true, currentWindow: true });
    if (t) await A.saveTabs([t]);
  } else if (command === 'save-window') {
    const w = await chrome.windows.getLastFocused();
    await A.saveWindow(w.id);
  } else if (command === 'open-dashboard') {
    await openDashboard();
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

const handlers = {
  getState: () => S.load(),
  getSettings: () => S.loadSettings(),
  saveSettings: (patch) => S.saveSettings(patch),
  // ops: array of store ops, applied atomically; returns array of results
  apply: (ops) => S.update((state) => S.applyOps(state, ops)),

  async getTabs(_args, senderTab) {
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
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
          })),
      })),
    };
  },
  async saveTabs({ tabIds, tabs, ...opts }) {
    if (tabIds) tabs = (await Promise.all(tabIds.map((id) => chrome.tabs.get(id).catch(() => null)))).filter(Boolean);
    return A.saveTabs(tabs || [], opts);
  },
  saveWindow: ({ windowId, ...opts }) => A.saveWindow(windowId, opts),
  closeDuplicates: () => A.closeDuplicates(),
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
  closeTabs: ({ tabIds }) => chrome.tabs.remove(tabIds).then(() => true),
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
  closeWindow: ({ windowId }) => chrome.windows.remove(windowId).then(() => true),
  openDashboard: () => openDashboard(),
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
    if (!!o.pinDashboard !== n.pinDashboard) n.pinDashboard ? pinDashboards() : unpinDashboards();
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
