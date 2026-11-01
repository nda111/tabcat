# tabcat-server in a browser, with the extension: the first account (an admin) is made on first visit; the
# admin page lists it and adds a user; the dashboard opens signed in, with Account in Settings; connected,
# the extension links up with it there; signed out, it asks to sign in again.
# (Needs fastapi and uvicorn: pip install fastapi uvicorn)
import os, sys, tempfile, threading
from harness import *
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server'))
import uvicorn
from tabcat_server import config as C
from tabcat_server.app import create_app

PORT = 8766
SERVER = f'http://tabcat.localhost:{PORT}'
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
srv = uvicorn.Server(uvicorn.Config(create_app(C.load(tempfile.mkdtemp(), dashboard=WEB)), host='127.0.0.1', port=PORT, log_level='warning'))
threading.Thread(target=srv.run, daemon=True).start()
while not srv.started: time.sleep(.05)

errors = []
with sync_playwright() as p:
    ctx, sw = launch(p, manifest={'host_permissions': ['*://tabcat.localhost/*']})
    d = ctx.new_page(); d.on('pageerror', lambda e: errors.append(str(e)))
    d.set_viewport_size({'width': 1300, 'height': 800})
    d.goto(SERVER + '/'); d.wait_for_load_state('networkidle')
    check(d.url.endswith('/setup') and d.is_visible('#username'), f'first visit: make the first account ({d.url})')
    bg = d.evaluate("getComputedStyle(document.querySelector('#go')).backgroundColor")
    check('300' in bg, f"in tabcat's own purple, with no look kept yet ({bg})")
    d.fill('#username', 'boss'); d.fill('#password', 'correct horse'); d.fill('#again', 'correct horse'); d.click('#go')
    d.wait_for_url('**/admin'); d.wait_for_selector('#users tr')
    check(d.locator('#users tr').count() == 1 and 'boss' in d.inner_text('#users'), 'the admin page lists it')
    d.fill('#add-name', 'kid'); d.fill('#add-pw', 'kidpass99'); d.click('#add-form button[type=submit]'); time.sleep(.6)
    check(d.locator('#users tr').count() == 2, 'and adds a user')
    d.locator('#signup input[value=invite]').check(); time.sleep(.4)
    check('Saved' in d.inner_text('#settings-msg'), 'sign-up is set to by invitation')
    d.click('#invite-form button[type=submit]'); time.sleep(.5)
    check(d.locator('#invites code').count() == 1, 'an invitation is made')
    check('github' not in d.inner_text('#info').lower() and 'web' in d.inner_text('#info'), 'the server tells where its dashboard comes from')
    # the dashboard: not linked yet (no extension there), it says to connect
    d.goto(SERVER + '/'); time.sleep(1.5)
    check(d.is_visible('#no-ext') and 'connect to the server' in d.inner_text('#no-ext-step2'), 'signed in, the dashboard says to connect to the server')
    # connect: the dashboard links up and shows the board; Settings has the account
    ext = sw.url.rsplit('/', 1)[0]
    c = ctx.new_page(); c.goto(f'{ext}/connect.html'); time.sleep(.3)
    c.evaluate(f"chrome.runtime.sendMessage({{ cmd: 'connectServer', args: {{ origin: '{SERVER}' }} }})")
    d.wait_for_selector('.ws-item', timeout=15000); time.sleep(1)
    check(d.evaluate("document.querySelector('#no-ext').hidden"), 'connected: the board')
    d.click('#btn-settings'); time.sleep(.5)
    check(d.is_visible('#account-row') and d.inner_text('#account-name') == 'boss' and d.is_visible('#account-admin'), 'Settings shows the account, and the admin page for an admin')
    d.keyboard.press('Escape'); time.sleep(.3)
    # signed out: the dashboard asks to sign in again
    d.goto(SERVER + '/account'); d.wait_for_function("document.querySelector('#who').textContent"); d.click('#logout'); d.wait_for_url('**/login')
    d.goto(SERVER + '/'); time.sleep(.5)
    check(d.url.endswith('/login'), f'signed out, the dashboard asks to sign in ({d.url})')
    d.fill('#username', 'kid'); d.fill('#password', 'kidpass99'); d.click('#go'); d.wait_for_url(SERVER + '/'); d.wait_for_selector('.ws-item', timeout=15000)
    d.click('#btn-settings'); time.sleep(.5)
    check(d.inner_text('#account-name') == 'kid' and not d.is_visible('#account-admin'), 'a user signs in: no admin page for them')
    check(not errors, f'no page errors {errors}')
    ctx.close()
srv.should_exit = True
done()
