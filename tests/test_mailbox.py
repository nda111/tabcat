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
    d = dash[0]; d.on('pageerror', lambda e: errors.append(str(e)))
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
    if os.environ.get('SHOT'): settle(bd); bd.locator('.side-bottom').screenshot(path=os.environ['SHOT'] + '-side.png')

    bd.click('#btn-mail'); bd.wait_for_selector('#mail[open]'); settle(bd)
    if os.environ.get('SHOT'): bd.locator('#mail').screenshot(path=os.environ['SHOT'] + '-mail-b.png')
    rows = lambda pg: pg.locator('#mail-list .mail-row:not([data-leaving])')
    texts = rows(bd).all_inner_texts()
    check(len(texts) == 2 and 'boss shared the workspace' in texts[0] and 'Second' in texts[0] and 'Viewer' in texts[0] and 'Own A' in texts[1] and 'Editor' in texts[1], f'the mail, newest first ({texts}; the server: {[(m["workspace"]["name"], m["at"]) for m in api(bd, "/api/mail")["data"]["mail"]]})')
    check(rows(bd).first.locator('button', has_text='Accept').count() == 1 and rows(bd).first.locator('button', has_text='Decline').count() == 1, 'an invite: Accept and Decline')
    look = bd.evaluate("[...document.querySelectorAll('#mail-list .mail-row')].map(r => [r.querySelector('.mail-pick').disabled, r.querySelector('.mail-x').classList.contains('off'), r.querySelector('.mail-x').title || r.querySelector('.mail-x').dataset.tip])")
    check(all(l[0] and l[1] for l in look) and 'answered' in look[0][2] and bd.evaluate("document.querySelector('#mail-all').disabled"), f'not answered: not to be deleted, its tick and × off, saying why ({look})')

    # accepted and declined: the answer in the buttons' place; the badge counts down
    rows(bd).nth(1).locator('button', has_text='Accept').click()
    check(until(lambda: rows(bd).nth(1).locator('.mail-answer').count() and rows(bd).nth(1).locator('.mail-answer').inner_text() == 'Accepted'), 'accepted: "Accepted" in place of the buttons')
    check(until(lambda: badge(bd) == '1'), f'the badge: 1 ({badge(bd)!r})')
    rows(bd).first.locator('button', has_text='Decline').click()
    check(until(lambda: rows(bd).first.locator('.mail-answer').count() and rows(bd).first.locator('.mail-answer').inner_text() == 'Declined'), 'declined: "Declined"')
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
    check(until(lambda: ad.inner_text('#share-error') == 'There’s no account with that username.'), f'no such account, said ({ad.inner_text("#share-error")!r})')
    ad.fill('#share-user', 'ann'); ad.press('#share-user', 'Enter')
    check(until(lambda: ad.inner_text('#share-error') == 'They’re already in it.') and ad.locator('#share[open]').count(), 'already in it, said; Enter keeps the dialog open')
    # live: ann's name changes elsewhere, the row follows
    api(bd, '/api/me/name', 'PUT', {'name': 'Annie'})
    check(until(lambda: 'Annie' in srows.nth(1).inner_text() and 'ann' in srows.nth(1).inner_text()), f'live: ann named Annie elsewhere, her row follows ({srows.nth(1).inner_text()!r})')
    check(not ad.is_visible('#share-end') or 'Delete for everyone' in ad.inner_text('#share-end'), f'the owner: Delete for everyone ({ad.inner_text("#share-end")!r})')
    ad.keyboard.press('Escape')

    check(not errors, f'no page errors {errors}')
    actx.close(); bctx.close()
srv.should_exit = True
done()
