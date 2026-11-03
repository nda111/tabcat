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
  // colour, column or plain field a newer dashboard sends), sharedHistory (undo / redo across dashboards),
  // closeHistory (closing tabs / windows is undoable; they return with their tab groups; getTabs tells
  // each tab's group and each window's groups), shortcuts (getShortcuts: the keys each command has),
  // trash (Recently deleted: a remove marked `trash` is kept 30 days; getTrash, restoreTrash, emptyTrash;
  // a 'trash' event when it changes), moveTabs (moveTabs: tabs dropped in the open tabs panel move there,
  // in and out of tab groups; getTabs tells each tab's index), favicons (favicons: the icons as images, for a
  // dashboard on the user's own server, which the browser won't let load them from the extension itself),
  // deviceTabs (connected to a server, this browser's open tabs go to it for the account's other browsers;
  // deviceId: which one this is; openUrls takes an `index` in the window)
  const FEATURES = ['wakeTabs', 'logoSymbol', 'looseData', 'sharedHistory', 'closeHistory', 'shortcuts', 'trash', 'moveTabs', 'favicons', 'deviceTabs'];

  let greeted = false;
  let parked = false; // page is in the back/forward cache
  // (installed from the Chrome Web Store, the manifest has the store's update_url: the browser keeps it
  // up to date, and the dashboard needn't look for releases)
  async function hello() {
    greeted = true;
    const manifest = chrome.runtime.getManifest();
    // (connected to the user's own server, its dashboard is the one: another is told where it is)
    const server = (await chrome.storage.local.get('tabcat:settings').catch(() => ({})))['tabcat:settings']?.server || null;
    // (icons straight from the extension only where the manifest lets pages load them: elsewhere, ask)
    const direct = (manifest.web_accessible_resources || []).flatMap((r) => r.matches)
      .some((m) => { try { return new URL(m.replace(/\*$/, '')).hostname === location.hostname; } catch { return false; } });
    toPage({ event: 'ready', data: { extensionId: chrome.runtime.id, version: manifest.version, features: FEATURES, updatesItself: !!manifest.update_url, favicons: direct ? 'direct' : 'ask', server } });
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
    port.postMessage({ editing }); // (linked up, anew too: a page loaded again, or the service worker recycled)
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
    // (a server's own pages, signing in: is the extension here, and linked to this server? Nothing more:
    // no link to the extension is opened for them)
    if (e.data.cmd === 'probe') {
      chrome.storage.local.get('tabcat:settings').catch(() => ({})).then((r) => {
        toPage({ event: 'probe', data: { server: r['tabcat:settings']?.server || null } });
      });
      return;
    }
    // (the server's own pages, hearing the account changed elsewhere: the extension looks at once, rather than at its
    // next look a minute on, when no dashboard is open to tell it. Nothing comes back; no link opened)
    if (e.data.cmd === 'sync') { if (alive()) chrome.runtime.sendMessage({ cmd: 'syncNow' }).catch(() => {}); return; }
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

  // The extension reloaded or updated leaves this script behind, cut off, and Chrome doesn't always say
  // so through the port: check now and then, and tell the page (it loads again, linking up anew).
  const watch = setInterval(() => {
    if (alive()) return;
    clearInterval(watch);
    if (greeted) toPage({ event: 'disconnected' });
  }, 2000);

  // (sync, connected to the user's own server: back online, or the dashboard looked at again, the extension
  // checks with the server now; it would anyway, a little later)
  const nudge = () => { if (greeted && alive()) chrome.runtime.sendMessage({ cmd: 'syncNow' }).catch(() => {}); };
  window.addEventListener('online', nudge);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') nudge(); });

  // A dialog open (an edit under way): the extension is told, so that updated, it doesn't load this dashboard again
  // under it from outside (see reloadDashboardsAfterUpdate); the page waits for it to be done itself.
  let editing = false;
  new MutationObserver(() => {
    const now = !!document.querySelector('dialog[open]');
    if (now === editing) return;
    editing = now;
    if (port) try { port.postMessage({ editing }); } catch { /* cut off */ }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });

  // Connect only once the page identifies itself as the dashboard (its 'hello'), so other pages
  // on the same origin never talk to the extension.
})();
