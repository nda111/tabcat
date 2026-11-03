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

    bd.keyboard.press('Escape'); time.sleep(.4)

    # renamed in A (a workspace, a group): in B the old name fades out as the new fades in
    MOVED = """window.__moved = new Set(); (function f() { for (const a of document.getAnimations()) { const t = a.effect?.target; if (t?.className) __moved.add(String(t.className)); if (t?.dataset?.p) __moved.add('p:' + t.dataset.p + ':' + (a.effect.getKeyframes()[0].transform ? 'slide' : 'fade')); } requestAnimationFrame(f); })()"""
    time.sleep(1)  # (a change coming within a moment of this page's own is taken for its own: see ownChange)
    bd.evaluate(MOVED)
    edit(a, "s.workspaces.find(w => w.id === 'own-A').name = 'Own A renamed'")
    bd.wait_for_function("[...document.querySelectorAll('.ws-item .name')].some(e => e.textContent === 'Own A renamed')", timeout=8000)
    time.sleep(.3)
    check('name' in bd.evaluate('[...__moved]'), f"renamed in another browser: the name cross-fades ({bd.evaluate('[...__moved]')})")
    # (the board's title too: the old one fading exactly where it was, its symbol and gaps as they were, not aside)
    bd.evaluate('''window.__title = null; new MutationObserver(() => { const hs = document.querySelectorAll('#ws-head h1');
      if (hs.length === 2 && !window.__title) { const x = (h) => { const r = document.createRange(); r.selectNodeContents(h); return [h.getBoundingClientRect().left, h.lastChild.nodeType === 3 ? (r.setStart(h.lastChild, 0), r.getBoundingClientRect().left) : null]; };
        window.__title = [x(hs[0]), x(hs[1])]; } }).observe(document.querySelector('#ws-head'), { childList: true, subtree: true })''')
    edit(a, "s.workspaces.find(w => w.id === 'own-A').name = 'Own A again'")
    bd.wait_for_function("document.querySelector('#ws-head h1').textContent.includes('Own A again')", timeout=8000); time.sleep(.1)
    title = bd.evaluate('window.__title')
    check(title and abs(title[0][0] - title[1][0]) < 1 and (title[0][1] is None or abs(title[0][1] - title[1][1]) < 1), f"the board's title: the old fading right where it was, not shifted aside ({title})")

    # the editor open in B on a workspace, saved in A: what B hasn't edited follows; what it has, stays
    bd.dblclick('.ws-item[data-id="w2"]'); bd.wait_for_selector('#editor[open]'); time.sleep(.3)
    bd.fill('#editor textarea[name=description]', 'typed in B')
    edit(a, "const w = s.workspaces.find(w => w.id === 'w2'); w.name = 'Second (A)'; w.description = 'from A'")
    try: bd.wait_for_function("document.querySelector('#editor input[name=name]').value === 'Second (A)'", timeout=8000); ok = True
    except Exception: ok = False
    check(ok and bd.input_value('#editor textarea[name=description]') == 'typed in B',
          f"editor open in B, saved in A: the name (not edited in B) follows, the description typed in B stays ({bd.input_value('#editor input[name=name]')!r}, {bd.input_value('#editor textarea[name=description]')!r})")
    bd.click('#editor button[type=submit]'); time.sleep(1)
    w2 = [w for w in b.evaluate(TREE)['workspaces'] if w['id'] == 'w2'][0]
    check(w2['name'] == 'Second (A)' and w2['description'] == 'typed in B', f"saved in B: both ({w2['name']}, {w2['description']})")

    # another account signed in beside, in B: renamed elsewhere, the list of them shows it, the old fading as the new comes
    ad.evaluate("fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'ann', password: 'annpass123' }) })")
    boss = bd.evaluate("fetch('/api/me').then(r => r.json()).then(m => m.id)")
    bd.evaluate("fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'ann', password: 'annpass123' }) })")
    bd.evaluate(f"fetch('/api/accounts/switch', {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify({{ id: {boss} }}) }})")
    time.sleep(1); bd.reload(); bd.wait_for_selector('#btn-account:not([hidden])', timeout=15000); time.sleep(1.5)
    bd.click('#btn-account'); time.sleep(.4)
    SAMPLE = '''void (window.__hs = new Promise((done) => { const hs = [], t0 = performance.now(); (function f() { const l = document.querySelector('#account-list');
      const n = l.nextElementSibling; hs.push(+(n.getBoundingClientRect().top).toFixed(2)); if (performance.now() - t0 < 1600) requestAnimationFrame(f); else done(hs); })(); }))'''
    def last_step(hs):
        steps = [abs(b - a) for a, b in zip(hs, hs[1:]) if abs(b - a) > .01]
        return steps[-1] if steps else 0
    if bd.get_attribute('#account-more', 'aria-expanded') == 'true': bd.click('#account-more'); time.sleep(.6)
    bd.evaluate(SAMPLE); bd.click('#account-more'); hs = bd.evaluate('window.__hs')
    check(hs[-1] > hs[0] and last_step(hs) < 1.5, f'the list of accounts opening: no jump at the end (its last step {last_step(hs):.2f}px)')
    bd.evaluate(SAMPLE); bd.click('#account-more'); hs = bd.evaluate('window.__hs')
    check(hs[-1] < hs[0] and last_step(hs) < 1.5, f'and closing: none either ({last_step(hs):.2f}px)')
    bd.click('#account-more'); bd.wait_for_selector('#account-list .account-other'); time.sleep(.6)
    tinted = bd.evaluate("document.querySelector('#account-list .account-avatar').dataset.tint")
    check(tinted == 'hue', f"another account's letter: in its own colour ({tinted})")
    bd.evaluate(MOVED)
    other = p.chromium.launch(); oc = other.new_context().new_page(); oc.goto(SERVER + '/login')
    oc.evaluate("fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'ann', password: 'annpass123' }) })")
    oc.evaluate("fetch('/api/me/name', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Annie' }) })")
    try: bd.wait_for_function("document.querySelector('#account-list .account-name').textContent.startsWith('Annie')", timeout=6000); ok = True
    except Exception: ok = False
    check(ok, 'another account signed in in B, renamed elsewhere: the list shows it at once')
    time.sleep(.2)
    check('p:name:fade' in bd.evaluate('[...__moved]'), f"the name alone cross-fading, the old over the new on the same line ({bd.evaluate('[...__moved]')})")
    time.sleep(.5); bd.evaluate(MOVED)
    ann = oc.evaluate("fetch('/api/me').then(r => r.json()).then(m => m.id)")
    ad.evaluate(f"fetch('/api/admin/users/{ann}', {{ method: 'PATCH', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify({{ admin: true }}) }})")
    was = bd.evaluate("document.querySelector('#account-list .account-role').textContent")
    check(was == 'ann', f"a member in the list: no type said, the username alone ({was!r})")
    try: bd.wait_for_function("w => document.querySelector('#account-list .account-role').textContent !== w", arg=was, timeout=6000); ok = True
    except Exception: ok = False
    role = bd.evaluate("document.querySelector('#account-list .account-role').textContent")
    time.sleep(.5)
    if os.environ.get('SHOT'): bd.locator('#account').screenshot(path=os.environ['SHOT'])
    check(ok and 'p:role:fade' in bd.evaluate('[...__moved]') and not {'nm', 'p:id:fade', 'p:id:slide', 'p:name:fade'} & set(bd.evaluate('[...__moved]')), f'made an admin elsewhere: its type comes, fading in, the username still ({role})')
    other.close()

    check(not errors, f'no page errors {errors}')
    actx.close(); bctx.close()
srv.should_exit = True
done()
