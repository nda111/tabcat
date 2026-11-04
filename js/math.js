// Lazy MathJax loader. renderMarkdown wraps TeX in <span class="math"> (class "display" for blocks)
// with \( \) / \[ \] delimiters; only those elements are typeset.

const MATHJAX_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
let loading = null;

function load() {
  if (!loading) {
    window.MathJax = {
      // (a note may be someone else's, in a shared workspace: no \style, \class, \cssId or \data (the html extension),
      // \href, and no extensions loaded on demand (require); see safeLinks too)
      tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']], processEscapes: false,
        packages: { '[-]': ['html', 'require'] }, autoload: { html: [], require: [] } },
      svg: { fontCache: 'local' }, // self-contained SVGs, so cached copies render anywhere
      startup: { typeset: false },
    };
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MATHJAX_URL;
      // (only this very file: a copy changed on the CDN is refused, not run)
      s.integrity = 'sha384-KKWa9jJ1MZvssLeOoXG6FiOAZfAgmzsIIfw8BXwI9+kYm0lPCbC6yTQPBC00F1/L';
      s.crossOrigin = 'anonymous';
      s.async = true;
      s.onload = () => window.MathJax.startup.promise.then(resolve, reject);
      s.onerror = () => { loading = null; reject(new Error('MathJax failed to load')); };
      document.head.append(s);
    });
  }
  return loading;
}

let queue = Promise.resolve();

// Resolves once every math element queued so far is typeset (or given up on).
export const mathReady = () => queue;

// Typeset output by source, so a re-render (which rebuilds every note) reuses it at once instead of
// showing the raw TeX and changing every note's height again a moment later.
const cache = new Map(); // `${className}|${tex}` -> rendered node
const keyOf = (el) => `${el.className}|${el.textContent}`;

// (an address in what's drawn: MathJax's own references to its glyphs (#...), or a web page or an e-mail address;
// anything else (javascript:, data:...) loses it. \href is gone with the html extension: this is a second guard)
const SAFE_HREF = /^(#|https?:|mailto:)/i;
function safeLinks(el) {
  for (const n of el.querySelectorAll('*')) {
    for (const at of [...n.attributes]) {
      if (at.localName !== 'href') continue;
      if (!SAFE_HREF.test(at.value.trim())) n.removeAttributeNode(at);
      else if (n.localName === 'a') { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); }
    }
  }
}
// Typesets every not-yet-rendered math element under `root`; leaves the raw TeX if MathJax is unavailable.
export function typesetMath(root = document) {
  const els = [];
  for (const el of root.querySelectorAll('.math:not([data-typeset])')) {
    const done = cache.get(keyOf(el));
    if (done) { el.replaceChildren(done.cloneNode(true)); el.dataset.typeset = ''; }
    else els.push(el);
  }
  if (!els.length) return;
  queue = queue
    .then(load)
    .then(() => {
      const live = els.filter((el) => el.isConnected);
      const keys = live.map(keyOf);
      live.forEach((el) => { el.dataset.typeset = ''; });
      window.MathJax.typesetClear();
      return window.MathJax.typesetPromise(live).then(() => {
        live.forEach(safeLinks);
        live.forEach((el, i) => { if (el.firstElementChild) cache.set(keys[i], el.firstElementChild.cloneNode(true)); });
      });
    })
    .catch(() => {});
}
