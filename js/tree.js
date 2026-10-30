// Read-only helpers over the tabcat tree (the extension owns and mutates the data).
import { info } from './bridge.js';

export function children(node) {
  if (!node) return null;
  switch (node.type) {
    case 'workspace': return node.categories;
    case 'category': return node.groups;
    case 'group':
    case 'folder': return node.items;
    default: return null;
  }
}

// Returns { node, list, index, parent, ancestors } or null.
export function locate(state, id) {
  const stack = [];
  function rec(list, parent) {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.id === id) return { node: n, list, index: i, parent, ancestors: [...stack] };
      const c = children(n);
      if (c) {
        stack.push(n);
        const r = rec(c, n);
        stack.pop();
        if (r) return r;
      }
    }
    return null;
  }
  return rec(state.workspaces, null);
}

// Folders nest at most MAX_FOLDER_DEPTH deep (a folder directly in a group is at depth 1).
export const MAX_FOLDER_DEPTH = 4;

// Levels of folders in `node` itself (0 for a link, 1 for a folder without subfolders, ...).
export const folderHeight = (n) =>
  (n?.type === 'folder' ? 1 + Math.max(0, ...(n.items || []).map(folderHeight)) : 0);

// How many folders enclose the list of `parentId` (0 inside a group).
export function folderDepth(state, parentId) {
  const r = parentId && locate(state, parentId);
  return r ? [...r.ancestors, r.node].filter((n) => n.type === 'folder').length : 0;
}

export const fitsDepth = (state, parentId, node) => folderDepth(state, parentId) + folderHeight(node) <= MAX_FOLDER_DEPTH;

export function walk(list, cb, ancestors = []) {
  for (const n of list) {
    cb(n, ancestors);
    const c = children(n);
    if (c) walk(c, cb, [...ancestors, n]);
  }
}

export function collectLinks(node) {
  if (node.type === 'link') return [node];
  const out = [];
  const c = children(node);
  if (c) walk(c, (x) => { if (x.type === 'link') out.push(x); });
  return out;
}

export const countLinks = (node) => (node.type === 'link' ? 1 : collectLinks(node).length);

const segmenter = Intl.Segmenter ? new Intl.Segmenter() : null;

let RGI_EMOJI = null;
try { RGI_EMOJI = new RegExp('^\\p{RGI_Emoji}$', 'v'); } catch { /* no /v flag support */ }

export function isSingleEmoji(s) {
  if (!s) return true; // symbol is optional
  if (RGI_EMOJI?.test(s)) return true;
  const graphemes = segmenter ? [...segmenter.segment(s)].length : [...s].length;
  return graphemes === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(s);
}

// A symbol is optional: a single emoji, or one capital letter / digit (shown as a badge).
export const isLetterSymbol = (s) => /^[A-Z0-9]$/.test(s);
export const normalizeSymbol = (s) => {
  s = String(s ?? '').trim();
  return /^[a-z]$/.test(s) ? s.toUpperCase() : s;
};
// the tabcat logo as a symbol (drawn in the accent colour; as text, a cat emoji stands in for it)
export const LOGO_SYMBOL = ':tabcat:';
export const isLogoSymbol = (s) => s === LOGO_SYMBOL;
export const isValidSymbol = (s) => !s || isLetterSymbol(s) || isLogoSymbol(s) || isSingleEmoji(s);
// a symbol as the start of a tab group's title: emoji only (the logo as a cat; a letter would read as
// part of the name)
export const textSymbol = (s) => (isLogoSymbol(s) ? '🐱' : s && !isLetterSymbol(s) ? s : '');

export function normalizeUrl(u) {
  u = (u || '').trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  return u;
}

const BLANK_ICON = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#999" stroke-width="1.3"/></svg>');

// Favicons are served by the extension (_favicon is web-accessible to the dashboard origin).
export function faviconFor(pageUrl, size = 32) {
  if (!info?.extensionId || !pageUrl) return BLANK_ICON;
  return `chrome-extension://${info.extensionId}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}
export { BLANK_ICON };
