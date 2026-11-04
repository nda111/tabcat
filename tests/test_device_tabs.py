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
    meta = bd.inner_text('.devs .dev-meta')
    check(name.strip() != '' and 'tab' in meta and 'just now' in meta, f"named for its browser, with how many tabs and when ('just now', not 'this minute') ({name!r}, {meta!r})")
    check(bd.locator('.devs .dev').count() == 1 and not bd.locator(f".devs .dev[data-device='{b.evaluate('chrome.storage.local.get(\'tabcat:device\').then(r => r[\'tabcat:device\'])') or 'x'}']").count(), "not B itself")
    # B's own name above its windows, written as the heading of the others; renamed there, for A to see too
    own = lambda: bd.text_content('#windows > .self-title .self-name').strip() if bd.locator('#windows > .self-title:visible').count() else None
    check(wait(lambda: own(), 'its own name', timeout=10) and bd.evaluate("(s => getComputedStyle(s).textTransform === getComputedStyle(document.querySelector('.devs .devs-title')).textTransform && s.nextElementSibling.matches('.win'))(document.querySelector('#windows > .self-title'))"),
          f'B: its own name above its windows, as the heading below is written ({own()!r})')
    bd.hover('#windows > .self-title'); bd.click('#windows > .self-title .self-edit')
    bd.keyboard.press('Control+A'); bd.keyboard.type('Desk B'); bd.keyboard.press('Enter')
    check(wait(lambda: own() == 'Desk B', 'renamed', timeout=10), f'renamed in place ({own()!r})')
    check(wait(lambda: 'Desk B' in [d['name'] for d in ad.evaluate("fetch('/api/sync/tabs').then(r => r.json()).then(j => j.devices)")], 'kept', timeout=10), 'kept by the server: the name the others show')
    bd.click('.devs .dev-head'); time.sleep(.08)
    check(bd.locator('.devs .dev:not(.collapsed)').count() == 1, 'a click opens it at once')
    urls = lambda: bd.evaluate("[...document.querySelectorAll('.devs .rtab')].map(r => r.dataset.url)")
    check(wait(lambda: SERVER + '/privacy?from-a' in urls(), 'opened', timeout=20) and not any(u.startswith('chrome-extension:') for u in urls()), f"opened: its tabs (not tabcat's own pages) ({urls()})")

    # live: A opens another
    pa2 = actx.new_page(); pa2.goto(SERVER + '/privacy?second')
    check(wait(lambda: SERVER + '/privacy?second' in urls(), 'live', timeout=10), f'A opens another: B shows it at once, no reload ({urls()})')

    # dragged into a window of B: opened there, still open in A
    before = len(bc.evaluate("chrome.tabs.query({}).then(ts => ts.map(t => t.url))"))
    src = bd.locator(f".devs .rtab[data-url='{SERVER}/privacy?second']")
    src.drag_to(bd.locator('#windows .win .win-head').first)
    until(lambda: (t := bc.evaluate("chrome.tabs.query({}).then(ts => ts.map(t => t.url))")) and len(t) == before + 1 and SERVER + '/privacy?second' in t)
    tabs_b = bc.evaluate("chrome.tabs.query({}).then(ts => ts.map(t => t.url))")
    tabs_a = ac.evaluate("chrome.tabs.query({}).then(ts => ts.map(t => t.url))")
    check(len(tabs_b) == before + 1 and SERVER + '/privacy?second' in tabs_b and SERVER + '/privacy?second' in tabs_a, f'dragged into a window here: opened here, still open there ({len(tabs_b) - before} more here)')

    # dragged onto the board: a link
    src = bd.locator(f".devs .rtab[data-url='{SERVER}/privacy?from-a']")
    src.drag_to(bd.locator('#board .group').first)
    links = lambda: b.evaluate(f"{TREE}.then(s => JSON.stringify(s)).then(j => (j.match(/privacy\\?from-a/g) || []).length)")
    until(lambda: links() == 1); links = links()
    check(links == 1, f'dragged onto the board: saved as a link ({links})')

    tip = bd.evaluate("document.querySelector('.devs .rtab').title || document.querySelector('.devs .rtab').dataset.tip")
    check('click' not in tip.lower() and 'drag' not in tip.lower(), f'its tabs: their title and address, no how-to ({tip!r})')

    # named from its menu; undone with Ctrl+Z, done again with Ctrl+Shift+Z
    menu = lambda: (bd.click('.devs .dev-head', button='right'), bd.wait_for_selector('#menu:not([hidden])'), bd.evaluate("[...document.querySelectorAll('#menu button')].map(b => b.textContent.trim())"))[2]
    items = menu()
    check(any(i.startswith('Rename') for i in items) and any(i.startswith('Hide') for i in items) and not any('(' in i for i in items), f'its menu: Rename, Hide ({items})')
    own = bd.inner_text('.devs .dev-name')
    bd.locator('#menu button', has_text='Rename').click(); bd.wait_for_selector('.devs .dev-rename')
    bd.fill('.devs .dev-rename', 'Work PC'); bd.press('.devs .dev-rename', 'Enter')
    names = lambda pg: pg.evaluate("fetch('/api/sync/tabs').then(r => r.json()).then(r => r.devices.map(d => d.name))")
    check(until(lambda: bd.inner_text('.devs .dev-name') == 'Work PC' and 'Work PC' in names(ad)), f'renamed: shown, kept for the account ({bd.locator(".devs .dev-name").all_inner_texts()}, {names(ad)})')
    bd.mouse.click(600, 400); bd.keyboard.press('Control+z')
    check(until(lambda: bd.inner_text('.devs .dev-name') == own and 'Work PC' not in names(ad)), f'Ctrl+Z: its name as it was ({bd.inner_text(".devs .dev-name")!r})')
    bd.keyboard.press('Control+Shift+z')
    check(until(lambda: bd.inner_text('.devs .dev-name') == 'Work PC' and 'Work PC' in names(ad)), 'Ctrl+Shift+Z: renamed again')

    # hidden from its menu; shown again from the list by the heading
    menu(); bd.locator('#menu button', has_text='Hide').click()
    check(until(lambda: bd.locator('.devs .dev').count() == 0 and bd.locator('.devs .devs-title').count() == 1), 'hidden: gone from the panel, the heading stays (for the list)')
    tip = bd.evaluate("(b => b.title || b.dataset.tip)(document.querySelector('.devs-list-btn'))")
    gap = bd.evaluate("(() => { const a = document.querySelector('.devs-list-btn').getBoundingClientRect(), w = document.querySelector('#windows .win-head .icon-btn:last-child').getBoundingClientRect(); return Math.round(a.right - w.right); })()")
    check(tip == 'List' and abs(gap) <= 1, f"the list button: 'List', in line with the windows' buttons above ({tip!r}, {gap}px off)")
    bd.click('.devs-list-btn'); bd.wait_for_selector('#devices[open]'); settle(bd)
    boxes = bd.evaluate("[...document.querySelectorAll('#devices-list input')].map(i => i.checked)")
    check(boxes == [False], f'the list, a dialog: it, unticked ({boxes})')
    look = bd.evaluate("(r => { const c = getComputedStyle(r); return [c.borderTopWidth, !!r.querySelector('.dev-grip'), r.lastElementChild.type]; })(document.querySelector('#devices-list .dev-row'))")
    check(look == ['1px', True, 'checkbox'], f'each row framed, a handle on its left, its tick on its right ({look})')
    row = bd.locator('#devices-list .dev-row').first
    row.click(); row.click(); settle(bd)
    check(bd.evaluate("document.querySelector('#devices-list input').checked") is False and until(lambda: bd.locator('.devs .dev').count() == 0), 'two quick clicks on the row: ticked and unticked again (each a click)')
    row.click()
    check(until(lambda: bd.locator('.devs .dev').count() == 1), f"a click on the row: ticked, shown again ({bd.locator('.devs .dev').count()})")
    row.click(); until(lambda: bd.locator('.devs .dev').count() == 0); bd.keyboard.press('Escape')
    check(until(lambda: bd.locator('.devs .dev').count() == 0 and not bd.locator('#devices[open]').count()), 'clicked again: hidden; Escape shuts the list')

    # signed in again there: shown again by itself
    ad.evaluate("fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'boss', password: 'correct horse' }) })")
    ad.reload(); ad.wait_for_selector('.ws-item', timeout=15000)
    check(wait(lambda: bd.locator('.devs .dev').count() == 1, 'back', timeout=15), 'hidden, then signed in again there: shown again by itself')
    if os.environ.get('SHOT'):
        if bd.locator('.devs .dev.collapsed').count(): bd.click('.devs .dev-head')
        time.sleep(.6); bd.mouse.move(5, 5); bd.locator('#tabs-panel').screenshot(path=os.environ['SHOT'])

    # put in order: B gets a third browser's tabs (straight to the server), then drags one head above the other
    import json as _j
    cc = p.chromium.launch().new_context(); cp = cc.new_page(); cp.goto(SERVER + '/login')
    cp.evaluate("fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'boss', password: 'correct horse' }) })")
    cp.evaluate("fetch('/api/sync/tabs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: 'third', name: 'Third', windows: [{ tabs: [{ url: 'https://example.com/' }] }] }) })")
    wait(lambda: bd.locator('.devs .dev').count() == 2, 'third', timeout=10)
    order = lambda: bd.evaluate("[...document.querySelectorAll('.devs .dev[data-device]')].map(e => e.querySelector('.dev-name').textContent)")
    was = order()
    cp.evaluate("fetch('/api/sync/tabs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: 'third', name: 'Third', windows: [{ tabs: [{ url: 'https://example.org/' }] }] }) })")
    time.sleep(1.5)
    check(order() == was, f'one speaking again: the list stays in its order ({order()})')
    bd.locator('.devs .dev-head').nth(1).drag_to(bd.locator('.devs .dev-head').nth(0), target_position={'x': 20, 'y': 3})
    until(lambda: order() == was[::-1] and [n for n in ad.evaluate("fetch('/api/sync/tabs').then(r => r.json()).then(r => r.devices.map(d => d.name))") if n in was] == was[::-1])
    now = order(); srv_order = ad.evaluate("fetch('/api/sync/tabs').then(r => r.json()).then(r => r.devices.map(d => d.name))")
    check(now == was[::-1] and [n for n in srv_order if n in now] == now, f'a head dragged above another: put there, here and for the account ({was} -> {now})')

    # in the list too: a row pressed and moved goes elsewhere (here, the top one below the other)
    was = order()
    bd.click('.devs-list-btn'); bd.wait_for_selector('#devices[open]'); settle(bd)
    r0 = bd.locator('#devices-list .dev-row').nth(0).bounding_box(); r1 = bd.locator('#devices-list .dev-row').nth(1).bounding_box()
    bd.mouse.move(r0['x'] + 60, r0['y'] + r0['height'] / 2); bd.mouse.down()
    for i in range(1, 9): bd.mouse.move(r0['x'] + 60, r0['y'] + r0['height'] / 2 + i * (r1['y'] + r1['height'] - r0['y']) / 8)
    bd.mouse.up()
    check(until(lambda: order() == was[::-1]), f'the list: a row dragged below another, put there ({was} -> {order()})')
    check(bd.evaluate("[...document.querySelectorAll('#devices-list input')].every(i => i.checked)"), 'and not ticked or unticked by it')
    bd.keyboard.press('Escape'); settle(bd)
    # in the panel: dropped anywhere below the last one, it goes last
    was = order()
    wb = bd.locator('#windows').bounding_box(); hb = bd.locator('.devs .dev-head').nth(0).bounding_box()
    bd.mouse.move(hb['x'] + 40, hb['y'] + hb['height'] / 2); bd.mouse.down()
    for i in range(1, 11): bd.mouse.move(wb['x'] + 60, hb['y'] + (wb['y'] + wb['height'] - 60 - hb['y']) * i / 10)
    bd.mouse.up()
    check(until(lambda: order() == was[::-1]), f'the panel: dropped well below the last, it goes last ({was} -> {order()})')

    # signed out from its menu, asked first: that browser shows the sign-in at once
    a_head = bd.locator('.devs .dev-head', has_text='Work PC').first
    if not a_head.count(): a_head = bd.locator('.devs .dev-head').filter(has_not_text='Third').first
    a_head.click(button='right'); bd.wait_for_selector('#menu:not([hidden])')
    so = bd.locator('#menu button', has_text='Sign out')
    check(so.count() == 1 and 'danger' in (so.get_attribute('class') or ''), 'its menu: Sign out, in red')
    so.click(); bd.wait_for_selector('#confirm[open]')
    text = bd.inner_text('#confirm-text')
    check(text.startswith('Signs out on '), f'asked first: "Signs out on (its name)." ({text!r})')
    bd.click('#confirm-ok')
    check(wait(lambda: ad.locator('#username').count() and ad.is_visible('#username'), 'A signed out', timeout=8), 'signed out there: the sign-in shows at once, no reload')
    cc.close()

    # off to the account page, slow to come: the spinner after a moment
    bd.click('#btn-account'); settle(bd)
    # (a link that goes nowhere: the leaving as for any, the page there never coming)
    bd.evaluate("(a => { a.href = 'javascript:void 0'; a.click(); })(document.querySelector('#account a[href=\"/account\"]'))")
    check(until(lambda: bd.evaluate("document.documentElement.classList.contains('booting')")), 'off to the account page, slow: the spinner shows')

    check(not errors, f'no page errors {errors}')
    actx.close(); bctx.close()
srv.should_exit = True
done()
