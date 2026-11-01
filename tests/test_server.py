# The user's own server: connected (from the toolbar button's menu, through connect.html, once the browser
# allows tabcat there), the extension links up with the dashboard it hosts as it does with tabcat.ghyeok.com:
# the dashboard there connects, opens on the shortcut, and shows the sites' icons (the extension hands them
# over: the browser won't let that page load them itself). Disconnecting goes back to tabcat.ghyeok.com.
# (The browser's "allow" prompt can't be clicked here: the test copy of the extension is allowed already.)
from harness import *

SERVER = f'http://myserver.test:{8765}'
serve()
errors = []
with sync_playwright() as p:
    # (served over plain http here, the page has no navigator.userAgentData: it goes by the user agent,
    # which headless Chromium marks as such; over https, as a server is, it needn't)
    ctx, sw = launch(p, manifest={'host_permissions': ['http://myserver.test/*']},
                     extra_args=['--host-resolver-rules=MAP myserver.test 127.0.0.1'],
                     user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
    menu = lambda: sw.evaluate("new Promise(r => chrome.contextMenus.update('server', {}, () => r(!chrome.runtime.lastError)))")
    check(menu(), 'the toolbar button has the server item')
    # the connect window
    ext = sw.url.rsplit('/', 1)[0]
    c = ctx.new_page(); c.on('pageerror', lambda e: errors.append(str(e)))
    c.goto(f'{ext}/connect.html'); time.sleep(.5)
    check(c.inner_text('.brand').strip() != '' and c.is_visible('#address'), 'connect.html shows its form')
    c.fill('#address', 'not a url ://'); c.click('#go'); time.sleep(.3)
    check('error' in c.get_attribute('#msg', 'class'), f"a bad address is refused ({c.inner_text('#msg')!r})")
    # connect (as the form does once allowed)
    with ctx.expect_page(lambda pg: pg.url.startswith(SERVER) or pg.url == 'about:blank', timeout=15000) as opened:
        r = c.evaluate(f"chrome.runtime.sendMessage({{ cmd: 'connectServer', args: {{ origin: '{SERVER}' }} }})")
    check(r and r.get('result') is True, f'connected ({r})')
    dash = opened.value
    dash.wait_for_url(f'{SERVER}/**', timeout=15000)
    check(dash is not None, f"the server's dashboard opens ({[pg.url for pg in ctx.pages]})")
    dash.on('pageerror', lambda e: errors.append(str(e)))
    dash.wait_for_selector('.ws-item', timeout=15000); time.sleep(1)
    check(dash.evaluate("document.querySelector('#no-ext').hidden"), 'and links up with the extension there')
    s = sw.evaluate("chrome.storage.local.get('tabcat:settings').then(r=>r['tabcat:settings'])")
    check(s['server'] == SERVER and s['dashboardUrl'].startswith(SERVER), f"the shortcut opens it ({s['dashboardUrl']})")
    # icons: handed over by the extension (data: URLs), not loaded from it
    srcs = dash.evaluate("[...document.querySelectorAll('img.fav')].map(i=>i.src.slice(0, 22))")
    check(srcs and all(not x.startswith('chrome-extension') for x in srcs) and any(x.startswith('data:image') for x in srcs), f'icons come as images from the extension ({srcs[:4]})')
    # the bridge can't connect a server: only the extension's own pages can
    r2 = dash.evaluate("new Promise(res => { const id = 'x' + Math.random(); addEventListener('message', (e) => { if (e.data?.reply === id) res(e.data); }); postMessage({ source: 'tabcat-page', id, cmd: 'connectServer', args: { origin: 'http://evil.test' } }, location.origin); })")
    check(r2.get('error'), f"a dashboard can't connect a server itself ({r2})")
    # disconnect: back to tabcat.ghyeok.com, no longer linked
    r = c.evaluate("chrome.runtime.sendMessage({ cmd: 'disconnectServer' })")
    s = sw.evaluate("chrome.storage.local.get('tabcat:settings').then(r=>r['tabcat:settings'])")
    reg = sw.evaluate("chrome.scripting.getRegisteredContentScripts().then(r=>r.map(x=>x.id))")
    check(s['server'] is None and s['dashboardUrl'] == 'https://tabcat.ghyeok.com/' and reg == [], f'disconnected: back to tabcat.ghyeok.com ({s["dashboardUrl"]}, {reg})')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
