// Lazy MathJax loader. renderMarkdown wraps TeX in <span class="math"> (class "display" for blocks)
// with \( \) / \[ \] delimiters; only those elements are typeset.

const MATHJAX_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
let loading = null;

function load() {
  if (!loading) {
    window.MathJax = {
      tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']], processEscapes: false },
      svg: { fontCache: 'global' },
      startup: { typeset: false },
    };
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MATHJAX_URL;
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

// Typesets every not-yet-rendered math element under `root`; leaves the raw TeX if MathJax is unavailable.
export function typesetMath(root = document) {
  const els = [...root.querySelectorAll('.math:not([data-typeset])')];
  if (!els.length) return;
  queue = queue
    .then(load)
    .then(() => {
      const live = els.filter((el) => el.isConnected);
      live.forEach((el) => { el.dataset.typeset = ''; });
      window.MathJax.typesetClear();
      return window.MathJax.typesetPromise(live);
    })
    .catch(() => {});
}
