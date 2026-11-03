# Shared workspaces on the user's own server, the dashboard's side: invites come to the Mailbox (a badge counting
# those not answered yet), are accepted or declined there, and the answers come back to the owner's; mail is deleted
# by its × (undoable) or ticked and deleted together. The share manager (the board heading's button) lists who's in a
# workspace, and its owner invites and changes roles there. (The shares are made through the server here, not by the
# extension. Needs fastapi and uvicorn: pip install fastapi uvicorn)
import json, os, sys, tempfile, threading
from harness import *
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server'))
import uvicorn
from tabcat_server import config as C
from tabcat_server.app import create_app
import tabcat_server.app as A
A.API_PER_MINUTE = 100_000  # (every page here from one address, many at once: not held back as too many)

PORT = int(os.environ.get('TABCAT_TEST_PORT', 8765)) + 1000
SERVER = f'http://tabcat.localhost:{PORT}'
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
APP = create_app(C.load(tempfile.mkdtemp(), dashboard=WEB))

def serve():
    srv = uvicorn.Server(uvicorn.Config(APP, host='127.0.0.1', port=PORT, log_level='warning'))
    threading.Thread(target=srv.run, daemon=True).start()
    while not srv.started: time.sleep(.05)
    return srv
srv = serve()

def browser(p, errors, name, user, pw, first):
    ctx, sw = launch(p, manifest={'host_permissions': ['*://tabcat.localhost/*']})
    ext = sw.url.rsplit('/', 1)[0]
    sw.evaluate(f"chrome.storage.local.set({{ tabcat: {{ version: 1, workspaces: [{{ id: 'own-{name}', type: 'workspace', name: 'Own {name}', symbol: '', description: '', categories: [{{ id: 'c-{name}', type: 'category', name: 'C', groups: [{{ id: 'g-{name}', type: 'group', name: 'G {name}', symbol: '', color: '', note: '', collapsed: false, column: 0, items: [] }}] }}] }}] }} }})")
    d = ctx.new_page(); d.goto(SERVER + '/'); time.sleep(.6)
    c = ctx.new_page(); c.goto(f'{ext}/connect.html'); time.sleep(.3)
    c.evaluate(f"chrome.runtime.sendMessage({{ cmd: 'connectServer', args: {{ origin: '{SERVER}' }} }})")
    d.wait_for_selector('#username', timeout=15000); d.bring_to_front()
    d.fill('#username', user); d.fill('#password', pw)
    if first:
        d.fill('#again', pw); d.click('#go'); d.wait_for_url('**/admin')
    else:
        d.click('#go'); time.sleep(1.5)
    for _ in range(40):
        dash = [pg for pg in ctx.pages if pg.url.rstrip('/') == SERVER and pg.locator('.ws-item').count()]
        if dash: break
        if _ == 4:
            try: ctx.new_page().goto(SERVER + '/')
            except Exception: pass
        time.sleep(.5)
    d = dash[0]; d.on('pageerror', lambda e: errors.append(str(e.stack)[:300]))
    return ctx, sw, c, d

def api(pg, path, method='GET', body=None):
    return pg.evaluate("([p, m, b]) => fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b == null ? undefined : JSON.stringify(b) }).then(async r => ({ status: r.status, data: await r.json().catch(() => null) }))", [path, method, body])

def badge(pg):
    return pg.evaluate("(b => b.hidden ? '' : b.querySelector('.num-now')?.textContent ?? b.textContent)(document.querySelector('#btn-mail .mail-badge'))")

errors = []
with sync_playwright() as p:
    actx, a, ac, ad = browser(p, errors, 'A', 'boss', 'correct horse', True)
    check(api(ad, '/api/admin/users', 'POST', {'username': 'ann', 'password': 'annpass99'})['status'] == 200, 'a second account, ann')
    bctx, b, bc, bd = browser(p, errors, 'B', 'ann', 'annpass99', False)
    check(until(lambda: bd.is_visible('#btn-mail') and ad.is_visible('#btn-mail')), 'the Mailbox in the sidebar, signed in on a server')
    check(bd.evaluate("(m => m.nextElementSibling.id)(document.querySelector('#btn-mail'))") == 'btn-trash', 'above Recently deleted')

    # boss shares two workspaces (through the server) and asks ann to both
    tree = a.evaluate("chrome.storage.local.get('tabcat').then(r => r.tabcat)")
    own = next(w for w in tree['workspaces'] if w['id'] == 'own-A')
    s1 = api(ad, '/api/sync/shares', 'POST', {'root': 'own-A', 'body': {'workspaces': [own]}})['data']['id']
    second = {**own, 'id': 'w-second', 'name': 'Second', 'symbol': '🔬', 'categories': []}
    s2 = api(ad, '/api/sync/shares', 'POST', {'root': 'w-second', 'body': {'workspaces': [second]}})['data']['id']
    check(badge(bd) == '', 'no badge with nothing to answer')
    r = api(ad, f'/api/shares/{s1}/invites', 'POST', {'username': 'ann', 'role': 'editor', 'name': 'Own A', 'symbol': ''})
    check(r['status'] == 200, f'invited to the first ({r["status"]})')
    check(until(lambda: badge(bd) == '1'), f'live: the badge, 1 ({badge(bd)!r})')
    api(ad, f'/api/shares/{s2}/invites', 'POST', {'username': 'ann', 'role': 'viewer', 'name': 'Second', 'symbol': '🔬'})
    check(until(lambda: badge(bd) == '2'), f'another: 2 ({badge(bd)!r})')
    settle(bd)
    mid = bd.evaluate("""(() => { const b = document.querySelector('#btn-mail .mail-badge'), r = b.getBoundingClientRect(), n = b.querySelector('.num-now') || b;
      const g = document.createRange(); g.selectNodeContents(n); const t = g.getBoundingClientRect(); return [r.top + r.height / 2, t.top + t.height / 2, r.height]; })()""")
    # (the digits' ink, not their line: rows of light pixels in a picture of it, as many above as below)
    import zlib, struct
    png = bd.locator('#btn-mail .mail-badge').screenshot(animations='disabled')
    w, hgt = struct.unpack('>II', png[16:24]); raw = b''; i = 8
    while i < len(png):
        n, kind = struct.unpack('>I4s', png[i:i + 8]); raw += png[i + 8:i + 8 + n] if kind == b'IDAT' else b''; i += 12 + n
    data = zlib.decompress(raw); bpp = 4 if png[25] == 6 else 3; stride = w * bpp; rows, prev = [], bytearray(stride)
    for y in range(hgt):
        f, line = data[y * (stride + 1)], bytearray(data[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0; b_ = prev[x]; c = prev[x - bpp] if x >= bpp else 0
            line[x] = (line[x] + [0, a, b_, (a + b_) // 2, (a if abs(b_ - c) <= abs(a - c) and abs(b_ - c) <= abs(a + b_ - 2 * c) else b_ if abs(a - c) <= abs(a + b_ - 2 * c) else c) if True else 0][f]) & 255
        # (the middle columns, inside its ring: light pixels there are the digits')
        rows.append(any(min(line[x:x + 3]) > 200 for x in range(bpp * (w // 3), bpp * (w - w // 3), bpp))); prev = line
    ink = [y for y, r in enumerate(rows) if r and 2 <= y <= hgt - 3]
    check(ink and abs((ink[0] + ink[-1]) / 2 - (hgt - 1) / 2) <= .6, f'its number in the middle, up and down (ink rows {ink[:1] + ink[-1:]} of {hgt})')
    if os.environ.get('SHOT'): settle(bd); bd.locator('.side-bottom').screenshot(path=os.environ['SHOT'] + '-side.png')

    bd.click('#btn-mail'); bd.wait_for_selector('#mail[open]'); settle(bd)
    if os.environ.get('SHOT'): bd.locator('#mail').screenshot(path=os.environ['SHOT'] + '-mail-b.png')
    rows = lambda pg: pg.locator('#mail-list .mail-row:not([data-leaving])')
    texts = rows(bd).all_inner_texts()
    # (in the server's order, newest first; which of the two is newer: as it came, under load either)
    order = [m['workspace']['name'] for m in api(bd, '/api/mail')['data']['mail']]
    check(len(texts) == 2 and all('boss shared the workspace' in x and n in x for x, n in zip(texts, order)) and any('Viewer' in x for x in texts) and any('Editor' in x for x in texts), f'the mail, newest first ({texts}; the server: {order})')
    row_of = lambda name: rows(bd).filter(has_text=name).first
    check(rows(bd).first.locator('button', has_text='Accept').count() == 1 and rows(bd).first.locator('button', has_text='Decline').count() == 1, 'an invite: Accept and Decline')
    look = bd.evaluate("[...document.querySelectorAll('#mail-list .mail-row')].map(r => [r.querySelector('.mail-pick').disabled, r.querySelector('.mail-x').hidden, Math.round(r.getBoundingClientRect().right - r.querySelector('.mail-acts').getBoundingClientRect().right)])")
    check(all(l[0] and l[1] and l[2] <= 10 for l in look) and bd.evaluate("document.querySelector('#mail-all').disabled"), f'not answered: not to be deleted, its tick off, no × at all, Accept and Decline over to its place ({look})')

    # accepted and declined: the answer in the buttons' place; the badge counts down
    row_of('Own A').locator('button', has_text='Accept').click()
    check(until(lambda: row_of('Own A').locator('.mail-answer').count() and row_of('Own A').locator('.mail-answer').inner_text() == 'Accepted'), 'accepted: "Accepted" in place of the buttons')
    check(until(lambda: badge(bd) == '1'), f'the badge: 1 ({badge(bd)!r})')
    row_of('Second').locator('button', has_text='Decline').click()
    check(until(lambda: row_of('Second').locator('.mail-answer').count() and row_of('Second').locator('.mail-answer').inner_text() == 'Declined'), 'declined: "Declined"')
    check(until(lambda: badge(bd) == ''), f'nothing left to answer: no badge ({badge(bd)!r})')
    check(until(lambda: not bd.evaluate("document.querySelector('#mail-list .mail-pick').disabled")), 'answered: its tick on')
    members = api(ad, f'/api/shares/{s1}')['data']['members']
    check(sorted(m['username'] for m in members) == ['ann', 'boss'], f'ann in the first ({[m["username"] for m in members]})')
    bd.keyboard.press('Escape')
    check(until(lambda: not bd.locator('#mail[open]').count()), 'Escape closes the Mailbox')

    # the answers in boss's mailbox (no badge: nothing to answer)
    check(until(lambda: len(api(ad, '/api/mail')['data']['mail']) == 2), 'the answers mailed back')
    check(badge(ad) == '', 'answers: no badge')
    ad.click('#btn-mail'); ad.wait_for_selector('#mail[open]'); settle(ad)
    texts = rows(ad).all_inner_texts()
    check(len(texts) == 2 and 'ann declined your invite to' in texts[0] and 'ann accepted your invite to' in texts[1], f'boss: who answered, and how ({texts})')

    if os.environ.get('SHOT'): ad.locator('#mail').screenshot(path=os.environ['SHOT'] + '-mail.png')
    # × deletes one (undoable from its toast)
    rows(ad).first.locator('.mail-x').click()
    check(until(lambda: rows(ad).count() == 1 and len(api(ad, '/api/mail')['data']['mail']) == 1), '×: deleted')
    check(until(lambda: ad.locator('.toast-item', has_text='Deleted the message').count() == 1), 'a toast: "Deleted the message"')
    ad.locator('.toast-item', has_text='Deleted the message').locator('button', has_text='Undo').click()
    check(until(lambda: rows(ad).count() == 2 and len(api(ad, '/api/mail')['data']['mail']) == 2), 'Undo: back')

    # ticked: the head's tick shows some (a dash) or all; Delete (n) comes
    allbox = lambda: ad.evaluate("(b => [b.checked, b.indeterminate])(document.querySelector('#mail-all'))")
    check(not ad.is_visible('#mail-del'), 'nothing ticked: no Delete')
    rows(ad).first.locator('.mail-pick').check(); settle(ad)
    check(allbox() == [False, True] and ad.is_visible('#mail-del') and ad.inner_text('#mail-del') == 'Delete (1)', f'one of two: a dash, "Delete (1)" ({allbox()}, {ad.inner_text("#mail-del")!r})')
    ad.check('#mail-all'); settle(ad)
    check(allbox() == [True, False] and ad.inner_text('#mail-del') == 'Delete (2)', f'all: ticked, "Delete (2)" ({ad.inner_text("#mail-del")!r})')
    ad.uncheck('#mail-all'); settle(ad)
    check(allbox() == [False, False] and not ad.is_visible('#mail-del'), 'none again: Delete goes')
    ad.check('#mail-all'); settle(ad); ad.click('#mail-del')
    check(until(lambda: rows(ad).count() == 0 and ad.is_visible('#mail-none')), f'deleted together: "No mail." ({ad.inner_text("#mail-none")!r})')
    check(until(lambda: api(ad, '/api/mail')['data']['mail'] == []), 'and on the server')
    ad.keyboard.press('Escape'); settle(ad)

    # the share manager: boss's Own A (shared, two in it)
    btn = ad.locator('#ws-head .ws-share')
    check(until(lambda: btn.count() == 1 and btn.inner_text().strip() == '2'), f'the heading: a share button, 2 in it ({btn.inner_text() if btn.count() else None!r})')
    btn.click(); ad.wait_for_selector('#share[open]'); settle(ad)
    check('Share' in ad.inner_text('#share-title') and 'Own A' in ad.inner_text('#share-title'), f'titled "Share Own A" ({ad.inner_text("#share-title")!r})')
    srows = ad.locator('#share-list .share-row:not([data-leaving])')
    names = srows.all_inner_texts()
    check(len(names) == 2 and 'boss' in names[0] and '(you)' in names[0] and 'Owner' in names[0] and 'ann' in names[1], f'who: boss (you), owner; ann ({names})')
    check(srows.nth(1).locator('select').input_value() == 'editor' and srows.first.locator('select').count() == 0, "ann's role to choose, as an editor; not boss's own")
    srows.nth(1).locator('select').select_option('viewer')
    check(until(lambda: next(m['role'] for m in api(ad, f'/api/shares/{s1}')['data']['members'] if m['username'] == 'ann') == 'viewer'), 'made a viewer')
    if os.environ.get('SHOT'): settle(ad); ad.locator('#share').screenshot(path=os.environ['SHOT'] + '-share.png'); ad.locator('#topbar').screenshot(path=os.environ['SHOT'] + '-head.png')
    ad.fill('#share-user', 'nobody'); ad.click('#share-go')
    check(until(lambda: ad.inner_text('#share-error') == 'This account doesn’t exist or was deleted.'), f'no such account, said ({ad.inner_text("#share-error")!r})')
    ad.fill('#share-user', 'ann'); ad.press('#share-user', 'Enter')
    check(until(lambda: ad.inner_text('#share-error') == 'They’re already in it.') and ad.locator('#share[open]').count(), 'already in it, said; Enter keeps the dialog open')
    # live: ann's name changes elsewhere, the row follows
    api(bd, '/api/me/name', 'PUT', {'name': 'Annie'})
    check(until(lambda: 'Annie' in srows.nth(1).inner_text() and 'ann' in srows.nth(1).inner_text()), f'live: ann named Annie elsewhere, her row follows ({srows.nth(1).inner_text()!r}, {api(ad, f"/api/shares/{s1}")["data"]["members"]})')
    check(ad.is_visible('#share-end') and 'Remove everyone' in ad.inner_text('#share-end'), f'the owner, others in it: Remove everyone ({ad.inner_text("#share-end")!r})')

    # whom to invite: found by username or name as typed, a list under the field
    api(ad, '/api/admin/users', 'POST', {'username': 'carl', 'password': 'carlpass99', 'name': 'Carlos'})
    ad.fill('#share-user', ''); ad.type('#share-user', 'carlo')
    check(until(lambda: ad.is_visible('#share-found') and 'carl' in ad.inner_text('#share-found')), f'typed a name: found ({ad.inner_text("#share-found") if ad.locator("#share-found").count() else None!r}, {errors}, {ad.evaluate("[document.querySelector(\'#share-found\').hidden, document.querySelector(\'#share-found\').children.length, document.querySelector(\'#share-user\').value]")})')
    ad.fill('#share-user', 'an')
    check(until(lambda: not ad.is_visible('#share-found') or 'ann' not in ad.inner_text('#share-found')), 'those in it already: not offered')
    ad.fill('#share-user', 'car'); until(lambda: ad.is_visible('#share-found'))
    ad.press('#share-user', 'ArrowDown'); ad.press('#share-user', 'Enter')
    check(ad.input_value('#share-user') == 'carl' and until(lambda: not ad.is_visible('#share-found')), 'picked with the arrow and Enter: its username, the list gone')
    ad.click('#share-go')
    check(until(lambda: srows.count() == 3), 'carl asked: listed')
    # let go: told by mail; everyone let go: the owner alone, the heading's button gone
    ann_id = next(m['id'] for m in api(ad, f'/api/shares/{s1}')['data']['members'] if m['username'] == 'ann')
    srows.nth(1).locator('.share-x').click(); ad.wait_for_selector('#confirm[open]'); ad.click('#confirm-ok')
    check(until(lambda: api(bd, '/api/mail')['data']['mail'][0]['kind'] == 'removed'), "ann let go: told by mail")
    bd.click('#btn-mail'); bd.wait_for_selector('#mail[open]'); settle(bd)
    check('boss/' in rows(bd).first.inner_text() and 'removed' in rows(bd).first.inner_text(), f"as \"You were removed from boss/Own A\" ({rows(bd).first.inner_text()!r})")
    bd.keyboard.press('Escape'); settle(bd)
    ad.click('#share-end'); ad.wait_for_selector('#confirm[open]'); ad.click('#confirm-ok')
    check(until(lambda: srows.count() == 1 and not ad.is_visible('#share-end')), 'everyone let go: the owner alone, "Remove everyone" gone')
    ad.keyboard.press('Escape'); settle(ad)
    check(until(lambda: ad.locator('#ws-head .ws-share').count() == 0), 'and the heading has no share button (no one else in it)')
    ad.click('#ws-head h1', button='right'); ad.wait_for_selector('#menu:not([hidden])')
    check(ad.locator('#menu button', has_text='Share').count() == 1, "sharing starts from the workspace's menu")
    ad.keyboard.press('Escape')

    # shared with ann as a viewer: apart in her sidebar; nothing to edit with; leaving from its menu
    api(ad, f'/api/shares/{s1}/invites', 'POST', {'username': 'ann', 'role': 'viewer', 'name': 'Own A'})
    inv = api(bd, '/api/mail')['data']['mail'][0]
    api(bd, f"/api/mail/{inv['id']}/answer", 'POST', {'accept': True})
    split = lambda: bd.evaluate("[...document.querySelectorAll('#ws-list > li')].map(li => li.classList.contains('ws-split') ? '|' : li.querySelector('.name')?.textContent).filter(Boolean)")
    check(until(lambda: split()[-2:] == ['|', 'Own A'], timeout=20), f"ann's sidebar: Own A below a line ({split()})")
    settle(bd)
    lab = bd.evaluate("(s => { const i = s.querySelector('svg').getBoundingClientRect(), l = s.querySelector('.label').getBoundingClientRect(); return [s.querySelector('.label').textContent, i.right <= l.left, Math.abs((i.top + i.bottom) / 2 - (l.top + l.bottom) / 2)]; })(document.querySelector('#ws-list .ws-split'))")
    check(lab[0] == 'Shared' and lab[1] and lab[2] <= 1, f'"Shared" right of its icon, in the middle up and down ({lab})')
    if os.environ.get('SHOT'): bd.locator('#sidebar').screenshot(path=os.environ['SHOT'] + '-split.png')
    bd.click("#ws-list .ws-item:has-text('Own A')"); settle(bd)
    if os.environ.get('SHOT'):
        settle(bd); bd.screenshot(path=os.environ['SHOT'] + '-viewer.png')
        bd.locator('#btn-mail').screenshot(path=os.environ['SHOT'] + '-badge.png', scale='device')
    check(until(lambda: bd.evaluate("document.body.classList.contains('viewing')") and bd.is_visible('#ws-head .ws-readonly')), 'viewing it: "View only" beside its name')
    check(bd.locator('#board .edits:visible, #board .add-group:visible').count() == 0, 'and no editing buttons')
    bd.keyboard.press('Escape')
    bd.click('#ws-head h1', button='right'); bd.wait_for_selector('#menu:not([hidden])')
    items = bd.evaluate("[...document.querySelectorAll('#menu button')].map(b => b.textContent.trim())")
    check(any(i.startswith('Leave') for i in items) and not any(i.startswith('Edit') for i in items), f'its menu: Leave, no Edit ({items})')
    bd.locator('#menu button', has_text='Leave').click(); bd.wait_for_selector('#confirm[open]')
    check('invited again' in bd.inner_text('#confirm-text'), f"asked first ({bd.inner_text('#confirm-text')!r})")
    bd.click('#confirm-ok')
    check(until(lambda: '|' not in split(), timeout=20), f'left: gone from her sidebar ({split()})')
    check(until(lambda: api(ad, '/api/mail')['data']['mail'][0]['kind'] == 'left'), 'the owner told by mail')

    # many: ten a page, a pager; all deleted at once, asked first
    for i in range(12):
        w = {'id': f'many{i}', 'type': 'workspace', 'name': f'Many {i}', 'categories': []}
        sid = api(ad, '/api/sync/shares', 'POST', {'root': w['id'], 'body': {'workspaces': [w]}})['data']['id']
        api(ad, f'/api/shares/{sid}/invites', 'POST', {'username': 'ann', 'role': 'viewer', 'name': w['name']})
        api(bd, f"/api/mail/{api(bd, '/api/mail')['data']['mail'][0]['id']}/answer", 'POST', {'accept': False})
    bd.click('#btn-mail'); bd.wait_for_selector('#mail[open]'); settle(bd)
    total = len(api(bd, '/api/mail')['data']['mail'])
    check(rows(bd).count() == 10 and bd.is_visible('#mail-pager') and bd.inner_text('#mail-at').strip() == f'1 / {-(-total // 10)}', f'ten a page, a pager ({rows(bd).count()}, {bd.inner_text("#mail-at")!r}, {total})')
    bd.click('#mail-next'); settle(bd)
    check(until(lambda: rows(bd).count() == total - 10 and bd.inner_text('#mail-at').strip().startswith('2')), 'the next page')
    bd.click('#mail-clear'); bd.wait_for_selector('#confirm[open]')
    check(bd.inner_text('#confirm-title') == 'Delete all mail?', f"asked first ({bd.inner_text('#confirm-title')!r})")
    bd.click('#confirm-ok')
    check(until(lambda: api(bd, '/api/mail')['data']['mail'] == [] and rows(bd).count() == 0), 'all deleted')
    bd.keyboard.press('Escape')

    check(not errors, f'no page errors {errors}')
    actx.close(); bctx.close()
srv.should_exit = True
done()
