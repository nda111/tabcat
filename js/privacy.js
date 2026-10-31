// The privacy page (its text: privacy-text.js): the policy in the language picked on the page (?lang=),
// else the dashboard's language setting, else the browser's; switching cross-fades the text while the card
// springs to its new size, as the dashboard's Settings does.
import { LANGS, resolveLang } from './i18n.js';
import { TEXT } from './privacy-text.js';

const EFFECTIVE = new Date(2026, 9, 31);

const $ = (s) => document.querySelector(s);
const card = $('#doc'), pick = $('#doc-lang');

function wanted() {
  const asked = new URLSearchParams(location.search).get('lang');
  if (Object.hasOwn(TEXT, asked)) return asked;
  let setting = 'auto';
  try { setting = localStorage.getItem('tabcat:lang') || 'auto'; } catch { /* storage unavailable */ }
  return resolveLang(setting);
}

function render(lang) {
  const t = TEXT[lang];
  document.documentElement.lang = lang;
  document.title = `tabcat · ${t.title}`;
  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(EFFECTIVE);
  const block = (b) => Array.isArray(b) ? `<ul>${b.map((li) => `<li>${li}</li>`).join('')}</ul>` : `<p>${b}</p>`;
  card.innerHTML = `<h1>${t.title}</h1><p class="doc-date">${t.effective.replace('{date}', date)}</p>`
    + `<div class="doc-summary"><strong>${t.summaryTitle}</strong><p>${t.summary}</p></div>`
    + t.sections.map(([h, ...blocks], i) => `<h2><span class="doc-n">${i + 1}.</span> ${h}</h2>${blocks.map(block).join('')}`).join('');
}

pick.append(...Object.entries(LANGS).map(([code, name]) => new Option(name, code)));
pick.value = wanted();
render(pick.value);
document.documentElement.classList.remove('booting');

// another language: the card springs to its new size while the text cross-fades (see switchLang)
pick.addEventListener('change', () => {
  const lang = pick.value;
  const url = new URL(location.href);
  url.searchParams.set('lang', lang);
  history.replaceState(null, '', url);
  if (!document.startViewTransition) return render(lang);
  const named = [[card, 'settings-frame'], ...[...card.children].map((el) => [el, 'settings-part'])];
  const name = () => named.forEach(([el, cls], i) => { el.style.viewTransitionName = `doc-${i}`; el.style.viewTransitionClass = cls; });
  name();
  const vt = document.startViewTransition(() => {
    render(lang);
    named.splice(1, Infinity, ...[...card.children].map((el) => [el, 'settings-part']));
    name();
  });
  vt.ready.catch(() => {});
  vt.finished.finally(() => named.forEach(([el]) => { el.style.viewTransitionName = ''; el.style.viewTransitionClass = ''; }));
});
