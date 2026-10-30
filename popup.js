import * as S from './lib/store.js';
import * as A from './lib/actions.js';
import { setLang, getLang, t } from './lib/i18n.js';

// accent colours (hue in oklch), as in the dashboard's Settings > Color
const ACCENT_HUES = { red: 25, orange: 55, yellow: 90, lime: 125, green: 150, teal: 185, sky: 225, blue: 262, purple: 300, pink: 350 };

const $ = (sel) => document.querySelector(sel);
// Shrink back into the toolbar button, then close. (When Chrome closes the popup itself, e.g. on a
// click elsewhere, it disappears at once: a closing popup gets no time to animate.)
function closePopup(delay = 0) {
  setTimeout(() => {
    document.body.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.55)' }],
      { duration: 130, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' }).finished.then(() => window.close());
  }, delay);
}

const msg = (t) => { $('#msg').textContent = t; $('#msg').hidden = !t; };

(async function init() {
  const [[tab], state, settings, all] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    S.load(), S.loadSettings(), chrome.tabs.query({}),
  ]);
  setLang(settings.language);
  document.documentElement.lang = getLang();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  if (settings.theme !== 'auto') document.documentElement.dataset.theme = settings.theme;
  const hue = ACCENT_HUES[settings.accent];
  if (settings.accent === 'mono') document.documentElement.dataset.accent = 'mono'; // (no hue: see popup.css)
  else if (hue != null && settings.accent !== 'orange') {
    document.documentElement.dataset.accent = settings.accent;
    document.documentElement.style.setProperty('--hue', hue);
  }
  A.setDashboardUrl(settings.dashboardUrl);
  const sleeping = all.filter((t) => t.discarded).length;
  $('#stats').textContent = [t('tabCount', { n: all.length }), sleeping && t('sleeping', { n: sleeping })].filter(Boolean).join(' · ');

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
    $('#cur-name').value = t('cannotSave');
    $('#cur-name').disabled = true;
    $('#save-tab').disabled = true;
  }

  $('#save-tab').addEventListener('click', async () => {
    const groupId = target.value || null;
    await S.saveSettings({ lastGroupId: groupId });
    const named = { ...tab, title: $('#cur-name').value.trim() || tab.title };
    msg(t('saved'));
    await chrome.runtime.sendMessage({ cmd: 'saveTabs', args: { tabs: [named], parentId: groupId, close: $('#close').checked } });
    closePopup(450);
  });

  $('#save-window').addEventListener('click', async () => {
    msg(t('savingWindow'));
    const { result } = await chrome.runtime.sendMessage({ cmd: 'saveWindow', args: { windowId: tab.windowId, close: $('#close').checked } });
    msg(t(result ? 'windowSaved' : 'nothingToSave'));
  });
  $('#suspend').addEventListener('click', async () => msg(t('suspended', { n: await A.suspendTabs({}) })));
  $('#dedupe').addEventListener('click', async () => msg(t('closedDupes', { n: await A.closeDuplicates() })));
  $('#open').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ cmd: 'openDashboard' });
    closePopup();
  });
})();

// Emoji symbols show as text, letter/digit symbols as a badge.
// (null: a folder's default, the line folder icon, as on the dashboard)
const FOLDER_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
function setSym(el, s) {
  el.classList.toggle('sym-icon', s == null);
  if (s == null) { el.classList.remove('sym-letter'); el.innerHTML = FOLDER_ICON; return; }
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
  const symOf = (e) => e.node.symbol || (e.node.type === 'folder' ? null : '🗂️');
  const picker = { value: '' };
  let items = [];
  let active = -1;

  function show(entry) {
    picker.value = entry ? entry.node.id : '';
    setSym($('#target-sym'), entry ? symOf(entry) : '📥');
    $('#target-name').textContent = entry ? entry.node.name : t('inboxNew');
    $('#target-path').textContent = entry ? pathOf(entry) : t('newGroupNote');
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
      empty.textContent = t('noTargets');
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
