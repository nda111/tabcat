// Bridge between the tabcat web dashboard (page world) and the extension (background).
// Page -> extension: window.postMessage({ source: 'tabcat-page', id, cmd, args })
// Extension -> page: window.postMessage({ source: 'tabcat-ext', reply: id, result | error })
//                    window.postMessage({ source: 'tabcat-ext', event, data })
(() => {
  const PAGE = 'tabcat-page';
  const EXT = 'tabcat-ext';
  let port = null;

  const toPage = (msg) => window.postMessage({ source: EXT, ...msg }, location.origin);
  const alive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };

  // What this extension can do, for the dashboard to turn its features on by (rather than by version):
  // wakeTabs (load suspended tabs again), logoSymbol (the logo as a symbol), looseData (keeps any symbol,
  // colour, column or plain field a newer dashboard sends), sharedHistory (undo / redo across dashboards)
  const FEATURES = ['wakeTabs', 'logoSymbol', 'looseData', 'sharedHistory'];

  let greeted = false;
  let parked = false; // page is in the back/forward cache
  function hello() {
    greeted = true;
    toPage({ event: 'ready', data: { extensionId: chrome.runtime.id, version: chrome.runtime.getManifest().version, features: FEATURES } });
  }

  function connect() {
    if (!alive()) return null;
    try {
      port = chrome.runtime.connect({ name: 'tabcat-bridge' });
    } catch {
      port = null;
      return null;
    }
    port.onMessage.addListener(toPage);
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError; // read it so Chrome doesn't log "Unchecked runtime.lastError"
      port = null;
      if (parked) return; // we closed it ourselves for the back/forward cache
      // the service worker may have been recycled; reconnect so push events keep flowing
      if (alive()) setTimeout(() => { if (!port && connect()) hello(); }, 200);
      else toPage({ event: 'disconnected' });
    });
    return port;
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin || e.data?.source !== PAGE) return;
    if (e.data.cmd === 'hello') { if (port || connect()) hello(); return; }
    if (!greeted) return; // page must say hello first
    if (!port && !connect()) { toPage({ reply: e.data.id, error: 'tabcat extension is not available (reload the page)' }); return; }
    port.postMessage({ id: e.data.id, cmd: e.data.cmd, args: e.data.args });
  });

  // A page in the back/forward cache may not hold a port (Chrome would close it with an error), so
  // release it on the way in and reconnect on the way back; 'ready' makes the page refresh its data.
  window.addEventListener('pagehide', (e) => {
    if (!e.persisted || !port) return;
    parked = true;
    port.disconnect();
    port = null;
  });
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    parked = false;
    if (greeted && !port && connect()) hello();
  });

  // Connect only once the page identifies itself as the dashboard (its 'hello'), so other pages
  // on the same origin never talk to the extension.
})();
