# Several accounts in one browser, on the user's own tabcat server: the Account dialog's arrow opens the
# other accounts; adding one signs in beside the first; picking one opens the dashboard as it (its data);
# one can be signed out of from the list; signing out goes on to the next.
# (Needs fastapi and uvicorn: pip install fastapi uvicorn)
import os, sys, tempfile, threading
from harness import *
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server'))
import uvicorn
from tabcat_server import config as C
from tabcat_server.app import create_app

PORT = 8767
SERVER = f'http://tabcat.localhost:{PORT}'
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
srv = uvicorn.Server(uvicorn.Config(create_app(C.load(tempfile.mkdtemp(), dashboard=WEB)), host='127.0.0.1', port=PORT, log_level='warning'))
threading.Thread(target=srv.run, daemon=True).start()
while not srv.started: time.sleep(.05)

errors = []
with sync_playwright() as p:
    ctx, sw = launch(p, manifest={'host_permissions': ['*://tabcat.localhost/*']})
    d = ctx.new_page(); d.on('pageerror', lambda e: errors.append(str(e)))
    d.goto(SERVER + '/'); time.sleep(1)
    ext = sw.url.rsplit('/', 1)[0]
    c = ctx.new_page(); c.goto(f'{ext}/connect.html'); time.sleep(.3)
    c.evaluate(f"chrome.runtime.sendMessage({{ cmd: 'connectServer', args: {{ origin: '{SERVER}' }} }})")
    d.wait_for_selector('#username', timeout=15000); d.bring_to_front()
    d.fill('#username', 'boss'); d.fill('#password', 'correct horse'); d.fill('#again', 'correct horse'); d.click('#go')
    d.wait_for_url('**/admin'); d.wait_for_selector('#users tr')
    d.fill('#add-name', 'kid'); d.fill('#add-pw', 'kidpass99'); d.click('#add-form button[type=submit]'); time.sleep(.6)
    with ctx.expect_page(lambda pg: pg.url.startswith(SERVER), timeout=15000) as opened:
        d.goto(SERVER + '/')
    d = opened.value; d.on('pageerror', lambda e: errors.append(str(e))); d.bring_to_front()
    d.set_viewport_size({'width': 1200, 'height': 800}); d.wait_for_selector('.ws-item', timeout=15000); time.sleep(1)
    sw.evaluate("chrome.storage.local.get('tabcat').then(r=>{const s=r.tabcat; s.workspaces.push({id:'bossws',type:'workspace',name:'BossOnly',symbol:'',description:'',categories:[{id:'bossc',type:'category',name:'C',groups:[]}]}); return chrome.storage.local.set({tabcat:s})})")
    time.sleep(.6)
    names = lambda: d.evaluate("[...document.querySelectorAll('.ws-item')].map(e => e.title)")
    who = lambda: d.inner_text('#account-name')

    d.click('#btn-account'); time.sleep(.4)
    d.click('#account-more'); time.sleep(.5)
    check(d.is_visible('#account-list') and d.get_attribute('#account-more', 'aria-expanded') == 'true' and d.locator('.account-other').count() == 0 and d.is_enabled('.account-add'),
          'the arrow opens the other accounts: none yet, Add another account')
    d.click('.account-add'); d.wait_for_url('**/login?add=1', timeout=10000); d.wait_for_selector('#username:visible')
    check(d.is_visible('#back'), 'adding one: the sign-in page, with the way back')
    d.fill('#username', 'kid'); d.fill('#password', 'kidpass99'); d.click('#go')
    d.wait_for_url(SERVER + '/'); d.wait_for_selector('.ws-item', timeout=15000); time.sleep(1)
    d.click('#btn-account'); time.sleep(.4)
    check(who() == 'kid' and 'BossOnly' not in names(), f"signed in as kid beside boss: kid's dashboard ({who()}, {names()})")
    d.click('#account-more'); time.sleep(.5)
    check([n.split('\n')[0] for n in d.locator('.account-other .account-name').all_inner_texts()] == ['boss'], 'boss is among the other accounts')
    d.click('.account-other .account-pick')
    d.wait_for_function("document.documentElement.classList.contains('booting') && getComputedStyle(document.querySelector('#boot')).opacity === '1'", timeout=5000)
    check(True, 'switching: the spinner comes up as the dashboard goes')
    d.wait_for_function("document.documentElement.classList.contains('opening')", timeout=15000)
    check(not d.evaluate("document.documentElement.classList.contains('reloaded')"), 'and the dashboard opens as another account would come, not as a reload')
    d.wait_for_selector('.ws-item', timeout=15000); time.sleep(1.5)
    d.click('#btn-account'); time.sleep(.4)
    check(who() == 'boss' and 'BossOnly' in names(), f"picked: the dashboard opens as boss, with boss's data ({who()}, {names()})")
    d.click('#account-more'); time.sleep(.5)
    d.click('.account-other .account-out'); time.sleep(.8)
    check(d.locator('.account-other').count() == 0, 'kid signed out of from the list: gone from it')
    d.keyboard.press('Escape'); time.sleep(.3)
    d.click('#btn-account'); time.sleep(.3); d.click('#account-signout')
    d.wait_for_url('**/login', timeout=10000)
    check(d.url.endswith('/login'), 'signing out of the last one: the sign-in page')
    check(not errors, f'no page errors {errors}')
    ctx.close()
srv.should_exit = True
done()
