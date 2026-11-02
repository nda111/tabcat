"""The server's API, without a browser: first account, signing in, accounts, sign-up modes, invitations,
the admin's limits, and the dashboard behind the sign-in. Run: python tests/test_api.py"""
import os, sys, tempfile
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

# the rest
check(c.get('/api/admin/info').json()['dashboard']['source'] == 'folder', 'info tells where the dashboard comes from')
check(c.get('/api/admin/backup').content[:15] == b'SQLite format 3', 'the backup is the database')
check(c.get('/../config.toml').status_code == 404 and c.get('/%2e%2e/tabcat.db').status_code == 404, "files outside the dashboard can't be fetched")
check(c.get('/privacy').status_code == 200, '/privacy finds privacy.html')
check(c.post('/api/logout').status_code == 200 and c.get('/api/me').status_code == 401, 'signing out ends the session')
print('all passed' if not failed else f'{len(failed)} failed')
sys.exit(1 if failed else 0)
