import * as S from './lib/store.js';
import * as A from './lib/actions.js';
import * as I from './lib/i18n.js';

/* ================= setup ================= */

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
// tabcat group colours -> Chrome's tab group colours (the plain card -> grey)
const TAB_GROUP_COLOR = {
  red: 'red', orange: 'orange', yellow: 'yellow', lime: 'green', green: 'green',
  teal: 'cyan', sky: 'blue', blue: 'blue', purple: 'purple', pink: 'pink',
};

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
      } catch { /* left ungrouped (e.g. the window closed meanwhile) */ }
    }
    return all.length;
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
  if (changes[S.KEY]) broadcast('state', S.normalize(changes[S.KEY].newValue));
  if (changes[S.SETTINGS_KEY]) {
    const o = changes[S.SETTINGS_KEY].oldValue || {};
    const n = { ...S.DEFAULT_SETTINGS, ...(changes[S.SETTINGS_KEY].newValue || {}) };
    if (o.autoSuspendMinutes !== n.autoSuspendMinutes || o.dashboardUrl !== n.dashboardUrl || o.language !== n.language) init();
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
