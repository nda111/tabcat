# The user's own server: connected (from the toolbar button's menu, through connect.html, once the browser
# allows tabcat there), the extension links up with the dashboard it hosts as it does with tabcat.ghyeok.com:
# the dashboard there connects, opens on the shortcut, and shows the sites' icons (the extension hands them
# over: the browser won't let that page load them itself). The server has data of its own, apart from the
# browser's; open dashboards load again on connecting and disconnecting; the browser's own dashboard says
# tabcat is on the server meanwhile. Before connecting, the server's dashboard says how to connect.
# (The browser's "allow" prompt can't be clicked here: the test copy of the extension is allowed already.)
import os, re
from harness import *

SERVER = f'http://tabcat.localhost:{PORT}'  # (any *.localhost is this computer, and a secure context: as a server over https)
WS = "chrome.storage.local.get('tabcat').then(r=>r.tabcat.workspaces.map(w=>w.name))"
serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p, manifest={'host_permissions': ['*://tabcat.localhost/*']})
    menu = lambda: sw.evaluate("new Promise(r => chrome.contextMenus.update('server', {}, () => r(!chrome.runtime.lastError)))")
    check(menu(), 'the toolbar button has the server item')
    # (the browser shows only the first ACTION_MENU_TOP_LEVEL_LIMIT of the button's items: it must be among them)
    n = sw.evaluate("Promise.resolve(chrome.contextMenus.ACTION_MENU_TOP_LEVEL_LIMIT)")
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'background.js')).read()
    on_button = len(re.findall(r"^\s*\['[\w-]+', '\w+', \[[^\]]*'action'", src, re.M)) + 1 + src.count("type: 'separator', contexts: ['action']")
    check(on_button <= n, f'the toolbar button has no more items than the browser shows ({on_button} of {n})')

    # the browser's own dashboard (here: localhost), with data of its own
    local = dashboard(ctx, errors)
    seed(sw, local, workspace('Mine', [group('G', [link('a')])]))
    # the server's dashboard, before connecting: no extension there, and how to connect
    srv = ctx.new_page(); srv.on('pageerror', lambda e: errors.append(str(e)))
    srv.set_viewport_size({'width': 1300, 'height': 800})
    srv.goto(SERVER + '/'); time.sleep(1.5)
    step2 = srv.inner_text('#no-ext-step2')
    check(srv.is_visible('#no-ext') and 'connect to the server' in step2, f"before connecting, the server's dashboard says to connect to it ({step2!r})")
    check(srv.inner_text('#no-ext-title') == 'Not connected to your tabcat server.' and local.locator('#no-ext-title').inner_text() == 'tabcat extension not found.',
          f"(titled as not connected to the server: {srv.inner_text('#no-ext-title')!r})")

    # the connect window
    ext = sw.url.rsplit('/', 1)[0]
    c = ctx.new_page(); c.on('pageerror', lambda e: errors.append(str(e)))
    c.goto(f'{ext}/connect.html'); time.sleep(.5)
    check(c.is_visible('#address'), 'connect.html shows its form')
    # it shows in the look it's opened with from its first paint (not the default orange first)
    look = ctx.new_page()
    look.add_init_script("window.__accents = []; new MutationObserver(() => __accents.push(document.documentElement.dataset.accent || '')).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-accent'] })")
    look.goto(f'{ext}/connect.html?theme=dark&accent=blue&hue=262'); time.sleep(.5)
    first = look.evaluate('__accents')
    check(first[:1] == ['blue'] and look.evaluate("document.documentElement.dataset.theme") == 'dark', f'connect.html takes the look it is opened with at once ({first})')
    look.close()
    # opened from a server's dashboard, its address is filled in (without the scheme: it needn't be typed)
    c2 = ctx.new_page(); c2.goto(f'{ext}/connect.html?address=' + SERVER); time.sleep(.4)
    check(c2.input_value('#address') == f'tabcat.localhost:{PORT}', f"opened from a server's dashboard, its address is filled in ({c2.input_value('#address')!r})")
    c2.close()
    # what connect.html asks for is what the manifest lets it ask for: the browser puts the question to the
    # user (asked for anything else, it refuses outright, and the window would say tabcat wasn't allowed)
    ask = "(o) => Promise.race([chrome.permissions.request({ origins: o }).then(() => 'answered', (e) => 'refused: ' + e.message), new Promise((r) => setTimeout(() => r('asking'), 1500))])"
    q = ctx.new_page(); q.goto(f'{ext}/connect.html'); time.sleep(.3)
    ours = q.evaluate(ask, ['https://some.server/*', 'http://some.server/*'])
    q.close()
    check(ours == 'asking', f"what connect.html asks for, the browser asks the user ({ours!r})")
    check("['https', 'http'].map((p) => `${p}://" in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'connect.js')).read(), '(connect.js asks in that form)')
    c.fill('#address', 'not a url ://'); c.click('#go'); time.sleep(.3)
    check('error' in c.get_attribute('#msg', 'class'), f"a bad address is refused ({c.inner_text('#msg')!r})")
    # the extension's own refusals, which connect.html words as its own messages
    nope = c.evaluate("chrome.runtime.sendMessage({ cmd: 'connectServer', args: { origin: 'http://nope.localhost:9' } })")
    bad = c.evaluate("chrome.runtime.sendMessage({ cmd: 'connectServer', args: { origin: 'http://tabcat.localhost:8765/x' } })")
    check(nope.get('error') == 'not-allowed' and bad.get('error') == 'bad-origin', f"the extension's refusals: not allowed there, not an address ({nope}, {bad})")
    check(all(k in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'connect.js')).read() for k in ("'not-allowed'", "'bad-origin'", "'connectFailed'")), '(connect.js words each)')
    # connect (as the form does once allowed): the open server dashboard loads again and links up
    r = c.evaluate(f"chrome.runtime.sendMessage({{ cmd: 'connectServer', args: {{ origin: '{SERVER}' }} }})")
    check(r and r.get('result') is True, f'connected ({r})')
    srv.wait_for_selector('.ws-item', timeout=15000); time.sleep(1)
    check(srv.evaluate("document.querySelector('#no-ext').hidden"), 'the open server dashboard loads again, linked up')
    check(len([pg for pg in ctx.pages if pg.url.startswith(SERVER)]) == 1, 'and no second one is opened')
    s = sw.evaluate("chrome.storage.local.get('tabcat:settings').then(r=>r['tabcat:settings'])")
    check(s['server'] == SERVER and s['dashboardUrl'].startswith(SERVER), f"the shortcut opens it ({s['dashboardUrl']})")
    names = srv.evaluate("[...document.querySelectorAll('.ws-item')].map(e=>e.querySelector('.name').textContent)")
    check('Mine' not in names and sw.evaluate(WS) != [], f"the server has data of its own, not the browser's ({names})")
    # the browser's own dashboard: loaded again, it says tabcat is on the server
    time.sleep(1)
    check(local.is_visible('#elsewhere') and SERVER in local.get_attribute('#elsewhere-open', 'href'), "the browser's dashboard says tabcat is on the server, and links to it")
    check(local.locator('#toast .toast-item').count() == 0, f"with no error toasts ({local.locator('#toast').inner_text()!r})")
    # icons: handed over by the extension (data: URLs), not loaded from it
    srcs = srv.evaluate("[...document.querySelectorAll('img.fav')].map(i=>i.src.slice(0, 22))")
    check(srcs and all(not x.startswith('chrome-extension') for x in srcs) and any(x.startswith('data:image') for x in srcs), f'icons come as images from the extension ({srcs[:4]})')
    # the bridge can't connect a server: only the extension's own pages can
    r2 = srv.evaluate("new Promise(res => { const id = 'x' + Math.random(); addEventListener('message', (e) => { if (e.data?.reply === id) res(e.data); }); postMessage({ source: 'tabcat-page', id, cmd: 'connectServer', args: { origin: 'http://evil.test' } }, location.origin); })")
    check(r2.get('error'), f"a dashboard can't connect a server itself ({r2})")
    # something made on the server stays on the server
    sw.evaluate("chrome.storage.local.get('tabcat').then(r=>{const s=r.tabcat; s.workspaces.push({id:'srv',type:'workspace',name:'OnServer',symbol:'',description:'',categories:[{id:'srvc',type:'category',name:'C',groups:[]}]}); return chrome.storage.local.set({tabcat:s})})")
    time.sleep(.5)
    # disconnect: back to the browser's own data; the server's dashboard loads again, unlinked
    r = c.evaluate("chrome.runtime.sendMessage({ cmd: 'disconnectServer' })")
    s = sw.evaluate("chrome.storage.local.get('tabcat:settings').then(r=>r['tabcat:settings'])")
    reg = sw.evaluate("chrome.scripting.getRegisteredContentScripts().then(r=>r.map(x=>x.id))")
    check(s['server'] is None and s['dashboardUrl'] == 'https://tabcat.ghyeok.com/' and reg == [], f'disconnected: back to tabcat.ghyeok.com ({s["dashboardUrl"]}, {reg})')
    check('Mine' in sw.evaluate(WS) and 'OnServer' not in sw.evaluate(WS), f"the browser's own data is back ({sw.evaluate(WS)})")
    time.sleep(2)
    check(srv.is_visible('#no-ext'), "the server's dashboard loads again: no longer linked")
    local.wait_for_selector('.ws-item', timeout=15000)
    check(not local.is_visible('#elsewhere') and 'Mine' in local.evaluate("[...document.querySelectorAll('.ws-item')].map(e=>e.querySelector('.name').textContent)"), "the browser's dashboard loads again with its data")
    # connecting again: the server's data is still there
    c.evaluate(f"chrome.runtime.sendMessage({{ cmd: 'connectServer', args: {{ origin: '{SERVER}' }} }})")
    check('OnServer' in sw.evaluate(WS) and 'Mine' not in sw.evaluate(WS), f"connected again, the server's data is back ({sw.evaluate(WS)})")
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
