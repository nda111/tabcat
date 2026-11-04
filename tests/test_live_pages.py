# The server's own pages kept up to date at once: the account page shows what changed elsewhere (its name,
# a new sign-in among the devices), the admin page what another admin did (a new account), without reloading.
# (Needs fastapi and uvicorn: pip install fastapi uvicorn)
import os, sys, tempfile, threading
from harness import *
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server'))
import uvicorn
from tabcat_server import config as C
from tabcat_server.app import create_app

PORT = 8773
SERVER = f'http://127.0.0.1:{PORT}'
srv = uvicorn.Server(uvicorn.Config(create_app(C.load(tempfile.mkdtemp())), host='127.0.0.1', port=PORT, log_level='warning'))
threading.Thread(target=srv.run, daemon=True).start()
while not srv.started: time.sleep(.05)

def call(pg, method, path, body=None):
    return pg.evaluate("([m, p, b]) => fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(r => r.status)", [method, path, body])
def soon(pg, js, timeout=4000):
    try: pg.wait_for_function(js, timeout=timeout); return True
    except Exception: return False

errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    one, two = b.new_context(), b.new_context()  # (two browsers, the same account)
    a = one.new_page(); a.on('pageerror', lambda e: errors.append(str(e)))
    a.goto(SERVER + '/setup'); call(a, 'POST', '/api/setup', {'username': 'boss', 'password': 'correct horse'})
    o = two.new_page(); o.goto(SERVER + '/login'); call(o, 'POST', '/api/login', {'username': 'boss', 'password': 'correct horse'})

    a.goto(SERVER + '/account'); a.wait_for_selector('#devices .device'); time.sleep(1)
    devices = a.locator('#devices .device').count()
    call(o, 'PUT', '/api/me/name', {'name': 'Big Boss'})
    check(soon(a, "document.querySelector('#name-view').textContent === 'Big Boss'"), 'the name changed in another browser: the account page shows it at once')
    t3 = b.new_context(); x = t3.new_page(); x.goto(SERVER + '/login'); call(x, 'POST', '/api/login', {'username': 'boss', 'password': 'correct horse'})
    check(soon(a, f"document.querySelectorAll('#devices .device').length === {devices + 1}"), 'signed in on another device: it joins the list')
    check(soon(a, "document.querySelector('#my-events').textContent.length > 0 && [...document.querySelectorAll('#my-events .event')].reduce((n, e) => n + e.dataset.key.split('-').length, 0) >= 3"), 'and the recent security activity')
    check(a.is_visible('#ev-act') and a.is_visible('#ev-pw') and a.is_visible('#ev-others'), 'under it: not you? change the password, sign out of other devices')
    a.click('#ev-pw'); check(until(lambda: a.evaluate("document.activeElement.id") == 'current'), 'change the password: to its form, the current one to type')

    a.goto(SERVER + '/admin'); a.wait_for_selector('#users tr'); time.sleep(1)
    call(o, 'POST', '/api/admin/users', {'username': 'newbie', 'password': 'newbiepass9'})
    check(soon(a, "document.querySelector('#users').textContent.includes('newbie')"), "another admin adds an account: the admin page shows it at once")

    # signed out from elsewhere: the page goes to sign in
    a.goto(SERVER + '/account'); a.wait_for_selector('#devices .device'); time.sleep(1)
    call(o, 'POST', '/api/me/logout-others')
    check(soon(a, "location.pathname === '/login'", 8000), 'signed out from another browser: the account page goes to sign in')
    check(not errors, f'no page errors {errors}')
    b.close()
srv.should_exit = True
done()
