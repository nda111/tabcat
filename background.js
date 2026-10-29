import * as S from './lib/store.js';
import * as A from './lib/actions.js';

/* ================= setup ================= */

chrome.runtime.onInstalled.addListener(async () => {
  // seed initial data
  const r = await chrome.storage.local.get(S.KEY);
  if (!r[S.KEY]) await S.save(S.defaultState());

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'open-dashboard', title: 'Open tabcat dashboard', contexts: ['action'] });
    chrome.contextMenus.create({ id: 'save-tab', title: 'Save this tab to tabcat', contexts: ['page', 'action'] });
    chrome.contextMenus.create({ id: 'save-link', title: 'Save link to tabcat', contexts: ['link'] });
    chrome.contextMenus.create({ id: 'save-window', title: 'Save all tabs in this window', contexts: ['page', 'action'] });
    chrome.contextMenus.create({ id: 'suspend', title: 'Suspend other tabs (free memory)', contexts: ['page', 'action'] });
    chrome.contextMenus.create({ id: 'dedupe', title: 'Close duplicate tabs', contexts: ['action'] });
  });
  init();
});

chrome.runtime.onStartup.addListener(init);
init();

async function init() {
  const s = await S.loadSettings();
  A.setDashboardUrl(s.dashboardUrl);
  await chrome.alarms.clear('autosuspend');
  if (s.autoSuspendMinutes > 0) chrome.alarms.create('autosuspend', { periodInMinutes: 1 });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'autosuspend') return;
  const s = await S.loadSettings();
  if (s.autoSuspendMinutes > 0) await A.suspendTabs({ olderThanMs: s.autoSuspendMinutes * 60_000 });
});

async function openDashboard() {
  const s = await S.loadSettings();
  A.setDashboardUrl(s.dashboardUrl);
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => A.isDashboard(t.url) && !/newtab/.test(t.url));
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: s.dashboardUrl });
  }
}

/* ================= toolbar button ================= */

// There is no default_popup, so every click reaches onClicked: one click opens the popup, a second
// click within DOUBLE_CLICK_MS opens the dashboard instead. (The popup waits that long to appear.)
const DOUBLE_CLICK_MS = 280;
let clickTimer = null;

chrome.action.onClicked.addListener((tab) => {
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
    openDashboard();
    return;
  }
  clickTimer = setTimeout(() => {
    clickTimer = null;
    chrome.action.openPopup({ windowId: tab.windowId }).catch(() => openDashboard());
  }, DOUBLE_CLICK_MS);
});

/* ================= context menu & shortcuts ================= */

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'open-dashboard':
      await openDashboard();
      break;
    case 'save-tab':
      if (tab) await A.saveTabs([tab]);
      break;
    case 'save-link': {
      const s = await S.loadSettings();
      await S.update((state) => {
        const gid = S.ensureGroup(state, s.lastGroupId);
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
  async openUrls({ urls, newWindow, windowId, active }, senderTab) {
    urls = (urls || []).filter((u) => /^(https?|ftp|file|chrome|edge|brave|about):/i.test(u));
    if (!urls.length) return 0;
    if (newWindow) await chrome.windows.create({ url: urls, focused: true });
    else {
      // open next to the dashboard tab, in the requested (or dashboard's) window
      const target = windowId ?? senderTab?.windowId;
      for (let i = 0; i < urls.length; i++) {
        await chrome.tabs.create({ url: urls[i], windowId: target, active: !!active && i === 0 });
      }
    }
    return urls.length;
  },
  async activateTab({ tabId }) {
    const t = await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(t.windowId, { focused: true });
    return true;
  },
  closeTabs: ({ tabIds }) => chrome.tabs.remove(tabIds).then(() => true),
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
    if (o.autoSuspendMinutes !== n.autoSuspendMinutes || o.dashboardUrl !== n.dashboardUrl) init();
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
