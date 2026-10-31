// Minimal, safe markdown renderer for group notes.
// Input is HTML-escaped first; only a whitelisted subset is produced.
// Task list items render as checkboxes carrying data-line (source line index) for toggling.
// Math: $inline$ or \(inline\), $$display$$ or \[display\], and \begin{env}…\end{env} (inline or as
// blocks spanning lines); typeset later by math.js.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

const SAFE_URL = /^(https?:|mailto:)/i;

const mathInline = (tex) => `<span class="math">\\(${tex}\\)</span>`;
const mathBlock = (tex) => `<span class="math display">\\[${tex}\\]</span>`;
const mathEnv = (tex) => `<span class="math display">${tex}</span>`; // \begin{…}…\end{…}, delimits itself
const DISPLAY_ENV = /^(equation|align|alignat|gather|multline|flalign|eqnarray)\*?$/;
const ENV = /\\begin\{([a-zA-Z]+\*?)\}[\s\S]*?\\end\{\1\}/g;

function inline(text) {
  // code spans and urls are stashed as placeholders so emphasis rules can't touch them
  const stash = [];
  const put = (html) => `\u0000${stash.push(html) - 1}\u0000`;
  let s = escapeHtml(text).replace(/`([^`]+)`/g, (_, c) => put(`<code>${c}</code>`));
  s = s.replace(/\$\$([^$]+?)\$\$/g, (_, tex) => put(mathBlock(tex)));
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => put(mathBlock(tex)));
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => put(mathInline(tex)));
  // equation-like environments are displays; others (pmatrix, cases, …) sit in the line
  s = s.replace(ENV, (tex, env) => put(DISPLAY_ENV.test(env) ? mathEnv(tex) : mathInline(tex)));
  // $...$ must hug its content and not be followed by a digit, so prices like "$5 and $10" stay text
  s = s.replace(/(^|[^\\$])\$([^\s$](?:[^$]*?[^\s$\\])?)\$(?!\d)/g, (_, pre, tex) => pre + put(mathInline(tex)));
  s = s.replace(/\\\$/g, '$'); // \$ is a literal dollar sign
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) =>
    SAFE_URL.test(url) ? `<a href="${put(url)}" target="_blank" rel="noopener">${label}</a>` : m);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, pre, url) =>
    `${pre}<a href="${put(url)}" target="_blank" rel="noopener">${put(url)}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[i]);
}

export function renderMarkdown(src) {
  const lines = String(src || '').split('\n');
  const out = [];
  let list = null; // 'ul' | 'ol'
  let para = [];
  let code = null;
  let math = null; // an open display block spanning lines: { lines, end, wrap }
  const closeMath = () => out.push(math.wrap(escapeHtml(math.lines.join('\n'))));

  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const openList = (t) => { if (list !== t) { closeList(); out.push(`<${t}>`); list = t; } };

  lines.forEach((line, i) => {
    if (code !== null) {
      if (/^```/.test(line)) { out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); code = null; }
      else code.push(line);
      return;
    }
    if (math !== null) {
      const end = line.indexOf(math.end);
      if (end < 0) { math.lines.push(line); return; }
      // an environment keeps its \end{…}; $$ and \] are just delimiters
      math.lines.push(math.wrap === mathEnv ? line.slice(0, end + math.end.length) : line.slice(0, end));
      closeMath();
      math = null;
      return;
    }
    let m;
    if (/^```/.test(line)) { flushPara(); closeList(); code = []; return; }
    if ((m = line.match(/^\s*\$\$(.*)$/))) {
      const end = m[1].indexOf('$$');
      if (end < 0) { flushPara(); closeList(); math = { lines: [m[1]], end: '$$', wrap: mathBlock }; return; }
      if (!m[1].slice(end + 2).trim()) { flushPara(); closeList(); out.push(mathBlock(escapeHtml(m[1].slice(0, end)))); return; }
    }
    if ((m = line.match(/^\s*\\\[(.*)$/)) && !m[1].includes('\\]')) {
      flushPara(); closeList(); math = { lines: [m[1]], end: '\\]', wrap: mathBlock }; return;
    }
    if ((m = line.match(/^\s*\\begin\{([a-zA-Z]+\*?)\}/)) && !line.includes(`\\end{${m[1]}}`)) {
      flushPara(); closeList(); math = { lines: [line.trim()], end: `\\end{${m[1]}}`, wrap: mathEnv }; return;
    }
    if (!line.trim()) { flushPara(); closeList(); return; }
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara(); closeList();
      const n = Math.min(m[1].length + 2, 6); // notes are small: shift heading levels down
      out.push(`<h${n}>${inline(m[2])}</h${n}>`);
      return;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flushPara(); closeList(); out.push('<hr>'); return; }
    if ((m = line.match(/^\s*>\s?(.*)$/))) { flushPara(); closeList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); return; }
    if ((m = line.match(/^\s*(?:[-*+]\s+)?\[([ xX])\](?:\s+(.*))?$/))) { // "[ ] task", or as a list item "- [ ] task"
      flushPara(); openList('ul');
      const checked = m[1] !== ' ';
      out.push(`<li class="task${checked ? ' done' : ''}"><input type="checkbox" data-line="${i}"${checked ? ' checked' : ''}> <span><span class="task-text">${inline(m[2] || '')}</span></span></li>`);
      return;
    }
    if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) { flushPara(); openList('ul'); out.push(`<li>${inline(m[1])}</li>`); return; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); openList('ol'); out.push(`<li>${inline(m[1])}</li>`); return; }
    closeList();
    para.push(line);
  });
  if (code !== null) out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  if (math !== null) closeMath();
  flushPara(); closeList();
  return out.join('');
}

// Toggle a task checkbox on source line `i`.
export function toggleTask(src, i) {
  const lines = String(src || '').split('\n');
  lines[i] = lines[i].replace(/\[([ xX])\]/, (_, c) => (c === ' ' ? '[x]' : '[ ]'));
  return lines.join('\n');
}
