// The welcome page (its text: welcome-text.js), opened by the extension once it's installed: the three ways to use
// tabcat (the online dashboard, a copy served on this computer, a server of one's own), each a card whose steps fold
// open; in the language picked on the page (?lang=), else the dashboard's setting, else the browser's. Switching
// cross-fades the text as the privacy page does.
import { LANGS, resolveLang } from './i18n.js';
import { TEXT, EXTENSION_WORDS } from './welcome-text.js';
import { iconSvg } from './icons.js';
import { scrollFeel } from './scroll-feel.js';

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
const ICONS = { online: 'compass', self: 'monitor', server: 'server' };
const EASE_OUT = 'cubic-bezier(.22, 1, .36, 1)';
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const $ = (s) => document.querySelector(s);
const pick = $('#doc-lang'), hero = $('#hero'), ways = $('#ways');
const open = new Set(); // (the cards whose steps are shown: kept across a change of language)
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
function step(text, words, t) {
  let html = esc(text).replace(/\{(allow|connect)\}/g, (_, w) => `<span class="word">${esc(words[w])}</span>`);
  let boxes = 0;
  html = html.replace(/\s*\{copy\}/g, () => { boxes++; return ''; });
  const box = `<div class="cmd"><code></code><button type="button" class="btn small copy">${iconSvg('copy', 13)}<span>${esc(t.copy)}</span></button></div>`;
  return `<li>${html}${box.repeat(boxes)}</li>`;
}

function render(lang) {
  const t = TEXT[lang], words = EXTENSION_WORDS[lang];
  document.documentElement.lang = lang;
  document.title = `tabcat · ${t.title}`;
  const keys = (mac ? ['⌘', 'Shift', 'X'] : ['Ctrl', 'Shift', 'X']).map((k) => `<kbd>${k}</kbd>`).join('+');
  hero.innerHTML = `<span class="logo" role="img" aria-label=""></span><h1>${esc(t.hello)}</h1><p>${esc(t.lead)}</p>`
    + `<p class="shortcut">${esc(t.shortcut).replace('{keys}', keys)}</p>`;
  ways.innerHTML = Object.entries(t.ways).map(([key, w], i) => {
    const steps = w.steps ? `<div class="way-steps"${open.has(key) ? '' : ' hidden'}><ol>${w.steps.map((s) => step(s, words, t)).join('')}</ol></div>` : '';
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

ways.addEventListener('click', async (e) => {
  const toggle = e.target.closest('.way-toggle');
  if (toggle) return fold(toggle.closest('.way'));
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
