// Talks to the tabcat extension through its content script (see extension/content.js).
const PAGE = 'tabcat-page';
const EXT = 'tabcat-ext';

let seq = 0;
const pending = new Map();
const listeners = {};
export let info = null; // { extensionId, version } once the extension answered

window.addEventListener('message', (e) => {
  if (e.source !== window || e.origin !== location.origin || e.data?.source !== EXT) return;
  const m = e.data;
  if (m.reply != null) {
    const p = pending.get(m.reply);
    if (!p) return;
    pending.delete(m.reply);
    clearTimeout(p.timer);
    if (m.error) p.reject(new Error(m.error));
    else p.resolve(m.result);
    return;
  }
  if (m.event === 'ready') info = m.data;
  for (const fn of listeners[m.event] || []) fn(m.data);
});

export function on(event, fn) {
  (listeners[event] ||= []).push(fn);
}

export function call(cmd, args = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`tabcat: "${cmd}" timed out`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    window.postMessage({ source: PAGE, id, cmd, args }, location.origin);
  });
}

// Shorthand for data mutations; see applyOp in extension/lib/store.js for the op format.
export const apply = (...ops) => call('apply', ops);

// Resolves with extension info, or null if the extension does not answer in time.
export function connect(timeout = 1500) {
  return new Promise((resolve) => {
    if (info) return resolve(info);
    const t = setTimeout(() => resolve(null), timeout);
    on('ready', (d) => { clearTimeout(t); resolve(d); });
    window.postMessage({ source: PAGE, cmd: 'hello' }, location.origin);
  });
}
