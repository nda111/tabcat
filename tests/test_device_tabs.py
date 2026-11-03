# The account's other browsers' open tabs, in the open tabs panel: each browser connected to the server tells it which
# tabs it has open; the others show them, a part a device, shut until opened, kept up to date live. Another
# browser's tab dragged into a window here opens here (a copy: still open there), onto the board becomes a link;
# a browser let go from the list goes. (Needs fastapi and uvicorn: pip install fastapi uvicorn)
import os, sys, tempfile, threading
from harness import *
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server'))
import uvicorn
from tabcat_server import config as C
from tabcat_server.app import create_app

PORT = 8779
SERVER = f'http://tabcat.localhost:{PORT}'
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
APP = create_app(C.load(tempfile.mkdtemp(), dashboard=WEB))

def serve():
    srv = uvicorn.Server(uvicorn.Config(APP, host='127.0.0.1', port=PORT, log_level='warning'))
    threading.Thread(target=srv.run, daemon=True).start()
    while not srv.started: time.sleep(.05)
    return srv
srv = serve()

def wait(fn, what, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        try:
            v = fn()
            if v: return v
        except Exception: pass
        time.sleep(.25)
    return fn()

TREE = "chrome.storage.local.get('tabcat').then(r => r.tabcat)"
def names(sw): return sw.evaluate(f"{TREE}.then(s => s.workspaces.map(w => w.name))")
def edit(sw, js):  # (a change made here, as the dashboard would: the tree in storage)
    sw.evaluate(f"{TREE}.then(s => {{ {js}; return chrome.storage.local.set({{ tabcat: s }}); }})")
def ask(page, cmd):
    return page.evaluate("c => chrome.runtime.sendMessage({ cmd: c }).then(r => r.result)", cmd)

def browser(p, errors, name, first):
    ctx, sw = launch(p, manifest={'host_permissions': ['*://tabcat.localhost/*']})
    ext = sw.url.rsplit('/', 1)[0]
    # the browser's own data, before the server
    sw.evaluate(f"chrome.storage.local.set({{ tabcat: {{ version: 1, workspaces: [{{ id: 'own-{name}', type: 'workspace', name: 'Own {name}', symbol: '', description: '', categories: [{{ id: 'c-{name}', type: 'category', name: 'C', groups: [{{ id: 'g-{name}', type: 'group', name: 'G {name}', symbol: '', color: '', note: '', collapsed: false, column: 0, items: [] }}] }}] }}] }} }})")
    d = ctx.new_page(); d.on('pageerror', lambda e: errors.append(str(e)))
    d.goto(SERVER + '/'); time.sleep(.6)
    c = ctx.new_page(); c.goto(f'{ext}/connect.html'); time.sleep(.3)
    c.evaluate(f"chrome.runtime.sendMessage({{ cmd: 'connectServer', args: {{ origin: '{SERVER}' }} }})")
    d.wait_for_selector('#username', timeout=15000); d.bring_to_front()
    d.fill('#username', 'boss'); d.fill('#password', 'correct horse')
    if first:
        d.fill('#again', 'correct horse'); d.click('#go'); d.wait_for_url('**/admin')
    else:
        d.click('#go'); time.sleep(1.5)
    # (the dashboard: the one the extension keeps, wherever it is)
    for _ in range(40):
        dash = [pg for pg in ctx.pages if pg.url.rstrip('/') == SERVER and pg.locator('.ws-item').count()]
        if dash: break
        if _ == 4:
            try: ctx.new_page().goto(SERVER + '/')
            except Exception: pass  # (sent to the dashboard there is)
        if _ == 30: print([(pg.url, pg.locator('.ws-item').count(), pg.locator('#no-ext').count() and pg.is_visible('#no-ext')) for pg in ctx.pages])
        time.sleep(.5)
    d = dash[0]; d.on('pageerror', lambda e: errors.append(str(e)))
    return ctx, sw, c, d

errors = []
with sync_playwright() as p:
    actx, a, ac, ad = browser(p, errors, 'A', True)
    wait(lambda: (s := ask(ac, 'syncStatus')) and s['seq'] is not None and s, 'A synced')
    bctx, b, bc, bd = browser(p, errors, 'B', False)
    wait(lambda: names(b) == ['Own A'], 'B took the server')

    # A opens a page: B sees it under A's part
    pa = actx.new_page(); pa.goto(SERVER + '/privacy?from-a')
    ok = wait(lambda: bd.locator('.devs .dev').count() == 1, 'A shown in B', timeout=15)
    check(ok and bd.locator('.devs .dev.collapsed').count() == 1 and bd.locator('.devs .rtab').count() == 0,
          f"B's open tabs panel: A's part, shut to begin with ({bd.locator('.devs .dev').count()})")
    name = bd.inner_text('.devs .dev-name')
    check(name.strip() != '' and 'tab' in bd.inner_text('.devs .dev-meta'), f"named for its browser, with how many tabs and when ({name!r}, {bd.inner_text('.devs .dev-meta')!r})")
    check(bd.locator('.devs .dev').count() == 1 and not bd.locator(f".devs .dev[data-device='{b.evaluate('chrome.storage.local.get(\'tabcat:device\').then(r => r[\'tabcat:device\'])') or 'x'}']").count(), "not B itself")
    bd.click('.devs .dev-head'); time.sleep(.5)
    urls = lambda: bd.evaluate("[...document.querySelectorAll('.devs .rtab')].map(r => r.dataset.url)")
    check(wait(lambda: SERVER + '/privacy?from-a' in urls(), 'opened', timeout=10) and not any(u.startswith('chrome-extension:') for u in urls()), f"opened: its tabs (not tabcat's own pages) ({urls()})")

    # live: A opens another
    pa2 = actx.new_page(); pa2.goto(SERVER + '/privacy?second')
    check(wait(lambda: SERVER + '/privacy?second' in urls(), 'live', timeout=10), f'A opens another: B shows it at once, no reload ({urls()})')

    # dragged into a window of B: opened there, still open in A
    before = len(bc.evaluate("chrome.tabs.query({}).then(ts => ts.map(t => t.url))"))
    src = bd.locator(f".devs .rtab[data-url='{SERVER}/privacy?second']")
    src.drag_to(bd.locator('#windows .win .win-head').first); time.sleep(1.5)
    tabs_b = bc.evaluate("chrome.tabs.query({}).then(ts => ts.map(t => t.url))")
    tabs_a = ac.evaluate("chrome.tabs.query({}).then(ts => ts.map(t => t.url))")
    check(len(tabs_b) == before + 1 and SERVER + '/privacy?second' in tabs_b and SERVER + '/privacy?second' in tabs_a, f'dragged into a window here: opened here, still open there ({len(tabs_b) - before} more here)')

    # dragged onto the board: a link
    src = bd.locator(f".devs .rtab[data-url='{SERVER}/privacy?from-a']")
    src.drag_to(bd.locator('#board .group').first); time.sleep(1.2)
    links = b.evaluate(f"{TREE}.then(s => JSON.stringify(s)).then(j => (j.match(/privacy\\?from-a/g) || []).length)")
    check(links == 1, f'dragged onto the board: saved as a link ({links})')

    # named: double-click the name, type, Enter; every browser of the account shows it
    bd.dblclick('.devs .dev-name'); bd.wait_for_selector('.devs .dev-rename')
    bd.fill('.devs .dev-rename', 'Work PC'); bd.press('.devs .dev-rename', 'Enter'); time.sleep(.8)
    got = ad.evaluate("fetch('/api/sync/tabs').then(r => r.json()).then(r => r.devices.map(d => d.name))")
    check(bd.inner_text('.devs .dev-name') == 'Work PC' and 'Work PC' in got and bd.locator('.devs .dev:not(.collapsed)').count() == 1,
          f"named in place (double-click): shown, kept for the account; not opened or shut by it ({got})")
    pa.goto(SERVER + '/privacy?third'); time.sleep(3)
    check(bd.inner_text('.devs .dev-name') == 'Work PC', 'kept as that browser goes on')

    # let go from the list, from the right-click menu only
    check(not bd.locator('.devs .dev-head button:not(.win-twisty)').count(), 'no button on it to let it go by a slip')
    bd.click('.devs .dev-head', button='right'); bd.wait_for_selector('#menu:not([hidden])')
    items = bd.evaluate("[...document.querySelectorAll('#menu button')].map(b => b.textContent.trim())")
    check(any('Rename' in i for i in items) and any('Remove' in i for i in items), f'its menu: rename, remove ({items})')
    bd.locator('#menu button', has_text='Remove').click(); time.sleep(1)
    check(bd.locator('.devs .dev').count() == 0, 'removed from the menu: gone')
    pa.goto(SERVER + '/privacy?fourth'); time.sleep(4)
    check(bd.locator('.devs .dev').count() == 0, "that browser goes on: not back (it's let go until it signs in again)")

    # signed in again there: back, under its own name
    ad.evaluate("fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'boss', password: 'correct horse' }) })")
    ad.reload(); ad.wait_for_selector('.ws-item', timeout=15000)
    check(wait(lambda: bd.locator('.devs .dev').count() == 1, 'back', timeout=15) and bd.inner_text('.devs .dev-name') != 'Work PC',
          f"signed in again there: back, under its own name ({bd.locator('.devs .dev-name').all_inner_texts()})")
    if os.environ.get('SHOT'):
        if bd.locator('.devs .dev.collapsed').count(): bd.click('.devs .dev-head')
        time.sleep(.6); bd.mouse.move(5, 5); bd.locator('#tabs-panel').screenshot(path=os.environ['SHOT'])

    check(not errors, f'no page errors {errors}')
    actx.close(); bctx.close()
srv.should_exit = True
done()
