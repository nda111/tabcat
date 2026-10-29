import * as S from './lib/store.js';
import * as A from './lib/actions.js';

const $ = (sel) => document.querySelector(sel);
const msg = (t) => { $('#msg').textContent = t; $('#msg').hidden = !t; };

(async function init() {
  const [[tab], state, settings, all] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    S.load(), S.loadSettings(), chrome.tabs.query({}),
  ]);
  if (settings.theme !== 'auto') document.documentElement.dataset.theme = settings.theme;
  A.setDashboardUrl(settings.dashboardUrl);
  const sleeping = all.filter((t) => t.discarded).length;
  $('#stats').textContent = [`${all.length} tab${all.length === 1 ? '' : 's'}`, sleeping && `${sleeping} suspended`].filter(Boolean).join(' · ');

  const target = groupPicker(S.allTargets(state), settings.lastGroupId);
  $('#close').checked = settings.closeOnSave;
  $('#close').addEventListener('change', () => S.saveSettings({ closeOnSave: $('#close').checked }));

  if (tab && A.isDashboard(tab.url || tab.pendingUrl || '')) {
    $('#save-card').hidden = true; // on the dashboard itself there is no tab to save
  } else if (tab && A.isSaveable(tab)) {
    $('#cur-name').value = tab.title || tab.url;
    $('#cur-url').textContent = tab.url;
    $('#cur-icon').src = tab.favIconUrl || S.faviconFor(tab.url);
  } else {
    $('#cur-name').value = 'This page cannot be saved';
    $('#cur-name').disabled = true;
    $('#save-tab').disabled = true;
  }

  $('#save-tab').addEventListener('click', async () => {
    const groupId = target.value || null;
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

// Emoji symbols show as text, letter/digit symbols as a badge.
function setSym(el, s) {
  const letter = S.isLetterSymbol(s);
  el.classList.toggle('sym-letter', letter);
  if (!letter) return void (el.textContent = s);
  const glyph = document.createElement('span');
  glyph.className = 'sym-glyph';
  glyph.textContent = s;
  el.replaceChildren(glyph);
}

// "Save to" picker: a button showing the chosen group or folder, opening a searchable list grouped
// by workspace › category, with folders indented under their group. Returns { value } (an id, or ''
// for a new Inbox when there are none).
const MAX_INDENT = 4;
const POPUP_MAX_HEIGHT = 600;

function groupPicker(entries, initialId) {
  const btn = $('#target-btn');
  const panel = $('#target-panel');
  const search = $('#target-search');
  const list = $('#target-list');
  const headOf = ({ ws, cat }) => `${ws.symbol ? ws.symbol + ' ' : ''}${ws.name} › ${cat.name}`;
  const pathOf = (e) => [headOf(e), ...e.trail].join(' › ');
  const symOf = (e) => e.node.symbol || (e.node.type === 'folder' ? '📁' : '🗂️');
  const picker = { value: '' };
  let items = [];
  let active = -1;

  function show(entry) {
    picker.value = entry ? entry.node.id : '';
    setSym($('#target-sym'), entry ? symOf(entry) : '📥');
    $('#target-name').textContent = entry ? entry.node.name : 'Inbox (new)';
    $('#target-path').textContent = entry ? pathOf(entry) : 'A new group will be created';
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    // a search shows matches with their full path; no search shows the indented tree
    const hits = entries.filter((e) => !q || `${e.node.name} ${pathOf(e)}`.toLowerCase().includes(q));
    const nodes = [];
    let last = null;
    items = [];
    for (const e of hits) {
      const head = headOf(e);
      if (head !== last) {
        const el = document.createElement('div');
        el.className = 'picker-head';
        el.textContent = head;
        nodes.push(el);
        last = head;
      }
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'picker-item' + (e.node.type === 'folder' ? ' folder' : '');
      // indent up to four levels; deeper folders stay put so their names keep the room
      item.style.paddingLeft = `${6 + (q ? 0 : Math.min(e.depth, MAX_INDENT) * 14)}px`;
      item.title = [...e.trail, e.node.name].join(' › ');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(e.node.id === picker.value));
      item.innerHTML = '<span class="sym"></span><span class="name"></span><span class="where muted"></span>';
      setSym(item.querySelector('.sym'), symOf(e));
      item.querySelector('.name').textContent = e.node.name;
      if (q && e.trail.length) item.querySelector('.where').textContent = e.trail.join(' › ');
      item.addEventListener('click', () => { show(e); close(); });
      item.addEventListener('mousemove', () => setActive(items.indexOf(item), false));
      items.push(item);
      nodes.push(item);
    }
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'picker-empty';
      empty.textContent = 'No matching groups or folders';
      nodes.push(empty);
    }
    list.replaceChildren(...nodes);
    setActive(Math.max(0, items.findIndex((it) => it.getAttribute('aria-selected') === 'true')));
  }

  // scroll only for keyboard moves: scrolling under the mouse would make the list jump
  function setActive(i, scroll = true) {
    items[active]?.classList.remove('active');
    active = items.length ? Math.max(0, Math.min(items.length - 1, i)) : -1;
    items[active]?.classList.add('active');
    if (scroll) items[active]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // Chrome caps a popup at 600px tall; size the list to the room left so the popup never scrolls.
  function fitList() {
    list.style.maxHeight = '';
    const room = POPUP_MAX_HEIGHT - (document.body.getBoundingClientRect().height - list.offsetHeight);
    list.style.maxHeight = `${Math.max(96, Math.min(list.scrollHeight, Math.floor(room) - 1))}px`;
  }

  function open() {
    if (!entries.length) return;
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    search.value = '';
    render();
    fitList();
    search.focus();
  }
  function close() {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', () => (panel.hidden ? open() : close()));
  search.addEventListener('input', render);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); items[active]?.click(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
  });

  show(entries.find((e) => e.node.id === initialId) || entries[0] || null);
  btn.disabled = !entries.length;
  return picker;
}
