# The server's pages, live, sharing one stream: however many are open in a browser, one connection to /api/live
# (a browser opens only six to a server: a stream each would hold up everything else); the one holding it closed,
# another takes over. Also by a note in storage where there are no locks (a plain http:// address).
# And what comes live comes moving: the admin page's rows, the sign-up choice; the account page's admin button.
# The security record: 15 a page, a page's number typed. The only admin making themselves a member: refused at once.
# (Needs fastapi and uvicorn: pip install fastapi uvicorn)
import os, sqlite3, sys, tempfile, threading
from harness import *
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server'))
import uvicorn
from tabcat_server import config as C
from tabcat_server.app import create_app
import tabcat_server.app as APP
APP.API_PER_MINUTE = 100_000  # (every page here from one address, many at once: not held back as too many)

PORT = 8775
SERVER = f'http://127.0.0.1:{PORT}'
DATA = tempfile.mkdtemp()
srv = uvicorn.Server(uvicorn.Config(create_app(C.load(DATA)), host='127.0.0.1', port=PORT, log_level='warning'))
threading.Thread(target=srv.run, daemon=True).start()
while not srv.started: time.sleep(.05)

# (each page counts the streams it opens, and what's been moving)
COUNT = '''(() => { const E = window.EventSource; window.__es = 0;
  window.EventSource = class extends E { constructor(...a) { super(...a); window.__es++; this.addEventListener('error', () => {}); } };
  window.__moved = new Set();
  const look = () => { for (const a of document.getAnimations()) { const t = a.effect?.target; if (t) { window.__moved.add(t.id || t.className || t.tagName); if (t.closest?.('thead')) window.__moved.add('head:' + t.textContent); if (t.dataset?.f) window.__moved.add('f:' + t.dataset.f + ':' + (/translateX/.test(a.effect.getKeyframes()[0].transform) ? 'slide' : a.effect.getKeyframes()[0].transform ? 'rise' : 'fade')); } } requestAnimationFrame(look); };
  requestAnimationFrame(look); })()'''
NOLOCKS = "Object.defineProperty(Navigator.prototype, 'locks', { get: () => undefined });"

def call(pg, method, path, body=None):
    return pg.evaluate("([m, p, b]) => fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(r => r.status)", [method, path, body])
def soon(pg, js, timeout=5000, arg=None):
    try: pg.wait_for_function(js, arg=arg, timeout=timeout); return True
    except Exception: return False
def streams(pages): return sum(pg.evaluate('window.__es') for pg in pages)

errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    one, two = b.new_context(), b.new_context()
    one.add_init_script(COUNT)
    a = one.new_page(); a.on('pageerror', lambda e: errors.append(str(e)))
    a.goto(SERVER + '/setup'); call(a, 'POST', '/api/setup', {'username': 'boss', 'password': 'correct horse'})
    o = two.new_page(); o.goto(SERVER + '/login'); call(o, 'POST', '/api/login', {'username': 'boss', 'password': 'correct horse'})

    # one stream for many pages
    pages = []
    for path in ['/account', '/admin', '/account', '/admin']:
        pg = one.new_page(); pg.on('pageerror', lambda e: errors.append(str(e))); pg.goto(SERVER + path); pages.append(pg)
    time.sleep(1.5)
    check(streams(pages + [a]) == 1, f'five pages of the server open: one stream among them ({streams(pages + [a])})')
    call(o, 'PUT', '/api/me/name', {'name': 'Big Boss'})
    check(all(soon(pg, "document.querySelector('#name-view')?.textContent === 'Big Boss' || document.querySelector('#users')?.textContent.includes('Big Boss')") for pg in pages),
          'and each hears what changed (the name, on the account pages and the admin pages)')
    holder = next(pg for pg in pages if pg.evaluate('window.__es'))
    pages.remove(holder); holder.close(); time.sleep(1)
    check(streams(pages) == 1, 'the page holding it closed: another takes over')
    call(o, 'PUT', '/api/me/name', {'name': 'Boss'})
    check(all(soon(pg, "document.querySelector('#name-view')?.textContent === 'Boss' || document.querySelector('#users b')?.textContent === 'Boss'") for pg in pages), 'and they all still hear')

    # (no locks: a note in storage)
    three = b.new_context(); three.add_init_script(COUNT); three.add_init_script(NOLOCKS)
    n = three.new_page(); n.goto(SERVER + '/login'); call(n, 'POST', '/api/login', {'username': 'boss', 'password': 'correct horse'})
    plain = [three.new_page() for _ in range(3)]
    for pg in plain: pg.goto(SERVER + '/account')
    time.sleep(1.5)
    check(streams(plain + [n]) == 1, f'without locks too: one stream ({streams(plain + [n])})')
    holder = next(pg for pg in plain if pg.evaluate('window.__es'))
    plain.remove(holder); holder.close(); time.sleep(1.5)
    check(streams(plain) == 1, 'its page closed: another takes over at once')
    call(o, 'PUT', '/api/me/name', {'name': 'Plain'})
    check(all(soon(pg, "document.querySelector('#name-view').textContent === 'Plain'") for pg in plain), 'and they hear')
    three.close()
    for pg in pages: pg.close()

    # the admin page: what comes, comes moving
    adm = one.new_page(); adm.on('pageerror', lambda e: errors.append(str(e))); adm.goto(SERVER + '/admin'); adm.wait_for_selector('#users tr'); time.sleep(1.2)
    adm.evaluate('window.__moved.clear()')
    call(o, 'PUT', '/api/me/name', {'name': 'Renamed'})
    check(soon(adm, "document.querySelector('#users b').textContent === 'Renamed'"), 'renamed elsewhere: the admin page shows it')
    time.sleep(.3)
    m = adm.evaluate('[...window.__moved]')
    check('f:name:fade' in m, f"the name: the old fading out as the new fades in ({m})")
    check('head:Last seen' in m, f'the column heads after the name slide with their columns ({m})')
    check('f:uname:slide' in m and not {'f:uname:fade', 'f:uname:rise', 'f:seen:rise'} & set(m) and 'f:seen:slide' in m, f"the username beside it, and last seen after it, slide to their new places, not blinking ({m})")
    adm.evaluate('window.__moved.clear()')
    call(o, 'PUT', '/api/admin/settings', {'signup': 'open'})
    check(soon(adm, "document.querySelector('input[name=signup][value=open]').checked"), 'sign-up changed by another admin: shown')
    time.sleep(.3)
    check('INPUT' in adm.evaluate('[...window.__moved]'), f"the new choice springing in ({adm.evaluate('[...window.__moved]')})")

    # the only admin, making themselves a member: said at once, nothing asked
    adm.locator('#users tr').first.locator('.seg button').nth(1).click(); until(lambda: adm.locator('#users-msg').inner_text().strip())
    check(not adm.locator('dialog.modal[open]').count() and adm.locator('#users-msg').inner_text().strip(), f"the only admin to a member: refused at once ({adm.locator('#users-msg').inner_text()!r})")

    # the only admin: no Delete button on their account page, a red word why
    oa = one.new_page(); oa.goto(SERVER + '/account'); oa.wait_for_selector('#name-view'); until(lambda: oa.is_visible('#only-admin') and not oa.is_visible('#delete-me') and 'only admin' in oa.inner_text('#only-admin'))
    check(oa.is_visible('#only-admin') and not oa.is_visible('#delete-me') and 'only admin' in oa.inner_text('#only-admin'), f"the only admin: no Delete button, a word why ({oa.inner_text('#only-admin')!r})")
    oa_open = True
    # the account page's admin button, made an admin elsewhere: it comes, moving
    call(o, 'POST', '/api/admin/users', {'username': 'ann', 'password': 'annpass123'})
    four = b.new_context(); four.add_init_script(COUNT)
    ann = four.new_page(); ann.goto(SERVER + '/login'); call(ann, 'POST', '/api/login', {'username': 'ann', 'password': 'annpass123'})
    ann.goto(SERVER + '/account'); time.sleep(1.2)
    check(ann.locator('#admin-link').is_hidden(), 'a member: no admin button')
    ann.evaluate('window.__moved.clear()')
    ann_id = o.evaluate("fetch('/api/admin/users').then(r => r.json()).then(l => l.find(u => u.username === 'ann').id)")
    call(o, 'PATCH', f'/api/admin/users/{ann_id}', {'admin': True})
    check(soon(ann, "!document.querySelector('#admin-link').hidden"), 'made an admin elsewhere: the button comes')
    check(soon(oa, "!document.querySelector('#delete-me').closest('#delete-row').hidden && document.querySelector('#only-admin').hidden"), 'another made an admin: the Delete button comes back, live')
    time.sleep(.1)
    check('admin-link' in ann.evaluate('[...window.__moved]'), 'growing in')
    ann.evaluate('window.__moved.clear()')
    call(o, 'PATCH', f'/api/admin/users/{ann_id}', {'admin': False})
    check(soon(ann, "document.querySelector('#admin-link').hidden"), 'and goes')
    check('admin-link' in ann.evaluate('[...window.__moved]'), 'shrinking away')
    four.close()

    # the account page's own record: five a page
    # (a few sign-ins more, put straight in: more through the API would be held back as too many)
    with sqlite3.connect(os.path.join(DATA, 'tabcat.db')) as c:
        for i in range(6): c.execute("insert into events (at, user_id, username, kind, ip) select ?, id, username, 'login_ok', ? from users where username = 'boss'", (time.time() - 3600 * (i + 1), f'10.0.0.{i}'))
    acc = one.new_page(); acc.on('pageerror', lambda e: errors.append(str(e))); acc.goto(SERVER + '/account'); acc.wait_for_selector('#my-events .event')
    mine = acc.evaluate("fetch('/api/me/events?limit=1').then(r => r.json()).then(r => r.total)")
    mp = -(-mine // 5)
    until(lambda: acc.locator('#my-events .event').count() == 5 and acc.locator('#my-ev-pager').is_visible() and acc.locator('#my-ev-pages').inner_text() == str(mp)); settle(acc)
    check(acc.locator('#my-events .event').count() == 5 and acc.locator('#my-ev-pager').is_visible() and acc.locator('#my-ev-pages').inner_text() == str(mp), f'the account page: its record five a page, {mp} pages ({mine} in all)')
    top = acc.locator('#my-events .event').first.get_attribute('data-key')
    TURN = '''(sel) => new Promise((done) => { const seen = []; const look = () => { for (const a of document.getAnimations()) { const t = a.effect?.target, k = a.effect.getKeyframes();
      if (t?.closest?.(sel) && /translateY/.test(k[0].transform + k[1].transform)) seen.push((t.closest('.event')?.parentElement?.closest('.event') ? 'old ' : 'new ') + (k[0].transform === 'none' ? 'out ' + k[1].transform : 'in ' + k[0].transform)); }
      if (seen.length) done([...new Set(seen.map((x) => x.replace(/[0-9.]+px/, 'N')))]); else requestAnimationFrame(look); }; look(); })'''
    acc.evaluate("void (window.__turn = (" + TURN + ")('#my-events'))")
    acc.click('#my-ev-next')
    turn = acc.evaluate('window.__turn'); settle(acc)
    check('old out translateY(-N)' in turn and 'new in translateY(N)' in turn, f'next: in each row, the old goes up and out as the new comes up from below ({turn})')
    acc.evaluate("void (window.__turn = (" + TURN + ")('#my-events'))")
    acc.click('#my-ev-prev')
    turn = acc.evaluate('window.__turn'); settle(acc)
    check('old out translateY(N)' in turn and 'new in translateY(-N)' in turn, f'back: the other way ({turn})')
    acc.click('#my-ev-next'); until(lambda: acc.locator('#my-ev-page').input_value() == '2' and acc.locator('#my-events .event').first.get_attribute('data-key') != top); settle(acc)
    check(acc.locator('#my-ev-page').input_value() == '2' and acc.locator('#my-events .event').first.get_attribute('data-key') != top, 'next: page 2')
    acc.fill('#my-ev-page', '99'); acc.press('#my-ev-page', 'Enter'); until(lambda: acc.locator('#my-ev-page').input_value() == str(mp) and acc.locator('#my-events .event').count() == mine - 5 * (mp - 1))
    check(acc.locator('#my-ev-page').input_value() == str(mp) and acc.locator('#my-events .event').count() == mine - 5 * (mp - 1), 'a page typed, past the last: the last')
    if os.environ.get('SHOT2'): acc.locator('#my-events').locator('..').screenshot(path=os.environ['SHOT2'])
    acc.close()

    # the record: 15 a page
    bad = b.new_context().new_page(); bad.goto(SERVER + '/login')
    for i in range(20): call(bad, 'POST', '/api/login', {'username': f'ghost{i}', 'password': 'wrongwrong'})
    adm.reload(); adm.wait_for_selector('#events .event')
    total = adm.evaluate("fetch('/api/admin/events?limit=1').then(r => r.json()).then(r => r.total)")
    pages_n = -(-total // 15)
    until(lambda: adm.locator('#events .event').count() == 15 and adm.locator('#ev-pager').is_visible() and adm.locator('#ev-pages').inner_text() == str(pages_n)); settle(adm)
    check(adm.locator('#events .event').count() == 15 and adm.locator('#ev-pager').is_visible() and adm.locator('#ev-pages').inner_text() == str(pages_n),
          f'the record: 15 a page, {pages_n} pages ({adm.locator("#events .event").count()}, {total} in all)')
    first = adm.locator('#events .event').first.inner_text()
    # (rows taller or shorter on the next page: each grows or shrinks at the turn's own pace, its line gliding with it)
    adm.evaluate('''void (window.__grow = new Promise((done) => { const t0 = performance.now(); (function f() {
      const a = document.getAnimations().filter((a) => a.effect?.target?.matches?.('#events > .event, #events') && 'height' in (a.effect.getKeyframes()[0] || {}));
      if (a.length || performance.now() - t0 > 600) done({ rows: a.filter((x) => x.effect.target.id !== 'events').map((x) => x.effect.getTiming().duration), list: a.some((x) => x.effect.target.id === 'events') }); else requestAnimationFrame(f); })(); }))''')
    hts = [adm.evaluate("[...document.querySelectorAll('#events > .event')].map(e => e.offsetHeight)")]
    adm.click('#ev-next'); grow = adm.evaluate('window.__grow'); settle(adm)
    hts.append(adm.evaluate("[...document.querySelectorAll('#events > .event')].map(e => e.offsetHeight)"))
    differ = any(abs(a - b) > .5 for a, b in zip(*hts))
    check(not differ or (grow['rows'] and set(grow['rows']) == {340}), f'rows taller or shorter on the next page: their heights glide, at the turn\'s pace ({grow}, heights differ: {differ})')
    check(not differ or grow['list'], 'and the record itself grows or shrinks to them, the box with it')
    check(adm.locator('#ev-page').input_value() == '2' and adm.locator('#events .event').first.inner_text() != first, 'next: page 2')
    adm.fill('#ev-page', '99'); adm.press('#ev-page', 'Enter'); until(lambda: adm.locator('#ev-page').input_value() == str(pages_n) and adm.locator('#events .event').count() == total - 15 * (pages_n - 1)); settle(adm)
    check(adm.locator('#ev-page').input_value() == str(pages_n) and adm.locator('#events .event').count() == total - 15 * (pages_n - 1), 'a page typed, past the last: the last')
    adm.fill('#ev-page', '1'); adm.press('#ev-page', 'Enter'); until(lambda: adm.locator('#events .event').first.inner_text() == first and adm.locator('#ev-prev').is_disabled())
    check(adm.locator('#events .event').first.inner_text() == first and adm.locator('#ev-prev').is_disabled(), 'page 1 typed: the first again')
    if os.environ.get('SHOT'): adm.screenshot(path=os.environ['SHOT'], full_page=True)

    check(not errors, f'no page errors {errors}')
    b.close()
srv.should_exit = True
done()
