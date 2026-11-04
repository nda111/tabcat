// Keeping an account's tabcat the same in each of its browsers, through the user's own server.
//
// What's kept in step (a "doc"): the workspace tree, Recently deleted and the settings (all of the dashboard's
// Settings: the look, the language, the columns, closing saved tabs...; not where things are). What a
// browser changes is found by comparing the doc as it was last time with the doc now (so any way it changed
// counts: the dashboard, the menu, undo, an import), as a few small steps. One change (the steps found at
// once) goes to the server with an id of its own; the server numbers the changes in the order they come and
// hands them to every browser, which apply them to the doc in that order, the same way everywhere: so all
// end up the same. Changes to different things both survive; to the same thing, the later one wins.
//
// The steps (a change's `ops`), each by the ids the extension already gives everything:
//   { o: 'add',  id, p, a, f }  a new node `id` (its own fields `f`, with its type; its children come as adds
//                               of their own, after it) in parent `p` (null: a workspace), after sibling `a`
//                               (null: first; not there: last)
//   { o: 'move', id, p, a }     node `id` to parent `p`, after `a`
//   { o: 'set',  id, f }        some of node `id`'s own fields
//   { o: 'del',  id }           node `id`, with all in it
//   { o: 'trash+', e } / { o: 'trash-', id }  an entry of Recently deleted, in / out
//   { o: 'look', f }            settings (named for the first of them, the theme and accent)
// A step that can't be done any more (its parent deleted meanwhile, say) is skipped, in every browser alike.

import * as S from './store.js';

export const LOOK = ['theme', 'accent', 'language', 'columns', 'closeOnSave', 'groupTabs', 'autoSuspendMinutes', 'checkUpdates', 'defaultGroupId', 'fontScale'];
const KIDS = ['categories', 'groups', 'items'];
// each browser's own, never kept in step: whether a card (or folder) is open or shut here
const LOCAL = ['collapsed'];

// a node's own fields (not its children, nor what's this browser's own)
const own = (n) => Object.fromEntries(Object.entries(n).filter(([k]) => !KIDS.includes(k) && k !== 'id' && !LOCAL.includes(k)));
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

// id -> { node, parent (id or null), prev (the sibling before it, or null), index }
function flatten(workspaces) {
  const m = new Map();
  const rec = (list, parent) => list.forEach((n, i) => {
    m.set(n.id, { node: n, parent, prev: i ? list[i - 1].id : null, index: i });
    const c = S.children(n);
    if (c) rec(c, n.id);
  });
  rec(workspaces, null);
  return m;
}

// The longest run of `xs` already in increasing order (their indexes), to move as few as can be
function steady(xs) {
  const tails = [], prev = new Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (xs[tails[mid]] < xs[i]) lo = mid + 1; else hi = mid; }
    prev[i] = lo ? tails[lo - 1] : -1;
    tails[lo] = i;
  }
  const keep = new Set();
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) keep.add(i);
  return keep;
}

// The steps that make doc `a` into doc `b`
export function diff(a, b) {
  const ops = [];
  const A = flatten(a.workspaces), B = flatten(b.workspaces);
  // in each parent, the children that stay there: those not in their old order move
  const moved = new Set();
  const lists = new Map(); // parent -> children ids in b
  for (const [id, x] of B) {
    const k = x.parent ?? '';
    if (!lists.has(k)) lists.set(k, []);
    lists.get(k).push(id);
  }
  for (const [, ids] of lists) {
    const stay = ids.filter((id) => A.has(id) && A.get(id).parent === B.get(id).parent);
    const keep = steady(stay.map((id) => A.get(id).index));
    stay.forEach((id, i) => { if (!keep.has(i)) moved.add(id); });
  }
  // parents before children, siblings in order: each one's parent and the sibling before it are in place first
  const rec = (list, parent) => list.forEach((n, i) => {
    const a = i ? list[i - 1].id : null;
    const was = A.get(n.id);
    if (!was) ops.push({ o: 'add', id: n.id, p: parent, a, f: own(n) });
    else {
      if (was.node.type !== n.type) { ops.push({ o: 'del', id: n.id }, { o: 'add', id: n.id, p: parent, a, f: own(n) }); }
      else {
        if (was.parent !== parent || moved.has(n.id)) ops.push({ o: 'move', id: n.id, p: parent, a });
        const f = {};
        for (const [k, v] of Object.entries(own(n))) if (!same(v, was.node[k])) f[k] = v;
        if (Object.keys(f).length) ops.push({ o: 'set', id: n.id, f });
      }
    }
    const c = S.children(n);
    if (c) rec(c, n.id);
  });
  rec(b.workspaces, null);
  // gone: the outermost of what went (what's in it goes with it; anything kept was moved out above)
  for (const [id, x] of A) if (!B.has(id) && !(x.parent && !B.has(x.parent))) ops.push({ o: 'del', id });
  // Recently deleted
  const ta = new Set((a.trash || []).map((e) => e.id)), tb = new Set((b.trash || []).map((e) => e.id));
  for (const e of b.trash || []) if (!ta.has(e.id)) ops.push({ o: 'trash+', e });
  for (const e of a.trash || []) if (!tb.has(e.id)) ops.push({ o: 'trash-', id: e.id });
  // the look
  const look = {};
  for (const k of LOOK) if ((b.look || {})[k] !== (a.look || {})[k] && (b.look || {})[k] !== undefined) look[k] = b.look[k];
  if (Object.keys(look).length) ops.push({ o: 'look', f: look });
  return ops;
}

// where `after` puts something in `list`: just after it; null: first; not there: last
const at = (list, after) => {
  if (after == null) return 0;
  const i = list.findIndex((n) => n.id === after);
  return i < 0 ? list.length : i + 1;
};
const listOf = (doc, p) => (p == null ? doc.workspaces : S.children(S.locate(doc, p)?.node));

// Does the steps to `doc`, in place
export function apply(doc, ops) {
  for (const op of ops || []) {
    try { step(doc, op); } catch { /* can't any more: skipped */ }
  }
  return doc;
}
function step(doc, op) {
  switch (op.o) {
    case 'add': {
      if (S.locate(doc, op.id)) { // (there already: put where it says, as it says)
        step(doc, { ...op, o: 'move' });
        step(doc, { o: 'set', id: op.id, f: op.f });
        return;
      }
      const list = listOf(doc, op.p);
      if (!list) return;
      const node = S.normalizeNode({ ...op.f, id: op.id });
      if (!node) return;
      for (const k of KIDS) if (k in node) node[k] = [];
      S.insertNode(doc, op.p, node, at(list, op.a));
      return;
    }
    case 'move': {
      const list = listOf(doc, op.p);
      if (!list || op.a === op.id) return;
      S.moveNode(doc, op.id, op.p, at(list, op.a));
      return;
    }
    case 'set': {
      const r = S.locate(doc, op.id);
      if (!r) return;
      for (const [k, v] of Object.entries(op.f || {})) if (!KIDS.includes(k) && k !== 'id' && k !== 'type' && !LOCAL.includes(k)) r.node[k] = v;
      return;
    }
    case 'del': S.removeNode(doc, op.id); return;
    case 'trash+': {
      doc.trash ||= [];
      if (!op.e?.id || doc.trash.some((e) => e.id === op.e.id)) return;
      doc.trash.push(op.e);
      doc.trash.sort((x, y) => (y.deletedAt || 0) - (x.deletedAt || 0));
      return;
    }
    case 'trash-': doc.trash = (doc.trash || []).filter((e) => e.id !== op.id); return;
    case 'look': doc.look = { ...(doc.look || {}), ...Object.fromEntries(LOOK.filter((k) => k in (op.f || {})).map((k) => [k, op.f[k]])) }; return;
  }
}

// A change as kept on the server: its steps (versioned, for later kinds)
export const body = (ops) => ({ v: 1, ops });
export const opsOf = (b) => (b && b.v === 1 && Array.isArray(b.ops) ? b.ops : []);

// a doc in a form fit to compare and to keep (a copy)
export function docOf({ state, trash, settings }) {
  return {
    workspaces: structuredClone(S.normalize(state).workspaces),
    trash: structuredClone(trash || []),
    look: Object.fromEntries(LOOK.map((k) => [k, settings?.[k] ?? S.DEFAULT_SETTINGS[k]])),
  };
}
export const clone = (doc) => structuredClone(doc);

// The tree to show, with what's this browser's own (open or shut) as it is here (`local`: the tree as it is now),
// whatever the others' say; something new from elsewhere as it came
export function keepLocal(workspaces, local) {
  const here = new Map();
  const walk = (list, fn) => (list || []).forEach((n) => { fn(n); walk(S.children(n), fn); });
  walk(local, (n) => here.set(n.id, n));
  const out = structuredClone(workspaces);
  walk(out, (n) => { const h = here.get(n.id); if (h) for (const k of LOCAL) { if (k in h) n[k] = h[k]; else delete n[k]; } });
  return out;
}

// gzip, for what's large enough to be worth it (the server unpacks it)
export async function packed(obj) {
  const text = JSON.stringify(obj);
  if (text.length < 1024 || typeof CompressionStream === 'undefined') return { body: text, headers: {} };
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return { body: await new Response(stream).arrayBuffer(), headers: { 'Content-Encoding': 'gzip' } };
}

// ---------- shared workspaces ----------
// A workspace shared between accounts is data of its own (a "share", kept in step by itself, as an account's is),
// not the account's: the account's doc keeps only a stub where it goes in the list ({ id, type, share }), and what
// the browser shows is the account's doc with each stub replaced by its share's workspace (join). A change here is
// split back the same way (split): the account's part, and each share's. `shares`: { [share id]: { root, role,
// shadow } } as sync keeps them (root: the workspace's id; shadow: the share's doc as last looked at).

export const stub = (w) => ({ id: w.id, type: 'workspace', share: w.share });
const rootOf = (doc, id) => (doc?.workspaces || []).find((w) => w.id === id) || null;

// the doc shown: the account's with its shares' workspaces in place of their stubs (a stub whose share isn't here,
// not yet or not any more: left out)
export function join(personal, parts) {
  const workspaces = [];
  for (const w of personal.workspaces) {
    if (!w.share) { workspaces.push(w); continue; }
    const root = rootOf(parts[w.share], w.id);
    if (root) workspaces.push({ ...root, share: w.share });
  }
  return { ...personal, workspaces };
}

// The doc shown, back in its parts: { personal, parts: { [share id]: doc }, fix } (fix: what's shown has to change
// to fit: a shared workspace gone from it, by undo or an import say, comes back (left only by leaving it); one
// copied, its copy is the account's own)
export function split(doc, personalShadow, shares) {
  let fix = false;
  const loaded = (w) => w.share && shares[w.share] && shares[w.share].root === w.id;
  const was = new Map((personalShadow?.workspaces || []).map((w) => [w.id, w]));
  const workspaces = [];
  const parts = {};
  for (const w of doc.workspaces) {
    if (loaded(w)) {
      parts[w.share] = { workspaces: [w], trash: [], look: {} };
      const old = was.get(w.id);
      workspaces.push(old && old.share === w.share ? old : stub(w));
    } else if (w.share && was.get(w.id)?.share === w.share) { // (one let go, its share not here now: not shown)
      fix = true;
    } else if (w.share) { // (a copy of one: the account's own)
      const { share, ...own } = w;
      workspaces.push(own);
      fix = true;
    } else workspaces.push(w);
  }
  // stubs not shown (their share not here) stay where they were; shares gone from what's shown come back
  const have = new Set(workspaces.map((w) => w.id));
  const old = personalShadow?.workspaces || [];
  old.forEach((w, i) => {
    if (!w.share || have.has(w.id)) return;
    const back = shares[w.share] && shares[w.share].root === w.id;
    if (back) { parts[w.share] = shares[w.share].shadow; fix = true; }
    let at = 0; // (after the one before it, if it's still there)
    for (let j = i - 1; j >= 0; j--) { const k = workspaces.findIndex((x) => x.id === old[j].id); if (k >= 0) { at = k + 1; break; } }
    workspaces.splice(at, 0, w);
    have.add(w.id);
  });
  for (const [id, sh] of Object.entries(shares)) if (!parts[id]) parts[id] = sh.shadow;
  return { personal: { ...doc, workspaces }, parts, fix };
}
