# Two-step sign-in, on the user's own tabcat server (optional, per account): turned on on the account page (a QR
# code and its key, the first code, then recovery codes); signing in then asks for the app's code after the
# password, or a recovery code; the admin list marks who has it.
# (Needs fastapi, uvicorn and segno: pip install fastapi uvicorn segno)
import os, sys, tempfile, threading
from harness import *
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server'))
import uvicorn
from tabcat_server import config as C, totp
from tabcat_server.app import create_app

PORT = 8768
SERVER = f'http://tabcat.localhost:{PORT}'
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
srv = uvicorn.Server(uvicorn.Config(create_app(C.load(tempfile.mkdtemp(), dashboard=WEB)), host='127.0.0.1', port=PORT, log_level='warning'))
threading.Thread(target=srv.run, daemon=True).start()
while not srv.started: time.sleep(.05)
code_at = lambda secret, ahead=0: totp._code(secret, int(time.time()) // 30 + ahead)

errors = []
with sync_playwright() as p:
    ctx, sw = launch(p, manifest={'host_permissions': ['*://tabcat.localhost/*']})
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=SERVER)
    d = ctx.new_page(); d.on('pageerror', lambda e: errors.append(str(e)))
    d.goto(SERVER + '/'); time.sleep(1)
    ext = sw.url.rsplit('/', 1)[0]
    c = ctx.new_page(); c.goto(f'{ext}/connect.html'); time.sleep(.3)
    c.evaluate(f"chrome.runtime.sendMessage({{ cmd: 'connectServer', args: {{ origin: '{SERVER}' }} }})")
    d.wait_for_selector('#username', timeout=15000); d.bring_to_front()
    d.fill('#username', 'boss'); d.fill('#password', 'correct horse'); d.fill('#again', 'correct horse'); d.click('#go')
    d.wait_for_url('**/admin'); d.wait_for_selector('#users tr')
    check(d.locator('#users .tag.twofa').count() == 0, 'two-step sign-in: off until turned on')

    d.goto(SERVER + '/account'); d.wait_for_selector('#twofa button'); time.sleep(.5)
    d.bring_to_front()
    d.click('#twofa button'); d.wait_for_selector('.qr svg', timeout=5000); time.sleep(.5)
    d.click('.twofa-setup .btn:not(.primary)'); time.sleep(.5)
    check(d.is_hidden('.twofa-setup') and d.is_enabled('#twofa button'), 'cancelled: the setup folds away, Turn on back')
    d.click('#twofa button'); d.wait_for_selector('.qr svg:visible', timeout=5000); time.sleep(.5)
    box = d.locator('.qr').bounding_box(); svg = d.locator('.qr svg').bounding_box()
    check(abs(svg['width'] - box['width']) < 3 and abs(svg['height'] - box['height']) < 3, f"the QR code fills its box, nothing cut off ({svg['width']:.0f}x{svg['height']:.0f} in {box['width']:.0f})")
    secret = d.inner_text('.secret').replace(' ', '')
    check(d.is_visible('.qr svg') and len(secret) >= 32, 'turning it on: the QR code and its key')
    d.fill('.code-input', '000000'); d.click('.twofa-setup button[type=submit]'); time.sleep(.5)
    check('isn’t right' in d.inner_text('.twofa-setup .msg') or 'not right' in d.inner_text('.twofa-setup .msg'), f"a wrong code: it says so ({d.inner_text('.twofa-setup .msg')})")
    d.fill('.code-input', code_at(secret)); d.click('.twofa-setup button[type=submit]'); d.wait_for_selector('.code-grid code', timeout=5000); time.sleep(.5)
    codes = d.locator('.code-grid code').all_inner_texts()
    check(len(codes) == 10 and d.is_visible('#twofa .tag.accent'), 'the right code: on, ten recovery codes shown')

    d.goto(SERVER + '/account'); d.wait_for_selector('#twofa button'); d.evaluate("fetch('/api/logout', {method: 'POST'})"); time.sleep(.3)
    d.goto(SERVER + '/login'); d.wait_for_selector('#username:visible')
    d.fill('#username', 'boss'); d.fill('#password', 'correct horse'); d.click('#go')
    d.wait_for_selector('#code:visible', timeout=5000); time.sleep(.4)
    check(d.is_hidden('#password') and '2FA' in d.inner_text('#title'), 'signing in: after the password, the code')
    d.fill('#code', '111111'); d.click('#go'); time.sleep(.6)
    check(d.inner_text('#msg') != '' and d.url.endswith('/login'), f"a wrong code: not signed in ({d.inner_text('#msg')})")
    d.fill('#code', code_at(secret, 1)); d.click('#go')
    d.wait_for_url(SERVER + '/', timeout=10000)
    check(True, "the app's code: signed in")

    d.goto(SERVER + '/account'); d.wait_for_selector('#twofa button'); d.evaluate("fetch('/api/logout', {method: 'POST'})"); time.sleep(.3)
    d.goto(SERVER + '/login'); d.wait_for_selector('#username:visible')
    d.fill('#username', 'boss'); d.fill('#password', 'correct horse'); d.click('#go')
    d.wait_for_selector('#code:visible', timeout=5000)
    d.click('#use-recovery'); time.sleep(.3)
    check('recovery' in d.inner_text('#code-label').lower(), 'or a recovery code')
    d.fill('#code', codes[0]); d.click('#go')
    d.wait_for_url(SERVER + '/', timeout=10000)
    check(True, 'a recovery code: signed in')
    d.goto(SERVER + '/admin'); d.wait_for_selector('#users tr')
    check(d.locator('#users .tag.twofa').count() == 1, 'the admin list marks who has it on')
    # turning it off: as deleting the account, the phrase typed out and the password
    d.goto(SERVER + '/account'); d.bring_to_front(); d.wait_for_selector('#twofa .btn.danger'); time.sleep(.4)
    d.click('#twofa .btn.danger'); d.wait_for_selector('dialog.modal'); time.sleep(.3)
    go = 'dialog.modal button[type=submit]'
    d.fill('dialog.modal input[type=text]', '2FA'); d.fill('dialog.modal input[type=password]', 'correct horse')
    check(d.is_disabled(go), 'turning it off: not until the phrase is typed out')
    d.fill('dialog.modal input[type=text]', d.get_attribute('dialog.modal input[type=text]', 'placeholder')); time.sleep(.1)
    check(d.is_enabled(go), 'the phrase and the password: it can go')
    d.click(go); time.sleep(1)
    check(d.is_visible('#twofa .btn') and not d.locator('#twofa .tag.accent').count(), 'off again')
    check(not errors, f'no page errors {errors}')
    ctx.close()
srv.should_exit = True
done()
