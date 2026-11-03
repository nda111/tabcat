# tabcat-server in a browser, with the extension: not connected, its pages say how to connect; then the first
# account (an admin) is made on first visit; the
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
    d.goto(SERVER + '/'); d.wait_for_load_state('networkidle'); time.sleep(1)
    check(d.url.endswith('/setup') and not d.is_visible('#username') and 'connect to the server' in d.inner_text('#form'),
          f'not connected yet: the setup page says how to connect, not the form ({d.url})')
    ext = sw.url.rsplit('/', 1)[0]
    c = ctx.new_page(); c.goto(f'{ext}/connect.html'); time.sleep(.3)
    c.evaluate(f"chrome.runtime.sendMessage({{ cmd: 'connectServer', args: {{ origin: '{SERVER}' }} }})")
    d.wait_for_selector('#username', timeout=15000)
    check(d.url.endswith('/setup') and d.is_visible('#username'), f'connected (it loads again): make the first account ({d.url})')
    # the toolbar popup: no saving before the server is set up (and signed in); what to do instead
    def popup():
        pp = ctx.new_page(); pp.goto(sw.url.replace('background.js', 'popup.html'))
        try: pp.wait_for_selector('#server-card:visible, #save-card:visible', timeout=5000)  # (it asks the server first)
        except Exception: pass
        time.sleep(.4)
        out = (pp.is_visible('#server-card'), pp.inner_text('#server-card') if pp.is_visible('#server-card') else '', pp.is_visible('#save-card'), pp.is_visible('#suspend') or pp.is_visible('#open'))
        pp.close(); return out
    pop = popup()
    check(pop[0] and 'isn’t ready' in pop[1] and 'Set up' in pop[1] and not pop[2] and not pop[3], f'popup, server not set up: none of tabcat, set it up first {pop}')
    # the right-click menu's saving items: greyed out meanwhile, back once signed in (watched where the
    # extension sets them: the browser can't be asked)
    sw.evaluate("self.__menu = {}; const up = chrome.contextMenus.update.bind(chrome.contextMenus); chrome.contextMenus.update = (id, p, cb) => { if ('enabled' in p) __menu[id] = p.enabled; return up(id, p, cb); }; 0")
    d.reload(); d.wait_for_selector('#username'); time.sleep(1.5)
    menu = sw.evaluate('__menu')
    check(all(menu.get(k) is False for k in ('go-tabcat', 'save-tab', 'save-link', 'save-window', 'suspend', 'dedupe')), f'menu, server not set up: all of tabcat greyed out {menu}')
    bg = d.evaluate("getComputedStyle(document.querySelector('#go')).backgroundColor")
    check('300' in bg, f"in tabcat's own purple, with no look kept yet ({bg})")
    # the password's show button shows it and its repeat at once; again, both hidden; the slash draws in
    d.fill('#password', 'correct horse'); d.fill('#again', 'correct horse')
    d.bring_to_front()  # (a background tab's transitions don't run)
    eyes = d.locator('.pw-eye')
    check(eyes.count() == 2 and d.evaluate("getComputedStyle(document.querySelector('.pw-eye .slash')).strokeDashoffset") in ('0', '0px'), 'each password field has a show button, the eye slashed (hidden)')
    eyes.nth(1).click(); time.sleep(.4)
    shown = d.evaluate("[...document.querySelectorAll('.pw input')].map(i => i.type)")
    dash = d.evaluate("getComputedStyle(document.querySelector('.pw-eye .slash')).strokeDashoffset")
    check(shown == ['text', 'text'] and dash == '23px', f"one shows both; the eye unslashed, as the text now is ({shown}, {dash})")
    d.focus('#password'); d.keyboard.press('Tab')
    check(d.evaluate('document.activeElement.id') == 'again', f"Tab goes from the password on to its repeat, past the show button ({d.evaluate('document.activeElement.id')})")
    d.keyboard.press('Tab')  # (on to the button)
    ring = d.evaluate("(() => { const cs = getComputedStyle(document.activeElement); return [document.activeElement.id, cs.outlineStyle, cs.outlineWidth]; })()")
    check(ring[1] == 'solid' and ring[2] == '1px', f'a focused button: the thin accent ring, as on the dashboard ({ring})')
    eyes.nth(0).click(); time.sleep(.4)
    check(d.evaluate("[...document.querySelectorAll('.pw input')].map(i => i.type)") == ['password', 'password'], 'again: both hidden')
    d.fill('#username', 'boss'); d.fill('#name', 'The Boss'); d.click('#go')
    d.wait_for_url('**/admin'); d.wait_for_selector('#users tr')
    pop = popup()
    check(not pop[0] and pop[2] and pop[3], f'popup, signed in: all of it as ever {pop}')
    time.sleep(1)
    menu = sw.evaluate('__menu')
    check(all(menu.get(k) is True for k in ('go-tabcat', 'save-tab', 'suspend', 'dedupe')), f'menu, signed in: all of it back {menu}')
    check(d.locator('#users tr').count() == 1 and 'boss' in d.inner_text('#users'), 'the admin page lists it')
    d.fill('#add-name', 'kid'); d.fill('#add-pw', 'kidpass99'); d.click('#add-form button[type=submit]')
    d.wait_for_function("document.querySelectorAll('#users tr').length === 2", timeout=5000)
    check(d.locator('#users tr').count() == 2, 'and adds a user')
    d.locator('#signup input[value=invite]').check()
    d.wait_for_function("document.querySelector('#settings-msg').textContent", timeout=5000)
    check('Saved' in d.inner_text('#settings-msg'), 'sign-up is set to by invitation')
    d.click('#invite-form button[type=submit]'); d.wait_for_selector('#invites code', timeout=5000)
    check(d.locator('#invites code').count() == 1, 'an invitation is made')
    check('github' not in d.inner_text('#info').lower() and 'web' in d.inner_text('#info'), 'the server tells where its dashboard comes from')
    # the dashboard: linked up, the board; Settings has the account. (Going to its address in a tab, the
    # extension shows it in its own pinned tab, as on tabcat.ghyeok.com, and that tab goes back)
    with ctx.expect_page(lambda pg: pg.url.startswith(SERVER), timeout=15000) as opened:
        d.goto(SERVER + '/')
    dash = opened.value
    dash.on('pageerror', lambda e: errors.append(str(e)))
    dash.set_viewport_size({'width': 1300, 'height': 800})
    dash.wait_for_selector('.ws-item', timeout=15000); time.sleep(1)
    d = dash
    check(d.evaluate("document.querySelector('#no-ext').hidden"), 'connected: the board')
    check(d.is_visible('#btn-account') and d.get_attribute('#btn-account', 'title') == 'The Boss\nboss', "the sidebar's Account button, its tooltip saying who (the name, the username)")
    d.click('#ws-toggle'); time.sleep(.5)
    check(d.get_attribute('#btn-account', 'title') == 'The Boss\nboss', f"collapsed too: the name and username, not the word Account ({d.get_attribute('#btn-account', 'title')!r})")
    d.click('#ws-toggle'); time.sleep(.5)
    d.click('#btn-settings'); time.sleep(.4)
    check(not d.locator('#settings #account-name').count(), 'Settings has no account part any more')
    d.keyboard.press('Escape'); time.sleep(.3)
    d.click('#btn-account'); time.sleep(.5)
    check(d.is_visible('#account') and d.inner_text('#account-name') == 'The Boss' and d.inner_text('#account-role').startswith('boss') and d.is_visible('#account-admin'), 'the Account dialog shows the account (its name, then the username), and the admin page for an admin')
    # boss's look: dark, green (theirs only: see kid below)
    sw.evaluate("chrome.storage.local.get('tabcat:settings').then(r => chrome.storage.local.set({'tabcat:settings': {...r['tabcat:settings'], theme: 'dark', accent: 'green'}}))"); time.sleep(.3)
    # something of boss's: theirs only
    sw.evaluate("chrome.storage.local.get('tabcat').then(r=>{const s=r.tabcat; s.workspaces.push({id:'bossws',type:'workspace',name:'BossOnly',symbol:'',description:'',categories:[{id:'bossc',type:'category',name:'C',groups:[]}]}); return chrome.storage.local.set({tabcat:s})})")
    time.sleep(.6)
    d.keyboard.press('Escape'); time.sleep(.3)
    # signed out: the dashboard asks to sign in again
    d.evaluate("fetch('/api/logout', { method: 'POST' })"); time.sleep(.3)
    d.reload(); d.wait_for_url('**/login'); d.wait_for_selector('#username', timeout=10000)
    check(d.url.endswith('/login'), f'signed out, the dashboard asks to sign in ({d.url})')
    pop = popup()
    check(pop[0] and 'Sign in' in pop[1] and not pop[2] and not pop[3], f'popup, signed out: none of tabcat, sign in first {pop}')
    with ctx.expect_page(lambda pg: pg.url.endswith('/login'), timeout=10000):
        res = c.evaluate("chrome.runtime.sendMessage({ cmd: 'saveTabs', args: { tabs: [{ url: 'https://example.com/', title: 'x' }] } })")
    check(res.get('result') is None, f'saving anyway (a shortcut, the menu): not saved, the sign-in page opens ({res})')
    d.fill('#username', 'kid'); d.fill('#password', 'kidpass99'); d.click('#go'); d.wait_for_url(SERVER + '/'); d.wait_for_selector('.ws-item', timeout=15000)
    d.click('#btn-account'); d.wait_for_function("document.querySelector('#account-name').textContent === 'kid'", timeout=5000)
    check(d.inner_text('#account-name') == 'kid' and not d.is_visible('#account-admin'), 'a user signs in: no admin page for them')
    look = sw.evaluate("chrome.storage.local.get('tabcat:settings').then(r => [r['tabcat:settings'].theme, r['tabcat:settings'].accent])")
    check(look == ['auto', 'purple'], f"each account has its own look: kid, who never set one, gets the defaults ({look})")
    names = lambda: d.evaluate("[...document.querySelectorAll('.ws-item')].map(e => e.title)")
    check('BossOnly' not in names(), f"each account has its own data: kid doesn't see boss's ({names()})")
    d.keyboard.press('Escape'); time.sleep(.3)
    d.evaluate("fetch('/api/logout', { method: 'POST' })"); time.sleep(.3)
    d.reload(); d.wait_for_selector('#username', timeout=10000)
    d.fill('#username', 'boss'); d.fill('#password', 'correct horse'); d.click('#go'); d.wait_for_url(SERVER + '/'); d.wait_for_selector('.ws-item', timeout=15000); time.sleep(.5)
    check('BossOnly' in names(), f"and boss's is back for boss ({names()})")
    look = sw.evaluate("chrome.storage.local.get('tabcat:settings').then(r => [r['tabcat:settings'].theme, r['tabcat:settings'].accent])")
    check(look == ['dark', 'green'] and d.evaluate("document.documentElement.dataset.theme") == 'dark', f"and boss's look with it ({look})")
    check(not errors, f'no page errors {errors}')
    ctx.close()
srv.should_exit = True
done()
