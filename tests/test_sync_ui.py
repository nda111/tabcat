# Sync, as the dashboard shows it: the Account dialog open, the account renamed elsewhere: the dialog shows it;
# Settings open, changed in another browser (the theme, a checkbox): the dialog's choices follow; the workspace on
# screen moved elsewhere (nothing picked: it was the first): still on screen, not whatever's first now.
# (Was: Sync, on the user's own tabcat server: one account in two browsers. The first to sign in brings its own data
# (a copy of the browser's); the second takes the account's from the server, not its own; what either changes
# (the tree, Recently deleted, the look) reaches the other, both of two changes made at once kept; offline, the
# changes wait in the queue (nothing lost) and go once the server is back.
# (Needs fastapi and uvicorn: pip install fastapi uvicorn)
import os, sys, tempfile, threading
from harness import *
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server'))
import uvicorn
from tabcat_server import config as C
from tabcat_server.app import create_app

PORT = 8777
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
    edit(a, "s.workspaces.push({ id: 'w2', type: 'workspace', name: 'Second', symbol: '', description: '', categories: [] })")
    wait(lambda: ask(ac, 'syncStatus')['pending'] == 0 and ask(ac, 'syncStatus')['seq'] > 0, 'A sent')
    bctx, b, bc, bd = browser(p, errors, 'B', False)
    wait(lambda: names(b) == ['Own A', 'Second'], 'B took the server')
    bd.wait_for_function("document.querySelectorAll('.ws-item').length === 2", timeout=10000)
    bd.bring_to_front()
    bd.evaluate("localStorage.removeItem('tabcat:ui')")  # (nothing picked: the first on screen)
    bd.reload(); bd.wait_for_selector('.ws-item.active'); time.sleep(1)
    first = bd.evaluate("document.querySelector('.ws-item.active').dataset.id")
    check(first == 'own-A', f'B shows the first workspace ({first})')

    # the workspace on screen moved down in A: still on screen in B
    edit(a, "s.workspaces.reverse()")
    wait(lambda: names(b) == ['Second', 'Own A'], 'moved')
    time.sleep(.8)
    now = bd.evaluate("document.querySelector('.ws-item.active').dataset.id")
    check(now == 'own-A', f'moved down in another browser: the same workspace still on screen, not the new first ({now})')

    # the Account dialog open: renamed elsewhere
    bd.wait_for_selector('#btn-account:not([hidden])', timeout=10000)
    bd.click('#btn-account'); time.sleep(.5)
    ad.evaluate("fetch('/api/me/name', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Renamed' }) })")
    try: bd.wait_for_function("document.querySelector('#account-name').textContent.startsWith('Renamed')", timeout=5000); ok = True
    except Exception: ok = False
    check(ok, 'the Account dialog open, the account renamed in another browser: shown at once')
    bd.keyboard.press('Escape'); time.sleep(.4)

    # Settings open: changed in A, followed in B
    bd.click('#btn-settings'); time.sleep(.5)
    a.evaluate("chrome.storage.local.get('tabcat:settings').then(r => chrome.storage.local.set({ 'tabcat:settings': { ...r['tabcat:settings'], theme: 'dark', closeOnSave: false, columns: 3 } }))")
    try:
        bd.wait_for_function("(() => { const f = document.querySelector('#settings-form'); return f.theme.value === 'dark' && !f.closeOnSave.checked && f.columns.value === '3'; })()", timeout=8000); ok = True
    except Exception: ok = False
    check(ok, f"Settings open, changed in another browser (the theme, a checkbox, the columns): its choices follow ({bd.evaluate('(() => { const f = document.querySelector(\'#settings-form\'); return [f.theme.value, f.closeOnSave.checked, f.columns.value]; })()')})")
    st = b.evaluate("chrome.storage.local.get('tabcat:settings').then(r => [r['tabcat:settings'].closeOnSave, r['tabcat:settings'].columns])")
    check(st == [False, 3], f'and kept in B ({st})')

    check(not errors, f'no page errors {errors}')
    actx.close(); bctx.close()
srv.should_exit = True
done()
