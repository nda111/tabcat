"""The server's API, without a browser: first account, signing in, accounts, sign-up modes, invitations,
the admin's limits, and the dashboard behind the sign-in. Run: python tests/test_api.py"""
import os, sys, tempfile
os.environ.setdefault('TABCAT_NO_UPDATES', '1'); os.environ.setdefault('TABCAT_NO_DIALOG', '1'); os.environ.setdefault('TABCAT_NO_TAILSCALE', '1')
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from fastapi.testclient import TestClient
from tabcat_server import config as C
from tabcat_server.app import create_app

WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'web')
failed = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg, flush=True)
    if not cond: failed.append(msg)

app = create_app(C.load(tempfile.mkdtemp(), dashboard=WEB))
c = TestClient(app, follow_redirects=False, client=('127.0.0.1', 50000))  # (on the server's own computer)
remote = TestClient(app, follow_redirects=False, client=('203.0.113.9', 50000))

# setting it up: only from the server's own computer (a forwarded address from elsewhere counts for nothing)
check(b'setupHereTitle' in remote.get('/setup').content, 'from elsewhere, /setup says the server is not set up yet')
check(remote.post('/api/setup', json={'username': 'evil', 'password': '12345678'}, headers={'X-Forwarded-For': '127.0.0.1'}).status_code == 403, 'and refuses it there, a forged X-Forwarded-For too')
J = lambda **kw: kw

# no account yet: the dashboard sends you to make the first one
check(c.get('/').headers.get('location') == '/setup', 'no account yet: / goes to /setup')
check(c.get('/manifest.webmanifest').json()['name'] == 'tabcat', "the dashboard's manifest is public (the extension looks at it)")
check(c.get('/api/server').json()['setup'] is True, '/api/server says it needs setting up')
check(c.post('/api/setup', data='x').status_code == 415, 'the API takes JSON only')
check(c.post('/api/setup', json=J(username='a', password='12345678')).status_code == 400, 'a one-letter username is refused')
r = c.post('/api/setup', json=J(username='boss', password='correct horse'))
check(r.status_code == 200 and 'tabcat_session' in r.cookies, 'the first account is made, and signed in')
check('httponly' in r.headers['set-cookie'].lower() and 'samesite=lax' in r.headers['set-cookie'].lower(), '(its cookie: HttpOnly, SameSite=Lax)')
check(c.get('/api/me').json()['admin'] is True, 'it is an admin')
check(c.post('/api/setup', json=J(username='x2', password='12345678')).status_code == 409, 'a second "first" account is refused')
check(c.get('/').status_code == 200 and b'<title>tabcat</title>' in c.get('/').content, 'signed in: the dashboard')
check(c.get('/admin').status_code == 200, 'and the admin page')

# accounts
r = c.post('/api/admin/users', json=J(username='kid', password='kidpass99'))
check(r.status_code == 200 and r.json()['admin'] is False, 'an admin adds a user')
kid = r.json()['id']
check(c.post('/api/admin/users', json=J(username='KID', password='kidpass99')).status_code == 409, 'usernames are unique, whatever the case')
boss = c.get('/api/me').json()['id']
check(c.patch(f'/api/admin/users/{boss}', json=J(admin=False)).status_code == 409, 'the last admin stays an admin')
check(c.delete(f'/api/admin/users/{boss}').status_code == 409, "you can't delete yourself")
check(c.patch(f'/api/admin/users/{boss}', json=J(password='random-one-1')).status_code == 409 and c.get('/api/me').status_code == 200, 'an admin can’t reset their own password there (it signed them out): their account page changes it')

# signing in as someone else
k = TestClient(app, follow_redirects=False, client=('127.0.0.1', 50001))
check(k.get('/').headers.get('location') == '/login', 'signed out: / goes to /login')
check(k.post('/api/login', json=J(username='kid', password='wrong one')).status_code == 401, 'a wrong password is refused')
check(k.post('/api/login', json=J(username='kid', password='kidpass99')).status_code == 200, 'the right one signs in')
check(k.get('/api/admin/users').status_code == 403 and k.get('/admin').headers.get('location') == '/', "a user can't use the admin page")
c.patch(f'/api/admin/users/{kid}', json=J(disabled=True))
check(k.get('/api/me').status_code == 401, 'turned off: signed out at once')
check(k.post('/api/login', json=J(username='kid', password='kidpass99')).status_code == 403, 'and can’t sign in')
c.patch(f'/api/admin/users/{kid}', json=J(disabled=False, password='newpass123'))
check(k.post('/api/login', json=J(username='kid', password='newpass123')).status_code == 200, 'turned on with a new password: signs in with it')
check(k.post('/api/me/password', json={'current': 'newpass123', 'new': 'mine-now-1'}).status_code == 200, 'a user changes their password')

# sign-up modes and invitations
n = TestClient(app, follow_redirects=False, client=('127.0.0.1', 50002))
check(n.post('/api/signup', json=J(username='new1', password='12345678')).status_code == 403, 'sign-up closed: refused')
c.put('/api/admin/settings', json=J(signup='open'))
check(n.post('/api/signup', json=J(username='new1', password='12345678')).status_code == 200, 'open: anyone signs up')
c.put('/api/admin/settings', json=J(signup='invite'))
c.put('/api/admin/settings', json=J(signup='closed'))
code0 = c.post('/api/admin/invites', json=J(days=7)).json()['code']
n0 = TestClient(app, follow_redirects=False, client=('127.0.0.1', 50002))
check(n0.post('/api/signup', json=J(username='sneak', password='12345678', invite=code0)).status_code == 403, 'closed: an invitation link does not work either')
c.put('/api/admin/settings', json=J(signup='invite'))
n2 = TestClient(app, follow_redirects=False, client=('127.0.0.1', 50002))
check(n2.post('/api/signup', json=J(username='new2', password='12345678')).status_code == 403, 'by invitation: none, refused')
code = c.post('/api/admin/invites', json=J(days=7)).json()['code']
r = n2.post('/api/signup', json=J(username='new2', password='12345678', invite=code))
check(r.status_code == 200 and 'set-cookie' not in r.headers and n2.get('/api/me').status_code == 401, 'with one, signs up (not signed in: the sign-in page follows)')
n2.post('/api/login', json=J(username='new2', password='12345678'))
space2 = n2.get('/api/me').json()['space']
n3 = TestClient(app, follow_redirects=False, client=('127.0.0.1', 50002))
check(n3.post('/api/signup', json=J(username='new3', password='12345678', invite=code)).status_code == 403, 'an invitation is used once')
check('new2' in [i['used_by'] for i in c.get('/api/admin/invites').json()], 'the admin sees who used it')

# deleting your own account (the last admin can't)
check(n2.request('DELETE', '/api/me', json={'confirm': True}).status_code == 200 and n2.get('/api/me').status_code == 401, 'a user deletes their own account, and is signed out')
check(n2.post('/api/login', json=J(username='new2', password='12345678')).status_code == 401, 'it is gone')
c.put('/api/admin/settings', json=J(signup='open'))
n4 = TestClient(app, follow_redirects=False, client=('127.0.0.1', 50007))
n4.post('/api/signup', json=J(username='new2', password='12345678')); n4.post('/api/login', json=J(username='new2', password='12345678'))
me4 = n4.get('/api/me').json()
check(me4['space'] != space2 and len(me4['space']) == 24, f'made again under the same name: a data key of its own, not the deleted one\'s ({space2} → {me4["space"]})')
c.put('/api/admin/settings', json=J(signup='invite'))
# accounts from before the data keys keep their id as theirs (their data stays where it was)
import sqlite3, pathlib
old_dir = pathlib.Path(tempfile.mkdtemp())
con = sqlite3.connect(old_dir / 'tabcat.db')
con.executescript("create table users (id integer primary key, username text not null unique collate nocase, password text not null, admin integer not null default 0, disabled integer not null default 0, created_at real not null, last_seen real); insert into users (username, password, admin, created_at) values ('old', 'x', 1, 0);")
con.commit(); con.close()
from tabcat_server.db import DB
check(DB(old_dir / 'tabcat.db').one("select space from users where username = 'old'")['space'] == '1', 'an account from before keeps its id as its data key')
check(c.request('DELETE', '/api/me', json={'confirm': True}).status_code == 409, 'the last admin can’t delete themselves')

# throttling
t = TestClient(app, follow_redirects=False, client=('127.0.0.1', 50002))
codes = [t.post('/api/login', json=J(username='boss', password='nope nope')).status_code for _ in range(9)]
check(codes[-1] == 429, f'many wrong passwords: it waits ({codes[-2:]})')

# security settings: the login limit as set; staying signed in off; signing everyone out
check(c.put('/api/admin/settings', json=J(login_tries=2)).status_code == 400 and c.put('/api/admin/settings', json=J(session_days=-1)).status_code == 400, 'settings out of range are refused')
check(c.put('/api/admin/settings', json=J(login_tries=3, login_lock_minutes=5)).json()['login_tries'] == 3, 'the login limit is set')
t3 = TestClient(app, follow_redirects=False, client=('192.0.2.5', 1))
codes = [t3.post('/api/login', json=J(username='boss', password='nope nope')).status_code for _ in range(4)]
check(codes == [401, 401, 401, 429], f'…and counts: three wrong, then a wait ({codes})')
c.put('/api/admin/settings', json=J(session_days=0))
s0 = TestClient(app, follow_redirects=False, client=('192.0.2.6', 1))
cookie = s0.post('/api/login', json=J(username='kid', password='mine-now-1')).headers['set-cookie'].lower()
check('max-age' not in cookie and 'expires' not in cookie and s0.get('/api/me').status_code == 200, 'staying signed in off: a cookie for as long as the browser is open')
c.put('/api/admin/settings', json=J(session_days=30))
check(c.get('/api/admin/info').json()['sessions'] >= 2 and c.get('/api/admin/info').json()['setup_from'] == ['127.0.0.1/32', '::1/128'], 'info tells the sessions and the addresses set at start')
check(c.post('/api/admin/logout-all').status_code == 200 and s0.get('/api/me').status_code == 401 and c.get('/api/me').status_code == 200, 'signing everyone out: all but you')

# the admin page from an address it isn't open to
app2 = create_app(C.load(tempfile.mkdtemp(), dashboard=WEB, admin_from='10.0.0.0/8'))
a2 = TestClient(app2, follow_redirects=False, client=('127.0.0.1', 50003))
a2.post('/api/setup', json=J(username='root', password='12345678'))
check(a2.get('/api/admin/users').status_code == 403 and b'adminHereTitle' in a2.get('/admin').content, 'admin_from: from elsewhere, no admin page')
a3 = TestClient(app2, follow_redirects=False, client=('10.1.2.3', 50004))
a3.post('/api/login', json=J(username='root', password='12345678'))
check(a3.get('/api/admin/users').status_code == 200, 'and from an address it is open to, the admin page')

# attacks: SQL in what's sent changes nothing; big bodies and floods are turned away; framing refused
check(t.post('/api/login', json=J(username="boss' OR '1'='1' --", password="x' OR '1'='1")).status_code in (401, 429), 'SQL in a username or password signs no one in')
check(c.get('/api/username', params={'name': "x' OR 1=1 --"}).json() == {'valid': False, 'free': False}, '…nor reads anything')
check(c.post('/api/admin/users', content=b'{"username": "' + b'a' * 70000 + b'"}', headers={'Content-Type': 'application/json'}).status_code == 413, 'a body over 64 KB is turned away')
r = c.get('/login')
check(r.headers.get('x-frame-options') == 'DENY' and r.headers.get('x-content-type-options') == 'nosniff', 'pages may not be framed by other sites, nor their types guessed')
flood = TestClient(create_app(C.load(tempfile.mkdtemp(), dashboard=WEB)), follow_redirects=False, client=('198.51.100.7', 1))
codes = [flood.get('/api/server').status_code for _ in range(245)]
check(codes.count(429) >= 5 and codes[0] == 200, f'a flood from one address is turned away after 240 calls a minute ({codes.count(429)} refused)')
fl = [e for e in flood.app.state.db.q("select * from events where kind = 'rate_limited'")]
check(len(fl) == 1 and fl[0]['ip'] == '198.51.100.7', f'and kept in the security record once (not once a call): {len(fl)}')
check(c.get('/api/username', params={'name': 'boss'}).json() == {'valid': True, 'free': False} and c.get('/api/username', params={'name': 'nobody9'}).json()['free'] is True, 'the username check: taken, or free')

# moving the database: only on the server's own computer; nothing may be there already; kept for the next start
a3.post('/api/login', json=J(username='root', password='12345678'))
check(a3.post('/api/admin/database', json={'path': tempfile.mkdtemp()}).status_code == 403, 'moving the database from another computer: refused')
info0 = c.get('/api/admin/info').json()
check(info0['here'] is True and info0['db_path'].endswith('tabcat.db'), 'info tells where the database is, and that this is the server computer')
check(c.post('/api/admin/database', json={'path': 'relative/place'}).status_code == 400, 'a relative path: refused')
taken = tempfile.mkdtemp(); open(os.path.join(taken, 'tabcat.db'), 'w').close()
check(c.post('/api/admin/database', json={'path': taken}).status_code == 409, 'a file there already: refused')
dest_dir = tempfile.mkdtemp()
r = c.post('/api/admin/database', json={'path': dest_dir})
moved = os.path.join(os.path.realpath(dest_dir), 'tabcat.db')
check(r.status_code == 200 and r.json()['db_path'] == moved and os.path.exists(moved) and not os.path.exists(info0['db_path']), f'moved to a folder: tabcat.db there, the old file gone ({r.json()})')
check(c.get('/api/me').status_code == 200 and c.get('/api/admin/users').status_code == 200, 'and the server goes on with it, signed in as before')
check(C.load(app.state.config.data_dir).db_path == pathlib.Path(moved), 'the next start finds it there (config.toml)')

# the Save dialog on the server's computer (stood in for here): its path, or none there (501: the page asks for one)
from tabcat_server import dialogs
dialogs.save_file = lambda title, start: '/picked/tabcat.db'
check(c.post('/api/admin/database/pick', json={'title': 'x'}).json() == {'path': '/picked/tabcat.db'}, 'picking a place: the dialog’s path')
dialogs.save_file = lambda title, start: False
check(c.post('/api/admin/database/pick', json={}).status_code == 501, 'no dialog on the server computer: 501')
check(a3.post('/api/admin/database/pick', json={}).status_code == 403, 'and from elsewhere: refused')

# profile photos: a small image as a data: URL; shown to who's signed in; removed again
PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
check(c.put('/api/me/avatar', json={'image': 'data:text/html;base64,PHNjcmlwdD4='}).status_code == 400 and c.put('/api/me/avatar', json={'image': 'data:image/png;base64,' + 'A' * 70000}).status_code in (400, 413), 'a profile photo that is not a small image: refused')
r = c.put('/api/me/avatar', json={'image': PNG})
url = r.json()['avatar']
check(r.status_code == 200 and url.startswith('/api/users/') and c.get(url).headers['content-type'] == 'image/png' and c.get(url).content[:4] == b'\x89PNG', f'a photo is set and served as an image ({url})')
check(TestClient(app, client=('192.0.2.9', 1)).get(url).status_code == 401, 'not to anyone signed out')
check(c.delete('/api/me/avatar').json()['avatar'] is None and c.get(url).status_code == 404, 'removed: gone')

# several accounts in one browser: signing in again adds one; switching; signing out goes to the next
m = TestClient(app, follow_redirects=False, client=('192.0.2.20', 1))
c.post('/api/admin/users', json=J(username='ann', password='annpass99')); c.post('/api/admin/users', json=J(username='ben', password='benpass99'))
m.post('/api/login', json=J(username='ann', password='annpass99'))
m.post('/api/login', json=J(username='ben', password='benpass99'))
acc = m.get('/api/accounts').json()['accounts']
check([a['username'] for a in acc] == ['ben', 'ann'] and acc[0]['current'] and not acc[1]['current'], f'signed in twice: both accounts, the newest in use ({[a["username"] for a in acc]})')
m.post('/api/login', json=J(username='ann', password='annpass99'))
check([a['username'] for a in m.get('/api/accounts').json()['accounts']] == ['ann', 'ben'] and m.get('/api/accounts').json()['max'] == 5, 'the same one again: still one each, it in use')
ann_id = next(a['id'] for a in acc if a['username'] == 'ann'); ben_id = next(a['id'] for a in acc if a['username'] == 'ben')
check(m.post('/api/accounts/switch', json={'id': ben_id}).status_code == 200 and m.get('/api/me').json()['username'] == 'ben', 'switching: ben in use')
check(m.post('/api/accounts/switch', json={'id': 99999}).status_code == 404, 'an account not signed in here: no switching to it')
c.post('/api/admin/users', json=J(username='cal', password='calpass99'))
m.post('/api/login', json=J(username='cal', password='calpass99'))
cal_id = m.get('/api/me').json()['id']
check(m.post('/api/accounts/logout', json={'id': ann_id}).status_code == 200 and [a['username'] for a in m.get('/api/accounts').json()['accounts']] == ['cal', 'ben'], 'signing out of another account: it goes, the one in use stays')
m.post('/api/accounts/switch', json={'id': ben_id}); m.post('/api/accounts/logout', json={'id': cal_id})
m.post('/api/login', json=J(username='ann', password='annpass99')); m.post('/api/accounts/switch', json={'id': ben_id})
r = m.post('/api/logout')
check(r.json()['next'] == 'ann' and m.get('/api/me').json()['username'] == 'ann', 'signing out of ben: ann takes over')
check(m.post('/api/logout').json()['next'] is None and m.get('/api/me').status_code == 401, 'and signing out of ann: signed out')

# the account in use gone (its sign-in ended): another signed in here takes over; at the limit, the sign-in
# page can sign out of any of them (no account in use needed)
x = TestClient(app, follow_redirects=False, client=('192.0.2.30', 1))
x.post('/api/login', json=J(username='ben', password='benpass99')); x.post('/api/login', json=J(username='ann', password='annpass99'))
import sqlite3 as _sq
db_ = app.state.db
from tabcat_server import auth as _auth
db_.run('delete from sessions where token = ?', _auth.token_hash(x.cookies.get('tabcat_session')))
r = x.get('/')
check(r.status_code in (302, 307) and r.headers['location'] == '/?switched=1', f'ann’s sign-in ended: the dashboard goes on as ben, saying so ({r.headers.get("location")})')
check(x.get('/api/me').json()['username'] == 'ben', 'ben in use now')
db_.run('delete from sessions where token = ?', _auth.token_hash(x.cookies.get('tabcat_session')))
check(x.get('/api/me').status_code == 401, 'and none left: signed out')
y = TestClient(app, follow_redirects=False, client=('192.0.2.31', 1))
y.post('/api/login', json=J(username='ben', password='benpass99')); y.post('/api/login', json=J(username='ann', password='annpass99'))
here = y.get('/api/accounts/here').json()
check(sorted(a['username'] for a in here['accounts']) == ['ann', 'ben'] and here['max'] == 5, 'the sign-in page sees the accounts signed in here')
check(y.post('/api/accounts/logout', json={'id': ben_id}).status_code == 200 and [a['username'] for a in y.get('/api/accounts/here').json()['accounts']] == ['ann'], 'and signs out of one of them')

# a name to go by, beside the username
check(c.put('/api/me/name', json={'name': '  The   Boss '}).json()['name'] == 'The Boss', 'a name is set (its spaces tidied)')
check(c.put('/api/me/name', json={'name': 'x' * 41}).status_code == 400, 'too long: refused')
check(c.put('/api/me/name', json={'name': ''}).json()['name'] == '', 'and cleared again')
r = c.post('/api/admin/users', json=J(username='named1', password='named1pass', name='Named One'))
check(r.json()['name'] == 'Named One', 'an admin adds a user with a name')

# where this account is signed in: each device, its address, since when; signing out of one from here
d1 = TestClient(app, follow_redirects=False, client=('192.0.2.40', 1), headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36'})
d2 = TestClient(app, follow_redirects=False, client=('192.0.2.41', 1), headers={'User-Agent': 'Mozilla/5.0 (iPhone) Version/18 Mobile Safari/604.1'})
d1.post('/api/login', json=J(username='ann', password='annpass99')); d2.post('/api/login', json=J(username='ann', password='annpass99'))
ss = d1.get('/api/me/sessions').json()
mine = [x for x in ss if x['current']]
other = next(x for x in ss if x['ip'] == '192.0.2.41')
check(len(mine) == 1 and mine[0]['ip'] == '192.0.2.40' and 'Windows' in mine[0]['agent'] and other['created_at'] > 0, f'the sessions: this one, the other device, with their addresses ({len(ss)})')
check(d1.delete(f"/api/me/sessions/{mine[0]['id']}").status_code == 400, 'this one is signed out of by signing out, not from the list')
check(d1.delete(f"/api/me/sessions/{other['id']}").status_code == 200 and d2.get('/api/me').status_code == 401, 'the other device signed out of from here')
check(d1.get('/api/me').status_code == 200, 'this one still signed in')
n_before = len(d1.get('/api/me/sessions').json())
d1.post('/api/login', json=J(username='ann', password='annpass99'))
check(len(d1.get('/api/me/sessions').json()) == n_before, 'signing in again in the same browser: still one sign-in for it, not another device')

# ended sign-ins are cleared away (on each new one), not kept for ever
app.state.db.run("insert into sessions (token, user_id, created_at, expires_at) values ('oldone', ?, 0, 1)", boss)
TestClient(app, client=('192.0.2.50', 1)).post('/api/login', json=J(username='ann', password='annpass99'))
check(app.state.db.one("select count(*) n from sessions where token = 'oldone'")['n'] == 0, 'an ended sign-in is cleared away when another is made')

# two-step sign-in: optional, per account
from tabcat_server import totp as T2
import time as _t
z = TestClient(app, follow_redirects=False, client=('192.0.2.60', 1))
c.post('/api/admin/users', json=J(username='zed', password='zedpass99'))
z.post('/api/login', json=J(username='zed', password='zedpass99'))
check(z.get('/api/me').json()['twofa'] is False, 'two-step sign-in: off unless turned on')
st = z.post('/api/me/2fa/start').json()
check(st['uri'].startswith('otpauth://totp/') and '<svg' in st['qr'], 'turning it on: a secret, its link and QR code')
check(z.post('/api/me/2fa/confirm', json={'code': '000000'}).status_code == 400, 'a wrong code: not on')
now = int(_t.time()) // 30
rc = z.post('/api/me/2fa/confirm', json={'code': T2._code(st['secret'], now)}).json()['recovery']
check(len(rc) == 10 and z.get('/api/me').json()['twofa'] is True, 'the right code: on, with ten recovery codes')
z.post('/api/logout')
r = z.post('/api/login', json=J(username='zed', password='zedpass99'))
check(r.json().get('need') == 'code' and 'set-cookie' not in r.headers, 'signing in: the password alone is not enough')
tk = r.json()['ticket']
check(z.post('/api/login/code', json={'ticket': tk, 'code': T2._code(st['secret'], now)}).status_code == 401, 'a code already used: refused')
check(z.post('/api/login/code', json={'ticket': tk, 'code': T2._code(st['secret'], now + 1)}).status_code == 200 and z.get('/api/me').json()['username'] == 'zed', 'the next code: signed in')
z.post('/api/logout')
tk = z.post('/api/login', json=J(username='zed', password='zedpass99')).json()['ticket']
check(z.post('/api/login/code', json={'ticket': tk, 'code': rc[0].upper()}).status_code == 200, 'a recovery code signs in too')
z.post('/api/logout')
tk = z.post('/api/login', json=J(username='zed', password='zedpass99')).json()['ticket']
check(z.post('/api/login/code', json={'ticket': tk, 'code': rc[0]}).status_code == 401, 'but only once')
check(z.post('/api/login/code', json={'ticket': 'made-up', 'code': rc[1]}).status_code == 401, 'no ticket: no signing in')
z.post('/api/login/code', json={'ticket': tk, 'code': rc[1]})
check(z.post('/api/me/2fa/off', json={'password': 'nope'}).status_code == 403, 'turning it off needs the password')
check(len(z.post('/api/me/2fa/recovery', json={'password': 'zedpass99'}).json()['recovery']) == 10, 'new recovery codes (with the password)')
zid = z.get('/api/me').json()['id']
c.patch(f'/api/admin/users/{zid}', json={'twofa': False})
check(z.get('/api/me').json()['twofa'] is False, 'an admin turns it off for someone locked out')

# keeping up to date: the dashboard by itself (a setting), the server told of newer releases
check(c.get('/api/admin/settings').json()['dashboard_auto'] is True and c.put('/api/admin/settings', json={'dashboard_auto': False}).json()['dashboard_auto'] is False, 'the dashboard updates itself unless turned off')
from tabcat_server import updates as U
U._cache.update(release='v9.9.9', checked=10**12)
rel = c.get('/api/admin/info').json()['release']
check(rel['latest'] == 'v9.9.9' and rel['newer'] is True and rel['install'] in ('pip', 'checkout', 'docker'), f'info says a newer release is out, and how this server was installed ({rel})')
check(U.newer('v1.1.0') and not U.newer('v1.0.9'), '1.1.0.dev0 is before 1.1.0, after 1.0.9')
check(c.post('/api/admin/server/update').status_code in (409, 502) and a3.post('/api/admin/server/update').status_code == 403, 'updating the server: only on its computer, and not a working copy (this one)')

# "stay signed in" unticked: a cookie for as long as the browser's open, a day at most on the server
k1 = TestClient(app, follow_redirects=False, client=('192.0.2.70', 1))
r = k1.post('/api/login', json=J(username='ann', password='annpass99', keep=False))
sc = r.headers.get('set-cookie', '').lower()
check(r.status_code == 200 and 'tabcat_session=' in sc and 'max-age' not in sc.split('tabcat_session=')[1].split(',')[0], 'not staying signed in: the sign-in cookie lasts as long as the browser')
row = app.state.db.one('select expires_at - created_at d from sessions order by created_at desc limit 1')
check(row['d'] <= 86400 + 1, 'and a day at most on the server')
check(c.get('/api/server').json()['keep'] is True, 'the sign-in page is told it may offer staying signed in')

# Tailscale on the server's computer (none here: the tests don't touch it); serving only from there
check(c.get('/api/admin/tailscale').json() == {'installed': False, 'here': True}, 'Tailscale: what the server computer has (none here)')
from tabcat_server import tailscale as TS
calls = []
TS.serve = lambda on, port: calls.append((on, port)); TS.status = lambda port: {'installed': True, 'serving': bool(calls and calls[-1][0])}
check(c.post('/api/admin/tailscale/serve', json={'on': True}).json()['serving'] is True and calls[-1][0] is True, 'serving at its HTTPS address, turned on')
check(a3.post('/api/admin/tailscale/serve', json={'on': False}).status_code == 403, 'and only from the server computer')
def _needs(on, port): raise TS.NeedsEnabling('https://login.tailscale.com/admin/dns')
TS.serve = _needs
r = c.post('/api/admin/tailscale/serve', json={'on': True})
check(r.status_code == 409 and r.json()['enable'].endswith('/admin/dns'), 'the tailnet’s HTTPS off: it says where to turn it on')

# the security record: sign-ins and failures, changes, an admin's doings; each account sees its own
e1 = TestClient(app, follow_redirects=False, client=('192.0.2.80', 1), headers={'User-Agent': 'TestAgent/1'})
e1.post('/api/login', json=J(username='ann', password='nope nope'))
e1.post('/api/login', json=J(username='ghost', password='nope nope'))
e1.post('/api/login', json=J(username='ann', password='annpass99'))
ev = c.get('/api/admin/events').json()
kinds = [(e['kind'], e['username'], e['tried']) for e in ev['events'][:3]]
check(kinds == [('login_ok', 'ann', None), ('login_fail', None, 'ghost'), ('login_fail', 'ann', 'ann')] and ev['events'][0]['ip'] == '192.0.2.80' and ev['events'][0]['agent'] == 'TestAgent/1', f'signing in and failing are kept, with where from ({kinds})')
check(any(f['ip'] == '192.0.2.80' and f['count'] >= 2 for f in ev['failures_24h']), 'failures in the last day, by address')
ann_ev = c.get('/api/admin/events', params={'user': ann_id}).json()['events']
check(ann_ev and all(e['user_id'] == ann_id for e in ann_ev), "one account's record only")
c.patch(f'/api/admin/users/{ann_id}', json={'disabled': True}); c.patch(f'/api/admin/users/{ann_id}', json={'disabled': False})
top = c.get('/api/admin/events').json()['events'][:2]
check([e['kind'] for e in top] == ['unsuspended', 'suspended'] and top[0]['actor'] == 'boss', "an admin's doings, and whose")
mine = e1.post('/api/login', json=J(username='ann', password='annpass99')) and e1.get('/api/me/events').json()
check(mine and all(e['user_id'] == ann_id for e in mine) and mine[0]['kind'] == 'login_ok', 'each account sees its own record')
# guessing the current password (a session borrowed): counted as failed sign-ins, held off as they are
gs = TestClient(app, follow_redirects=False, client=('192.0.2.81', 1))
gs.post('/api/login', json=J(username='ben', password='benpass99'))
codes = [gs.post('/api/me/password', json={'current': f'guess{i}xx', 'new': 'whatever99'}).status_code for i in range(6)]
n = c.get('/api/admin/settings').json()['login_tries']
check(codes[:n] == [403] * n and set(codes[n:]) == {429}, f'guessing the current password: held off after as many as signing in allows ({n}: {codes})')
check(c.get('/api/admin/events', params={'user': ben_id}).json()['events'][0]['kind'] == 'password_wrong', 'and kept in the record')
check(c.put('/api/admin/settings', json={'log_days': 3}).status_code == 400 and c.put('/api/admin/settings', json={'log_days': 30}).json()['log_days'] == 30, 'kept 7 to 365 days')

# sync: changes kept in the order they came, each once; a whole copy now and then; each account its own
sa = TestClient(app, follow_redirects=False, client=('192.0.2.90', 1)); sb = TestClient(app, follow_redirects=False, client=('192.0.2.91', 1))
sa.post('/api/login', json=J(username='ann', password='annpass99')); sb.post('/api/login', json=J(username='ben', password='benpass99'))
st0 = sa.get('/api/sync/state').json()
check(st0 == {'snapshot': None, 'ops': [], 'head': 0}, 'sync: nothing kept yet for a new account')
check(sa.put('/api/sync/snapshot', json={'seq': 0, 'body': {'state': {'workspaces': []}}}).json()['seq'] == 0, 'the first copy (the browser’s own data to start from)')
r = sa.post('/api/sync/ops', json={'device': 'd1', 'ops': [{'id': 'a1', 'body': {'op': 'patch'}}, {'id': 'a2', 'body': {'op': 'move'}}]}).json()
check([a['seq'] for a in r['acked']] == [1, 2] and r['head'] == 2, 'changes numbered in the order they came')
r = sa.post('/api/sync/ops', json={'device': 'd1', 'ops': [{'id': 'a2', 'body': {'op': 'move'}}, {'id': 'a3', 'body': {'op': 'remove'}}]}).json()
check([a['seq'] for a in r['acked']] == [2, 3], 'sent again (an answer lost): kept once, its number as before')
since = sa.get('/api/sync/ops', params={'after': 1}).json()
check([o['id'] for o in since['ops']] == ['a2', 'a3'] and since['ops'][0]['device'] == 'd1' and since['ops'][1]['body'] == {'op': 'remove'}, 'changes after a number, as sent')
check(sb.get('/api/sync/state').json()['head'] == 0 and sb.get('/api/sync/ops', params={'after': 0}).json()['ops'] == [], "another account doesn't see them")
check(sa.put('/api/sync/snapshot', json={'seq': 3, 'body': {'state': {'workspaces': [1]}}}).json()['seq'] == 3 and sa.put('/api/sync/snapshot', json={'seq': 2, 'body': {}}).status_code == 409, 'a newer copy kept; an older one refused')
check(sa.put('/api/sync/snapshot', json={'seq': 99, 'body': {}}).status_code == 400, 'a copy past the changes kept: refused')
full = sa.get('/api/sync/state').json()
check(full['snapshot']['seq'] == 3 and full['snapshot']['body'] == {'state': {'workspaces': [1]}} and full['ops'] == [], 'starting again: the copy, and the changes after it (none)')
big = {'id': 'big', 'body': {'x': 'y' * 200000}}
check(sa.post('/api/sync/ops', json={'device': 'd1', 'ops': [big]}).status_code == 200, 'sync takes bigger bodies than the rest of the API (a whole tabcat)')
check(TestClient(app).get('/api/sync/state').status_code == 401, 'and only signed in')
import gzip as _gz, json as _js
packed = _gz.compress(_js.dumps({'device': 'd1', 'ops': [{'id': 'gz1', 'body': {'note': 'z' * 50000}}]}).encode())
r = sa.post('/api/sync/ops', content=packed, headers={'Content-Type': 'application/json', 'Content-Encoding': 'gzip'})
check(r.status_code == 200 and r.json()['acked'][0]['id'] == 'gz1' and len(packed) < 2000, f'sent gzipped (as the extension does with what is big): taken ({len(packed)} bytes for 50 KB)')
bomb = _gz.compress(b'{"device":"x","ops":[{"id":"b","body":"' + b'0' * (9 * 1024 * 1024) + b'"}]}')
check(sa.post('/api/sync/ops', content=bomb, headers={'Content-Type': 'application/json', 'Content-Encoding': 'gzip'}).status_code == 413, f'a "zip bomb" ({len(bomb)} bytes unpacking past 8 MB): refused')
r = sa.get('/api/sync/state', headers={'Accept-Encoding': 'gzip'})
check(r.headers.get('content-encoding') == 'gzip', 'answers worth it come back gzipped')

# the rest
check(c.get('/api/admin/info').json()['dashboard']['source'] == 'folder', 'info tells where the dashboard comes from')
check(c.get('/api/admin/backup').content[:15] == b'SQLite format 3', 'the backup is the database')
check(c.get('/../config.toml').status_code == 404 and c.get('/%2e%2e/tabcat.db').status_code == 404, "files outside the dashboard can't be fetched")
check(c.get('/privacy').status_code == 200, '/privacy finds privacy.html')
check(c.post('/api/logout').status_code == 200 and c.get('/api/me').status_code == 401, 'signing out ends the session')
print('all passed' if not failed else f'{len(failed)} failed')
sys.exit(1 if failed else 0)
