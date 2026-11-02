# Sync, on the user's own tabcat server: one account in two browsers. The first to sign in brings its own data
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

PORT = 8769
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
    st = wait(lambda: (s := ask(ac, 'syncStatus')) and s['seq'] is not None and s, 'A synced')
    check(st and st['space'] and st['pending'] == 0, f'A, the first: synced ({st})')
    check(names(a) == ['Own A'], f"A's account starts from a copy of A's own data ({names(a)})")
    server_has = ad.evaluate("fetch('/api/sync/state').then(r => r.json()).then(s => s.snapshot.body.workspaces.map(w => w.name))")
    check(server_has == ['Own A'], f'and the server has it, as the account\'s first copy ({server_has})')

    bctx, b, bc, bd = browser(p, errors, 'B', False)
    wait(lambda: names(b) == ['Own A'], 'B took the server')
    check(names(b) == ['Own A'], f"B, signing in to the same account: the account's data from the server, not B's own ({names(b)})")

    # a change in A reaches B
    edit(a, "s.workspaces.push({ id: 'wa', type: 'workspace', name: 'From A', symbol: '', description: '', categories: [] })")
    wait(lambda: ask(ac, 'syncStatus')['pending'] == 0 and ask(ac, 'syncStatus')['seq'] > 0, 'A sent')
    ask(bc, 'syncNow')
    wait(lambda: 'From A' in names(b), 'B got it')
    check(names(b) == ['Own A', 'From A'], f'a workspace added in A: in B too ({names(b)})')
    bd.wait_for_function("[...document.querySelectorAll('.ws-item')].some(e => e.title.includes('From A'))", timeout=10000)
    check(True, "and B's open dashboard shows it")

    # two changes at once, to different things: both kept, both browsers the same
    edit(a, "s.workspaces[0].name = 'Renamed in A'")
    edit(b, "s.workspaces[0].categories[0].groups[0].items.push({ id: 'lb', type: 'link', url: 'https://example.com/', name: 'Link from B', icon: '', description: '', createdAt: 1 })")
    ask(ac, 'syncNow'); ask(bc, 'syncNow')
    for _ in range(3):
        time.sleep(1); ask(ac, 'syncNow'); ask(bc, 'syncNow')
    same = lambda: a.evaluate(TREE) == b.evaluate(TREE)
    wait(same, 'the same')
    ta = a.evaluate(TREE)
    check(same() and ta['workspaces'][0]['name'] == 'Renamed in A' and ta['workspaces'][0]['categories'][0]['groups'][0]['items'][0]['name'] == 'Link from B',
          'changed at once in each: both changes kept, and both browsers the same')

    # moved and deleted
    edit(b, "const g = s.workspaces[0].categories[0].groups[0]; s.workspaces[1].categories.push({ id: 'cb', type: 'category', name: 'Moved here', groups: [g] }); s.workspaces[0].categories[0].groups = []")
    ask(bc, 'syncNow'); time.sleep(1.5); ask(ac, 'syncNow')
    wait(lambda: a.evaluate(TREE) == b.evaluate(TREE), 'the same')
    check(a.evaluate(TREE)['workspaces'][1]['categories'][0]['groups'][0]['id'] == 'g-A', 'a group moved to another workspace in B: moved in A, with its link')

    # Recently deleted, and the look
    a.evaluate("chrome.storage.local.set({ 'tabcat:trash': [{ id: 't1', node: { id: 'x', type: 'link', url: 'https://gone.example/', name: 'Gone' }, parentId: null, index: 0, trail: [], deletedAt: Date.now() }] })")
    a.evaluate("chrome.storage.local.get('tabcat:settings').then(r => chrome.storage.local.set({ 'tabcat:settings': { ...r['tabcat:settings'], accent: 'green', theme: 'dark' } }))")
    time.sleep(1.5); ask(ac, 'syncNow'); time.sleep(1.5); ask(bc, 'syncNow')
    wait(lambda: b.evaluate("chrome.storage.local.get('tabcat:trash').then(r => (r['tabcat:trash'] || []).map(e => e.id))") == ['t1'], 'trash')
    check(b.evaluate("chrome.storage.local.get('tabcat:trash').then(r => (r['tabcat:trash'] || []).map(e => e.id))") == ['t1'], 'Recently deleted: the same in B')
    look = wait(lambda: (l := b.evaluate("chrome.storage.local.get('tabcat:settings').then(r => [r['tabcat:settings'].theme, r['tabcat:settings'].accent])")) == ['dark', 'green'] and l, 'look')
    check(look == ['dark', 'green'], f'the look too ({look})')
    accent = bd.evaluate("fetch('/api/me').then(r => r.json()).then(m => m.accent)")
    check(accent == 'green', f"and the server knows the account's colour, for its letter where it has no photo ({accent})")

    # offline: the server down, B's changes wait in the queue, then go
    srv.should_exit = True; time.sleep(1.5)
    for i in range(3):
        edit(b, f"s.workspaces.push({{ id: 'off{i}', type: 'workspace', name: 'Offline {i}', symbol: '', description: '', categories: [] }})")
        time.sleep(.8)
    ask(bc, 'syncNow'); time.sleep(1.5)
    st = ask(bc, 'syncStatus')
    check(st['unsent'] >= 1 and st['lastError'], f'offline: the changes kept, waiting ({st["unsent"]} waiting, {st["lastError"]})')
    # (kept in storage: the worker going to sleep loses nothing)
    check(b.evaluate("chrome.storage.local.get('tabcat:sync').then(r => r['tabcat:sync'].pending.length)") >= 1, 'in storage, not only in memory')
    srv = serve()
    ask(bc, 'syncNow')
    wait(lambda: ask(bc, 'syncStatus')['pending'] == 0, 'sent', 30)
    ask(ac, 'syncNow')
    wait(lambda: all(f'Offline {i}' in names(a) for i in range(3)), 'A got them')
    check([n for n in names(a) if n.startswith('Offline')] == ['Offline 0', 'Offline 1', 'Offline 2'], f'back online: all of them sent, in order, and in A ({names(a)})')
    check(a.evaluate(TREE) == b.evaluate(TREE), 'both the same again')

    # live: B's dashboard open, nothing asked of it: the server tells it at once
    time.sleep(2)
    t0 = time.time()
    edit(a, "s.workspaces.push({ id: 'live', type: 'workspace', name: 'Live', symbol: '', description: '', categories: [] })")
    wait(lambda: 'Live' in names(b), 'live', 10)
    took = time.time() - t0
    check('Live' in names(b) and took < 4, f'live: a change in A shows in B by itself, at once ({took:.1f} s)')
    bd.wait_for_function("[...document.querySelectorAll('.ws-item')].some(e => e.title.includes('Live'))", timeout=5000)
    check(True, "on B's dashboard too")
    # as changes made there: what's added springs in, what's deleted leaves (not just there / gone)
    watch = '''(name) => { window.__seen = { anim: false, leaving: false }; const t0 = performance.now();
      (function f() { const el = [...document.querySelectorAll('.ws-item')].find((e) => e.title === name);
        if (el) { if (el.getAnimations().length) __seen.anim = true; if (el.dataset.leaving) __seen.leaving = true; }
        if (performance.now() - t0 < 8000) requestAnimationFrame(f); })(); }'''
    bd.bring_to_front(); bd.evaluate(watch, 'Live 2')
    edit(a, "s.workspaces.push({ id: 'live2', type: 'workspace', name: 'Live 2', symbol: '', description: '', categories: [] })")
    wait(lambda: bd.evaluate('__seen.anim'), 'sprang in', 8)
    check(bd.evaluate('__seen.anim'), 'a workspace added in A springs into B\'s list')
    bd.evaluate(watch, 'Live 2')
    edit(a, "s.workspaces = s.workspaces.filter(w => w.id !== 'live2')")
    wait(lambda: bd.evaluate('__seen.leaving'), 'left', 8)
    check(bd.evaluate('__seen.leaving'), 'deleted in A: it leaves B\'s list as a delete there would')
    wait(lambda: 'Live 2' not in names(b), 'gone', 8)

    check(not errors, f'no page errors {errors}')
    actx.close(); bctx.close()
srv.should_exit = True
done()
