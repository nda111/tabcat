// The welcome page (its text: welcome-text.js), opened by the extension once it's installed: the three ways to use
// tabcat (the online dashboard, a copy served on this computer, a server of one's own), each a card whose steps fold
// open; in the language picked on the page (?lang=), else the dashboard's setting, else the browser's. Switching
// cross-fades the text as the privacy page does.
import { LANGS, resolveLang } from './i18n.js';
import { TEXT, EXTENSION_WORDS } from './welcome-text.js';
import { iconSvg } from './icons.js';
import { scrollFeel } from './scroll-feel.js';
import * as B from './bridge.js';

// (each step's command, in order of its {copy}; the server's release is the one these notes go with)
const SERVER_WHEEL = 'https://github.com/nda111/tabcat/releases/download/server-v1.0.0/tabcat_server-1.0.0-py3-none-any.whl';
const COMMANDS = {
  self: ['git clone -b pages https://github.com/nda111/tabcat.git tabcat-dashboard', 'cd tabcat-dashboard && python3 -m http.server 8080'],
  server: [`pip install ${SERVER_WHEEL}`, 'tabcat-server --port 8080'],
};
const LINKS = {
  online: './',
  self: 'https://github.com/nda111/tabcat#hosting-the-dashboard-locally',
  server: 'https://github.com/nda111/tabcat/tree/main/server#readme',
};
// (in a step: the dashboard served here, the server on this computer, and the Docker guide)
const STEP_LINKS = {
  dashboard: 'http://localhost:8080/',
  tabcat: 'http://localhost:8080/',
  docker: 'https://github.com/nda111/tabcat/blob/main/server/DOCKER.md',
  dockerSite: 'https://www.docker.com/get-started/',
};
const ICONS = { online: 'compass', self: 'monitor', server: 'server' };
// Docker's mark (a whale carrying containers), drawn as the other icons are: in the text's colour
const DOCKER_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">'
  + '<rect x="3" y="9" width="3" height="2.6" rx=".4"/><rect x="6.6" y="9" width="3" height="2.6" rx=".4"/><rect x="10.2" y="9" width="3" height="2.6" rx=".4"/>'
  + '<rect x="6.6" y="5.8" width="3" height="2.6" rx=".4"/><rect x="10.2" y="5.8" width="3" height="2.6" rx=".4"/><rect x="13.8" y="9" width="3" height="2.6" rx=".4"/>'
  + '<rect x="10.2" y="2.6" width="3" height="2.6" rx=".4"/>'
  + '<path d="M1.6 12.4h18.2c.5-1.1 1.6-1.7 2.6-1.5-.2-1-.9-1.6-1.8-1.6.1-.9-.3-1.7-.9-2.1-.6.6-.8 1.6-.5 2.5-.4.3-.9.6-1.4.6H1.6c-.2 2.4.5 4.8 2.2 6.4 1.5 1.4 3.6 2.1 6.1 2.1 5 0 8.8-2.4 10.6-6.4h-18.9z"/></svg>';
// The browser's page for extensions' shortcuts: a page can't open it itself, the extension can (asked through its
// bridge, as the dashboard does); without it, the address is copied, to paste
const SHORTCUTS = /Edg\//.test(navigator.userAgent) ? 'edge://extensions/shortcuts'
  : /Whale\//.test(navigator.userAgent) ? 'whale://extensions/shortcuts' : 'chrome://extensions/shortcuts';
const EASE_OUT = 'cubic-bezier(.22, 1, .36, 1)';

const $ = (s) => document.querySelector(s);
const pick = $('#doc-lang'), hero = $('#hero'), ways = $('#ways');
const open = new Set(); // (the cards whose steps are shown: kept across a change of language)
let serverTab = 'computer'; // (the server card's tab: this computer, or Docker)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function wanted() {
  const asked = new URLSearchParams(location.search).get('lang');
  if (Object.hasOwn(TEXT, asked)) return asked;
  let setting = 'auto';
  try { setting = localStorage.getItem('tabcat:lang') || 'auto'; } catch { /* storage unavailable */ }
  return resolveLang(setting);
}

// (a step's text, the extension's words in it marked; a box with a Copy button where its command goes, filled in by
// render from COMMANDS, the card's commands in turn)
const copyButton = (t, value = '') => `<button type="button" class="btn small copy"${value ? ` data-copy="${esc(value)}"` : ''}>${iconSvg('copy', 13)}<span>${esc(t.copy)}</span></button>`;
function words(text, words, t) {
  return esc(text).replace(/\{(allow|connect|command)\}/g, (_, w) => `<span class="word">${esc(words[w])}</span>`)
    .replace(/\{(dashboard|tabcat|docker|dockerSite)\}/g, (_, w) => `<a href="${STEP_LINKS[w]}" target="_blank" rel="noopener">${esc(t.links[w])}</a>`)
    .replace('{shortcuts}', `<a href="${SHORTCUTS}" class="shortcuts-link">${esc(t.links.shortcuts)}</a>`);
}
function step(text, wordsOf, t) {
  let html = words(text, wordsOf, t);
  let boxes = 0;
  html = html.replace(/\s*\{copy\}/g, () => { boxes++; return ''; });
  const box = `<div class="cmd"><code></code>${copyButton(t)}</div>`;
  return `<li>${html}${box.repeat(boxes)}</li>`;
}

function render(lang) {
  const t = TEXT[lang], words_ = EXTENSION_WORDS[lang];
  document.documentElement.lang = lang;
  document.title = `tabcat · ${t.title}`;
  // (each sentence whole on a line where it fits: the lines break between them, and come out about as long)
  hero.innerHTML = `<span class="logo" role="img" aria-label=""></span><h1>${esc(t.hello)}</h1>`
    + `<p class="lead">${t.lead.map((s) => `<span class="sentence">${esc(s)}</span>`).join(' ')}</p>`
    + `<p class="shortcut">${words(t.shortcut, words_, t)}</p>`;
  ways.innerHTML = Object.entries(t.ways).map(([key, w], i) => {
    const list = w.steps && `<ol>${w.steps.map((s) => step(s, words_, t)).join('')}</ol>`;
    // (the server: on this computer, or with Docker, a tab each)
    const panes = w.tabs && `<div class="way-tabs" role="tablist">${Object.entries(w.tabs).map(([k, label]) => `<button type="button" role="tab" class="way-tab" data-tab="${k}" aria-selected="${k === serverTab}">${k === 'docker' ? DOCKER_ICON : iconSvg('monitor', 15)}<span>${esc(label)}</span></button>`).join('')}</div>`
      // (both panes in one place, the box as tall as the taller: switching, nothing below moves)
      + `<div class="way-panes"><div class="way-pane" data-pane="computer"${serverTab === 'computer' ? '' : ' inert'}>${list}</div>`
      + `<div class="way-pane" data-pane="docker"${serverTab === 'docker' ? '' : ' inert'}><ol>${w.dockerSteps.map((s) => step(s, words_, t)).join('')}</ol></div></div>`;
    const steps = w.steps ? `<div class="way-steps"${open.has(key) ? '' : ' hidden'}>${panes || list}</div>` : '';
    const toggle = w.steps ? `<button type="button" class="btn way-toggle" aria-expanded="${open.has(key)}">${esc(open.has(key) ? t.hide : t.show)}${iconSvg('chevron', 14).replace('<svg', '<span class="ico"><svg').replace('</svg>', '</svg></span>')}</button>` : '';
    const external = !LINKS[key].startsWith('./');
    const go = `<a class="btn${key === 'online' ? ' primary' : ''}" href="${LINKS[key]}"${external ? ' target="_blank" rel="noopener"' : ''}>${esc(w.go)}${external ? iconSvg('open', 13) : ''}</a>`;
    return `<article class="way${key === 'online' ? ' recommended' : ''}${open.has(key) ? ' open' : ''}" data-way="${key}" style="--i:${i}">`
      + `<div class="way-head"><span class="way-icon">${iconSvg(ICONS[key], 20)}</span><div class="way-body">`
      + `<h2 class="way-title">${esc(w.title)}${key === 'online' ? `<span class="way-badge">${esc(t.recommended)}</span>` : ''}</h2>`
      + `<p class="way-text">${esc(w.text)}</p><ul class="way-tags">${w.tags.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>`
      + `<div class="way-actions">${key === 'online' ? go + toggle : toggle + go}</div>${steps}</div></div></article>`;
  }).join('');
  for (const card of ways.querySelectorAll('.way')) {
    const cmds = [...(COMMANDS[card.dataset.way] || [])];
    card.querySelectorAll('.cmd').forEach((el) => { const c = cmds.shift(); el.querySelector('code').textContent = c; el.querySelector('.copy').dataset.copy = c; });
  }
  const privacy = $('#privacy-link');
  privacy.textContent = t.privacy;
  privacy.href = `./privacy?lang=${encodeURIComponent(lang)}`;
}

// A card's steps fold open (or shut): the height glides, the text fades, the chevron turns
function fold(card) {
  const key = card.dataset.way, box = card.querySelector('.way-steps'), btn = card.querySelector('.way-toggle');
  const t = TEXT[pick.value], opening = box.hidden;
  box.getAnimations().forEach((a) => a.cancel());
  if (opening) { open.add(key); box.hidden = false; } else open.delete(key);
  card.classList.toggle('open', opening);
  btn.setAttribute('aria-expanded', opening);
  btn.firstChild.textContent = opening ? t.hide : t.show;
  const full = box.scrollHeight;
  const frames = [{ height: '0px', opacity: 0 }, { height: `${full}px`, opacity: 1 }];
  const anim = box.animate(opening ? frames : frames.reverse(), { duration: opening ? 380 : 260, easing: EASE_OUT });
  anim.onfinish = () => { if (!opening) box.hidden = true; };
}

// The server card's tabs: the other pane fades in, the box gliding to its height
function showTab(card, tab) {
  if (tab === serverTab) return;
  serverTab = tab;
  card.querySelectorAll('.way-tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab));
  card.querySelectorAll('.way-pane').forEach((p) => { p.inert = p.dataset.pane !== tab; });
}

document.addEventListener('click', async (e) => {
  const toggle = e.target.closest('.way-toggle');
  if (toggle) return fold(toggle.closest('.way'));
  const tab = e.target.closest('.way-tab');
  if (tab) return showTab(tab.closest('.way'), tab.dataset.tab);
  const shortcuts = e.target.closest('.shortcuts-link');
  if (shortcuts) {
    e.preventDefault();
    if (await B.connect(800)) return B.call('openUrls', { urls: [SHORTCUTS], active: true }).catch(() => {});
    try { await navigator.clipboard.writeText(SHORTCUTS); } catch { /* not allowed: the address is the link's */ }
    return;
  }
  const copy = e.target.closest('.copy');
  if (!copy) return;
  try { await navigator.clipboard.writeText(copy.dataset.copy); } catch { return; }
  const label = copy.querySelector('span');
  label.textContent = TEXT[pick.value].copied;
  copy.classList.add('done');
  label.animate([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE_OUT });
  clearTimeout(copy.timer);
  copy.timer = setTimeout(() => { label.textContent = TEXT[pick.value].copy; copy.classList.remove('done'); }, 1600);
});

pick.append(...Object.entries(LANGS).map(([code, name]) => new Option(name, code)));
pick.value = wanted();
render(pick.value);

// another language: the text cross-fades while each box springs to its new size (as the privacy page)
pick.addEventListener('change', () => {
  const lang = pick.value;
  document.body.classList.add('settled'); // (risen in once: drawn again in another language, the cards stay put)
  const url = new URL(location.href);
  url.searchParams.set('lang', lang);
  history.replaceState(null, '', url);
  if (!document.startViewTransition) return render(lang);
  const parts = () => [hero, ...ways.querySelectorAll('.way')];
  const name = () => parts().forEach((el, i) => { el.style.viewTransitionName = `welcome-${i}`; el.style.viewTransitionClass = 'settings-part'; });
  name();
  const vt = document.startViewTransition(() => { render(lang); name(); });
  vt.ready.catch(() => {});
  vt.finished.finally(() => parts().forEach((el) => { el.style.viewTransitionName = ''; el.style.viewTransitionClass = ''; }));
});

// the page scrolls with give at its ends, with the dashboard's slim scrollbar
scrollFeel(document.documentElement, { inner: true });
