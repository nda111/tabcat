# Workspaces shared between accounts, end to end through the extension: one account shares a workspace (its data
# its own from then on), asks another by mail, who accepts and then has it among their workspaces; changes go both
# ways, a viewer's are not kept, leaving takes it away, and the owner deleting it keeps a copy in Recently deleted.
# (Needs fastapi and uvicorn: pip install fastapi uvicorn)
import os, sys, tempfile, threading, json
from harness import *
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server'))
import uvicorn
from tabcat_server import config as C
from tabcat_server import app as A
from tabcat_server.app import create_app
A.API_PER_MINUTE = 100_000  # (every page here from one address, many at once: not held back as too many)

SERVER = f'http://tabcat.localhost:{PORT}'
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
APP = create_app(C.load(tempfile.mkdtemp(), dashboard=WEB))

def serve():
    srv = uvicorn.Server(uvicorn.Config(APP, host='127.0.0.1', port=PORT, log_level='warning'))
    threading.Thread(target=srv.run, daemon=True).start()
    while not srv.started: time.sleep(.05)
    return srv
srv = serve()

TREE = "chrome.storage.local.get('tabcat').then(r => r.tabcat)"
def wss(sw): return sw.evaluate(f"{TREE}.then(s => s.workspaces.map(w => [w.name, w.share || null]))")
def call(page, cmd, args=None):
    return page.evaluate("([c, a]) => chrome.runtime.sendMessage({ cmd: c, args: a })", [cmd, args or {}])
def api(page, method, path, body=None):
    return page.evaluate("""([m, p, b]) => fetch(p, { method: m, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => ({ status: r.status, json: await r.json().catch(() => null) }))""", [method, path, body])

def browser(p, errors, name, user, pw, first):
    ctx, sw = launch(p, manifest={'host_permissions': ['*://tabcat.localhost/*']})
    ext = sw.url.rsplit('/', 1)[0]
    sw.evaluate(f"chrome.storage.local.set({{ tabcat: {{ version: 1, workspaces: [{{ id: 'own-{name}', type: 'workspace', name: 'Own {name}', symbol: '', description: '', categories: [{{ id: 'c-{name}', type: 'category', name: 'C', groups: [{{ id: 'g-{name}', type: 'group', name: 'G {name}', symbol: '', color: '', note: '', collapsed: false, column: 0, items: [] }}] }}] }}] }} }})")
    d = ctx.new_page(); d.on('pageerror', lambda e: errors.append(str(e)))
    d.goto(SERVER + '/'); settle(d)
    c = ctx.new_page(); c.goto(f'{ext}/connect.html'); settle(c)
    c.evaluate(f"chrome.runtime.sendMessage({{ cmd: 'connectServer', args: {{ origin: '{SERVER}' }} }})")
    d.wait_for_selector('#username', timeout=15000); d.bring_to_front()
    d.fill('#username', user); d.fill('#password', pw)
    if first:
        d.fill('#again', pw); d.click('#go'); d.wait_for_url('**/admin')
    else:
        d.click('#go')
    for i in range(60):
        dash = [pg for pg in ctx.pages if pg.url.rstrip('/') == SERVER and pg.locator('.ws-item').count()]
        if dash: break
        if i == 4:
            try: ctx.new_page().goto(SERVER + '/')
            except Exception: pass  # (sent to the dashboard there is)
        time.sleep(.5)
    d = dash[0]; d.on('pageerror', lambda e: errors.append(str(e)))
    return ctx, sw, c, d

errors = []
with sync_playwright() as p:
    actx, a, ac, ad = browser(p, errors, 'A', 'boss', 'correct horse', True)
    until(lambda: (s := call(ac, 'syncStatus')['result']) and s['seq'] is not None)
    api(ad, 'POST', '/api/admin/users', {'username': 'ben', 'password': 'benpass99'})
    bctx, b, bc, bd = browser(p, errors, 'B', 'ben', 'benpass99', False)
    until(lambda: (s := call(bc, 'syncStatus')['result']) and s['seq'] is not None)
    check(wss(b) == [['Own B', None]], f"ben's own data, apart from boss's ({wss(b)})")

    # boss shares Own A
    r = call(ac, 'shareWorkspace', {'id': 'own-A'})
    sid = (r.get('result') or {}).get('id')
    check(sid and wss(a) == [['Own A', sid]], f'shared: the workspace marked with its share, still shown ({r}, {wss(a)})')
    check(call(ac, 'shareWorkspace', {'id': 'own-A'})['result']['id'] == sid, 'shared again: the same share')
    state = api(ad, 'GET', f'/api/shares/{sid}')['json']
    check(state and [m['username'] for m in state['members']] == ['boss'] and state['role'] == 'owner', f'boss its owner ({state})')
    # (boss's own data: a stub where it goes, the content in the share)
    until(lambda: call(ac, 'syncStatus')['result']['unsent'] == 0)
    snap = api(ad, 'GET', '/api/sync/state')['json']
    own_ops = json.dumps(snap)
    check('"share"' in own_ops, "boss's own data keeps only a stub for it")

    # asked, accepted
    api(ad, 'POST', f'/api/shares/{sid}/invites', {'username': 'ben', 'role': 'editor', 'name': 'Own A'})
    box = api(bd, 'GET', '/api/mail')['json']
    check(box['asking'] == 1, f"ben's mailbox: one asking ({box['asking']})")
    api(bd, 'POST', f"/api/mail/{box['mail'][0]['id']}/answer", {'accept': True})
    call(bc, 'syncNow')
    check(until(lambda: wss(b) == [['Own B', None], ['Own A', sid]], timeout=20), f'accepted: in ben\'s workspaces, last ({wss(b)})')
    gname = lambda sw, gid='g-A': sw.evaluate(f"{TREE}.then(s => s.workspaces.flatMap(w => w.categories).flatMap(c => c.groups).find(g => g.id === '{gid}')?.name)")
    check(gname(b) == 'G A', f'with its content ({gname(b)})')

    # changes both ways
    call(bc, 'apply', [{'op': 'patch', 'id': 'g-A', 'fields': {'name': 'From ben'}}])
    check(until(lambda: gname(a) == 'From ben', timeout=20), f"ben (an editor) renames a group: boss sees it ({gname(a)})")
    call(ac, 'apply', [{'op': 'patch', 'id': 'own-A', 'fields': {'name': 'Team'}}])
    check(until(lambda: ['Team', sid] in wss(b), timeout=20), f'boss renames the workspace: ben sees it ({wss(b)})')
    # a card's colour changed by boss: on ben's board it fades to the new one, as when changed there
    bd.click(".ws-item:has-text('Team')"); bd.wait_for_selector("#board .group[data-id='g-A']")
    bd.evaluate("""() => { window.__fades = []; new MutationObserver(() => { const g = document.querySelector("#board .group[data-id='g-A']");
      for (const an of g?.getAnimations() || []) { const k = an.effect.getKeyframes()[0]; if (k && 'backgroundColor' in k) window.__fades.push([g.dataset.color || '', k.backgroundColor]); } })
      .observe(document.querySelector('#board'), { childList: true, subtree: true }); }""")
    call(ac, 'apply', [{'op': 'patch', 'id': 'g-A', 'fields': {'color': 'blue'}}])
    check(until(lambda: bd.evaluate("window.__fades").__len__() > 0, timeout=20) and bd.evaluate("window.__fades")[0][0] == 'blue', f"boss colours a card: on ben's board it fades into blue ({bd.evaluate('window.__fades')})")
    # a card shut by ben: his alone (not kept in step); boss's stays open, through later changes too
    call(bc, 'apply', [{'op': 'patch', 'id': 'g-A', 'fields': {'collapsed': True}}])
    call(ac, 'apply', [{'op': 'patch', 'id': 'g-A', 'fields': {'name': 'After shut'}}])
    shut = lambda sw: sw.evaluate(f"{TREE}.then(s => s.workspaces.flatMap(w => w.categories).flatMap(c => c.groups).find(g => g.id === 'g-A')?.collapsed)")
    check(until(lambda: gname(b) == 'After shut', timeout=20) and shut(b) is True and shut(a) is False, f'a card shut: shut for ben only, through a change from boss ({shut(b)}, {shut(a)})')
    call(bc, 'apply', [{'op': 'patch', 'id': 'g-A', 'fields': {'collapsed': False}}])
    # moved in from one's own workspace: a copy there for the others, gone from one's own
    call(bc, 'apply', [{'op': 'move', 'id': 'g-B', 'parentId': 'c-A', 'index': 1}])
    check(until(lambda: gname(a, 'g-B') == 'G B', timeout=20), f"a group moved into it by ben: boss has it ({gname(a, 'g-B')})")
    ben_own = api(bd, 'GET', '/api/sync/state')['json']
    # ben's own workspace order kept apart: ben moves it first, boss's order unchanged
    call(bc, 'apply', [{'op': 'move', 'id': 'own-A', 'parentId': None, 'index': 0}])
    until(lambda: call(bc, 'syncStatus')['result']['unsent'] == 0)
    time.sleep(1)
    check(wss(a)[0] == ['Team', sid] and wss(b)[0] == ['Team', sid] and len(wss(a)) == 1, f'where it goes in the list: each account its own ({wss(a)}, {wss(b)})')

    # a viewer: changes not kept
    ben_id = api(bd, 'GET', '/api/me')['json']['id']
    api(ad, 'PUT', f'/api/shares/{sid}/members/{ben_id}', {'role': 'viewer'})
    call(bc, 'syncNow')
    until(lambda: (s := b.evaluate("chrome.storage.local.get('tabcat:sync').then(r => r['tabcat:sync'].shares)")) and list(s.values())[0]['role'] == 'viewer', timeout=15)
    call(bc, 'apply', [{'op': 'patch', 'id': 'g-A', 'fields': {'name': 'Not kept'}}])
    check(until(lambda: gname(b) == 'After shut', timeout=10), f"made a viewer: ben's change goes back ({gname(b)})")
    time.sleep(1)
    check(gname(a) == 'After shut', f'and never reaches boss ({gname(a)})')

    # deleted the usual way: refused (left or deleted for everyone instead)
    r = call(bc, 'apply', [{'op': 'remove', 'id': 'own-A', 'trash': True}])
    check('shared' in (r.get('error') or ''), f'a shared workspace is not deleted as others are ({r})')

    # leaving
    r = call(bc, 'leaveShare', {'id': sid})
    check(r.get('result') is True and until(lambda: all(w[1] is None for w in wss(b)), timeout=10), f'ben leaves: gone from his workspaces ({wss(b)})')
    stubs = lambda: b.evaluate("chrome.storage.local.get('tabcat:sync').then(r => { const y = r['tabcat:sync']; return [y.base, y.shadow].map(d => d.workspaces.filter(w => w.share).length); })")
    check(until(lambda: stubs() == [0, 0] and call(bc, 'syncStatus')['result']['pending'] == 0, timeout=15), f"and its stub from his own data, on the server too ({stubs()})")
    check(wss(a) == [['Team', sid]], f'still boss\'s ({wss(a)})')

    # the owner deletes it: kept in Recently deleted, put back as boss's own
    r = call(ac, 'deleteShare', {'id': sid})
    check(r.get('result') is True and until(lambda: wss(a) == [], timeout=10), f'boss deletes it: gone ({wss(a)})')
    trash = call(ac, 'getTrash')['result']
    check(trash and trash[0]['node']['name'] == 'Team' and 'share' not in trash[0]['node'], f'in Recently deleted, as his own ({[e["node"]["name"] for e in trash]})')
    call(ac, 'restoreTrash', {'id': trash[0]['id']})
    check(until(lambda: wss(a) == [['Team', None]]), f'put back: his own workspace ({wss(a)})')
    check(api(ad, 'GET', '/api/shares')['json']['shares'] == [], 'no shares left')

    check(not errors, f'no page errors ({errors[:3]})')
    actx.close(); bctx.close()
srv.should_exit = True
done()
