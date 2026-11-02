// One live stream for all of this server's pages open in the browser (the dashboard, the account page, the
// admin page; any number of tabs): one of them holds the connection to /api/live and passes what it hears to the
// others. (A browser opens only so many connections to one server, six; a stream each would soon take them all,
// and the pages' other requests, the extension's sync too, would wait for one to close: minutes.)
//
// The one holding it is chosen by a lock (Web Locks; on a plain http:// address, where there are none, by a note in
// localStorage). Closed or gone, another takes over at once. Everything heard is passed as { kind, data }:
//   'head' (the account's latest sync change), 'me' (the account changed), 'admin' (for admins), 'open' (connected
//   again after a break, or newly held: whatever came meanwhile was missed, so look again), 'gone' (signed out).
// liveStream(handle) starts listening (handle(kind, data) in this page) and returns { stop, start }: stop, for the
// back/forward cache (the page frozen holds nothing); start, back again.
const NAME = 'tabcat-live';

export function liveStream(handle) {
  if (typeof EventSource === 'undefined') return { stop() {}, start() {} };
  const ch = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(NAME) : null;
  if (ch) ch.onmessage = (e) => handle(e.data?.kind, e.data?.data);
  const tell = (kind, data) => { handle(kind, data); ch?.postMessage({ kind, data }); };
  let es = null, resign = null, stopped = false, retry = null;

  // holding it: the stream, for everyone
  const hold = (done) => {
    const open = () => {
      es = new EventSource('/api/live');
      for (const k of ['head', 'me', 'admin']) es.addEventListener(k, (e) => { let d = null; try { d = JSON.parse(e.data); } catch { /* none */ } tell(k, d); });
      // (newly held, taken over from a page closed meanwhile, or back after a break: what came between was missed)
      es.addEventListener('open', () => { tell('open'); });
      es.addEventListener('error', async () => { // (the server away a moment: it tries again by itself)
        const r = await fetch('/api/me', { credentials: 'same-origin' }).catch(() => null);
        if (r?.status === 401) { es?.close(); es = null; tell('gone'); return; }
        // (refused for good, too many listening say: again a little later)
        if (es && es.readyState === EventSource.CLOSED) { clearTimeout(retry); retry = setTimeout(() => { if (es) open(); }, 5000); }
      });
    };
    open();
    resign = () => { clearTimeout(retry); es?.close(); es = null; resign = null; done(); };
  };

  let elect;
  if (navigator.locks) {
    let abort = null;
    elect = () => {
      abort = new AbortController();
      navigator.locks.request(NAME, { signal: abort.signal }, () => new Promise((done) => (stopped ? done() : hold(done)))).catch(() => {});
    };
    const unelect = () => { abort?.abort(); resign?.(); };
    elect();
    return { stop() { stopped = true; unelect(); }, start() { stopped = false; elect(); } };
  }

  // (no locks, on http://: a note of who holds it, renewed now and then; one long unrenewed, its page gone without
  // a word, is taken over. A page closing takes its note away, and the next one takes it at once.)
  const KEY = `${NAME}:holder`, me = Math.random().toString(36).slice(2), STALE = 90_000;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify({ id: me, at: Date.now() })); return true; } catch { return false; } };
  let beat = null;
  elect = () => {
    if (stopped || resign) return;
    const now = read();
    if (now && now.id !== me && Date.now() - now.at < STALE) return;
    if (!write()) return hold(() => {}); // (no storage at all: a stream of its own, as before)
    setTimeout(() => { // (two at once: the last to write has it)
      if (stopped || resign || read()?.id !== me) return;
      hold(() => { clearInterval(beat); });
      beat = setInterval(() => { if (read()?.id === me) write(); else resign?.(); }, 20_000);
    }, 200);
  };
  addEventListener('storage', (e) => { if (e.key === KEY && !e.newValue) elect(); });
  setInterval(elect, 30_000);
  const leave = () => { if (resign) { resign(); try { if (read()?.id === me) localStorage.removeItem(KEY); } catch { /* storage unavailable */ } } };
  addEventListener('pagehide', leave);
  elect();
  return { stop() { stopped = true; leave(); }, start() { stopped = false; elect(); } };
}
