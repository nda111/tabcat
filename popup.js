import * as S from './lib/store.js';
import * as A from './lib/actions.js';

const $ = (sel) => document.querySelector(sel);
const msg = (t) => { $('#msg').textContent = t; };

(async function init() {
  const [[tab], state, settings, all] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    S.load(), S.loadSettings(), chrome.tabs.query({}),
  ]);
  if (settings.theme !== 'auto') document.documentElement.dataset.theme = settings.theme;
  A.setDashboardUrl(settings.dashboardUrl);
  $('#stats').textContent = `${all.length} tabs · ${all.filter((t) => t.discarded).length} 💤`;

  // target select: Workspace / Category → groups
  const sel = $('#target');
  for (const { ws, cat, group } of S.allGroups(state)) {
    const label = `${ws.symbol ? ws.symbol + ' ' : ''}${ws.name} / ${cat.name}`;
    let og = [...sel.children].find((o) => o.label === label);
    if (!og) { og = document.createElement('optgroup'); og.label = label; sel.append(og); }
    og.append(new Option(`${group.symbol ? group.symbol + ' ' : ''}${group.name}`, group.id));
  }
  if (!sel.options.length) sel.append(new Option('📥 Inbox (new)', ''));
  if (settings.lastGroupId && [...sel.options].some((o) => o.value === settings.lastGroupId)) sel.value = settings.lastGroupId;
  $('#close').checked = settings.closeOnSave;

  if (tab && A.isSaveable(tab)) {
    $('#cur-name').value = tab.title || tab.url;
    $('#cur-url').textContent = tab.url;
    $('#cur-icon').src = tab.favIconUrl || S.faviconFor(tab.url);
  } else {
    $('#cur-name').value = 'This page cannot be saved';
    $('#cur-name').disabled = true;
    $('#save-tab').disabled = true;
  }

  $('#save-tab').addEventListener('click', async () => {
    const groupId = sel.value || null;
    await S.saveSettings({ lastGroupId: groupId });
    const named = { ...tab, title: $('#cur-name').value.trim() || tab.title };
    msg('Saved ✔');
    await chrome.runtime.sendMessage({ cmd: 'saveTabs', args: { tabs: [named], parentId: groupId, close: $('#close').checked } });
    setTimeout(() => window.close(), 500);
  });

  $('#save-window').addEventListener('click', async () => {
    msg('Saving window…');
    const { result } = await chrome.runtime.sendMessage({ cmd: 'saveWindow', args: { windowId: tab.windowId, close: $('#close').checked } });
    msg(result ? 'Window saved as a new group ✔' : 'Nothing to save');
  });
  $('#suspend').addEventListener('click', async () => msg(`Suspended ${await A.suspendTabs({})} tabs`));
  $('#dedupe').addEventListener('click', async () => msg(`Closed ${await A.closeDuplicates()} duplicates`));
  $('#open').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ cmd: 'openDashboard' });
    window.close();
  });
})();
