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

  let greeted = false;
  function hello() {
    greeted = true;
    toPage({ event: 'ready', data: { extensionId: chrome.runtime.id, version: chrome.runtime.getManifest().version } });
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
      port = null;
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

  // Connect only once the page identifies itself as the dashboard (its 'hello'), so other pages
  // on the same origin never talk to the extension.
})();
