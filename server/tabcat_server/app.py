"""The server: the dashboard at /, its sign-in pages, the admin page at /admin, and the API under /api.

The dashboard's own files are public (they are on GitHub anyway; the extension looks at its manifest to know
a tabcat server answers), but the page itself opens only signed in: else the sign-in page (or, with no
account yet, the page that makes the first one, an admin)."""
import ipaddress
import re
import mimetypes
import tempfile
import time
from collections import deque
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response

from . import __version__, auth, dashboard
from .db import DB

PAGES = Path(__file__).parent / 'pages'
MAX_BODY = 64 * 1024          # (the API's bodies: names, passwords, settings)
API_PER_MINUTE = 240          # (per address)
NO_STORE = {'Cache-Control': 'no-store'}
# the admin page's number settings and their ranges (session_days 0: not staying signed in)
NUMBERS = {'session_days': (0, 365), 'login_tries': (3, 50), 'login_lock_minutes': (1, 1440)}


def create_app(config) -> FastAPI:
    db = DB(config.db_path)
    throttle = auth.Throttle(lambda: (int(db.setting('login_tries')), int(db.setting('login_lock_minutes')) * 60))
    app = FastAPI(title='tabcat server', version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.db, app.state.config = db, config

    if config.dashboard == 'auto' and not dashboard.present(config.dashboard_dir):
        try:
            dashboard.update(config.dashboard_dir)
        except Exception as e:  # (no internet: the admin page can try again)
            print(f'tabcat-server: could not get the dashboard: {e}')

    # ---------- who is asking ----------

    def user_of(request: Request):
        return auth.session_user(db, request.cookies.get(auth.COOKIE), ip=client(request))

    def need_user(request: Request):
        u = user_of(request)
        if not u:
            raise HTTPException(401, 'not signed in')
        return u

    def need_admin(request: Request):
        u = need_user(request)
        if not u['admin']:
            raise HTTPException(403, 'admins only')
        if not allowed(request, config.admin_from):
            raise HTTPException(403, 'the admin page is not open to this address')
        return u

    def clean_name(v) -> str:
        """A name to go by: up to 40 characters, spaces tidied; empty: none (the username shows)."""
        name = ' '.join(str(v or '').split())
        if len(name) > 40:
            raise HTTPException(400, 'the name is too long')
        return name

    def no_users() -> bool:
        return db.one('select count(*) n from users')['n'] == 0

    def public(u) -> dict:
        return {'id': u['id'], 'space': u['space'], 'username': u['username'], 'name': u['name'] or '', 'admin': bool(u['admin']), 'disabled': bool(u['disabled']),
                'avatar': f"/api/users/{u['id']}/avatar?v={int(u['avatar_at'] or 0)}" if u['avatar'] else None,
                'created_at': u['created_at'], 'last_seen': u['last_seen']}

    # Several accounts at once in one browser: the one in use (auth.COOKIE) and the others (auth.MORE), each a
    # session of its own. Signing in again adds an account (the one in use joins the others); switching swaps
    # one of them in; signing out ends the one in use, and the next takes over.
    def accounts_of(request: Request):
        """The browser's accounts: [(token, user)], the one in use first; ended sessions dropped."""
        out, seen = [], set()
        tokens = [request.cookies.get(auth.COOKIE, '')] + request.cookies.get(auth.MORE, '').split(',')
        for i, tok in enumerate(tokens):
            u = auth.session_user(db, tok, touch=False) if tok else None
            if u and u['id'] not in seen:
                seen.add(u['id'])
                out.append((tok, u))
            elif i == 0:
                out.append((None, None))  # (none in use)
        return out

    def set_accounts(r: Response, request: Request, tokens: list):
        """Cookies for these tokens, the first in use (none: signed out)."""
        secure = request.url.scheme == 'https' or request.headers.get('x-forwarded-proto') == 'https'
        # (staying signed in off: cookies for as long as the browser's open)
        keep = int(db.setting('session_days')) > 0
        opts = dict(httponly=True, samesite='lax', secure=secure, max_age=int(auth.session_seconds(db)) if keep else None, path='/')
        tokens = [t for t in tokens if t]
        if tokens:
            r.set_cookie(auth.COOKIE, tokens[0], **opts)
        elif auth.COOKIE in request.cookies:
            r.delete_cookie(auth.COOKIE, path='/')
        if tokens[1:]:
            r.set_cookie(auth.MORE, ','.join(tokens[1:]), **opts)
        elif auth.MORE in request.cookies:  # (only when there was one to take away)
            r.delete_cookie(auth.MORE, path='/')
        return r

    def takeover(request: Request):
        """The account in use is gone (its sign-in ended, or it was turned off) but others are signed in here:
        their tokens, the next first, to set (see set_accounts); else None."""
        found = accounts_of(request)
        if found[0][1]:
            return None
        rest = [t for t, u in found[1:] if u]
        return rest or None

    def sign_in(request: Request, user_id: int) -> Response:
        token = auth.new_session(db, user_id, request.headers.get('user-agent', ''), client(request))
        # (the accounts already here stay, but for this one's old session: one each; the oldest go past the limit)
        rest = [(t, u) for t, u in accounts_of(request) if u and u['id'] != user_id]
        for t, _ in rest[auth.MAX_ACCOUNTS - 1:]:
            auth.end_session(db, t)
        return set_accounts(JSONResponse({'ok': True}), request, [token] + [t for t, _ in rest[:auth.MAX_ACCOUNTS - 1]])

    async def body(request: Request) -> dict:
        # (JSON only: a form posted from another site can't send it, nor the cookie's SameSite=Lax POST;
        # and small: read only up to MAX_BODY, however it's sent)
        if request.headers.get('content-type', '').split(';')[0] != 'application/json':
            raise HTTPException(415, 'JSON expected')
        raw = bytearray()
        async for chunk in request.stream():
            raw += chunk
            if len(raw) > MAX_BODY:
                raise HTTPException(413, 'too large')
        try:
            import json
            data = json.loads(raw or b'{}')
        except Exception:
            raise HTTPException(400, 'bad JSON')
        return data if isinstance(data, dict) else {}

    # (who's asking: the connection's address, or, from a trusted proxy, the one it says it's passing on:
    # uvicorn does that, believing only config.trusted_proxies)
    def client(request: Request) -> str:
        return request.client.host if request.client else '?'

    def allowed(request: Request, networks) -> bool:
        try:
            ip = ipaddress.ip_address(client(request))
            if ip.version == 6 and ip.ipv4_mapped:
                ip = ip.ipv4_mapped
            return any(ip in ipaddress.ip_network(n, strict=False) for n in networks)
        except ValueError:
            return False

    # ---------- guarding it ----------
    # Against floods: each address gets so many API calls a minute (signing in has its own, stricter limit:
    # see auth.Throttle); bodies are small (see body). The database is only ever asked with parameters, never
    # text put together from what's sent, so nothing sent can change a query. And every answer says: no
    # framing by other sites, no guessing at content types, no full addresses passed on to other sites.
    # (A flood bigger than one computer: for what's in front of it, a proxy or Tailscale, to stop.)
    hits: dict[str, deque] = {}

    @app.middleware('http')
    async def guard(request: Request, call_next):
        if request.url.path.startswith('/api/'):
            if int(request.headers.get('content-length') or 0) > MAX_BODY:
                return JSONResponse({'detail': 'too large'}, 413)
            now, who = time.time(), client(request)
            q = hits.setdefault(who, deque())
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= API_PER_MINUTE:
                return JSONResponse({'detail': 'too many requests: wait a minute'}, 429, headers={'Retry-After': '60'})
            q.append(now)
            if len(hits) > 10000:  # (forget addresses gone quiet)
                for k in [k for k, v in hits.items() if not v or now - v[-1] > 60]:
                    hits.pop(k, None)
        response = await call_next(request)
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('X-Frame-Options', 'DENY')
        response.headers.setdefault('Referrer-Policy', 'same-origin')
        return response

    # ---------- pages ----------

    def page(name: str) -> FileResponse:
        return FileResponse(PAGES / name, headers=NO_STORE)

    @app.get('/login')
    def login_page(request: Request):
        if no_users():
            return RedirectResponse('/setup')
        return page('login.html')

    @app.get('/setup')
    def setup_page(request: Request):
        if not no_users():
            return RedirectResponse('/login')
        return page('setup.html') if allowed(request, config.setup_from) else page('setup-elsewhere.html')

    @app.get('/account')
    def account_page(request: Request):
        if not user_of(request) and (rest := takeover(request)):
            return set_accounts(RedirectResponse('/account'), request, rest)
        return page('account.html') if user_of(request) else RedirectResponse('/login')

    @app.get('/admin')
    def admin_page(request: Request):
        u = user_of(request)
        if not u and (rest := takeover(request)):
            return set_accounts(RedirectResponse('/admin'), request, rest)
        if not u:
            return RedirectResponse('/login?next=/admin')
        if not u['admin']:
            return RedirectResponse('/')
        return page('admin.html') if allowed(request, config.admin_from) else page('admin-elsewhere.html')

    @app.get('/_server/{name}')
    def server_asset(name: str):
        f = (PAGES / name).resolve()
        if f.parent != PAGES.resolve() or not f.is_file() or f.suffix == '.html':
            raise HTTPException(404)
        return FileResponse(f)

    # ---------- the API: signing in ----------

    @app.get('/api/server')
    def server_info():
        return {'tabcat': True, 'version': __version__, 'signup': db.setting('signup'), 'setup': no_users()}

    # Is a username free? (for signing up: 'valid' and 'free'; asked as often as the API's limit lets)
    @app.get('/api/username')
    def username_free(name: str = ''):
        valid = auth.valid_username(name)
        return {'valid': valid, 'free': valid and not db.one('select 1 from users where username = ?', name)}

    @app.post('/api/setup')
    async def setup(request: Request):
        data = await body(request)
        if not no_users():
            raise HTTPException(409, 'there are accounts already')
        if not allowed(request, config.setup_from):
            raise HTTPException(403, 'set the server up from the computer it runs on')
        name, pw = data.get('username', ''), data.get('password', '')
        if not auth.valid_username(name) or not auth.valid_password(pw):
            raise HTTPException(400, 'bad username or password')
        uid = db.run('insert into users (username, password, admin, created_at, name) values (?, ?, 1, ?, ?)', name, auth.hash_password(pw), time.time(), clean_name(data.get('name')))
        return sign_in(request, uid)

    @app.post('/api/login')
    async def login(request: Request):
        data = await body(request)
        who = client(request)
        if throttle.blocked(who):
            raise HTTPException(429, 'too many tries: wait a few minutes')
        u = db.one('select * from users where username = ?', str(data.get('username', '')))
        if not u or not auth.check_password(str(data.get('password', '')), u['password']):
            throttle.failed(who)
            raise HTTPException(401, 'wrong username or password')
        if u['disabled']:
            raise HTTPException(403, 'this account is turned off')
        throttle.clear(who)
        return sign_in(request, u['id'])

    @app.post('/api/signup')
    async def signup(request: Request):
        data = await body(request)
        mode = db.setting('signup')
        name, pw, code = data.get('username', ''), data.get('password', ''), data.get('invite') or ''
        invite = None
        if mode == 'closed':  # (closed: invitations too)
            raise HTTPException(403, 'sign-up is closed')
        if mode == 'invite':
            invite = db.one('select * from invites where code = ? and used_by is null and (expires_at is null or expires_at > ?)', code, time.time())
            if not invite:
                raise HTTPException(403, 'this invitation is not valid')
        if not auth.valid_username(name) or not auth.valid_password(pw):
            raise HTTPException(400, 'bad username or password')
        if db.one('select 1 from users where username = ?', name):
            raise HTTPException(409, 'that username is taken')
        uid = db.run('insert into users (username, password, created_at, name) values (?, ?, ?, ?)', name, auth.hash_password(pw), time.time(), clean_name(data.get('name')))
        if invite:
            db.run('update invites set used_by = ?, used_at = ? where code = ?', uid, time.time(), code)
        # (not signed in: the sign-in page takes it from here, the new username filled in)
        return {'ok': True, 'username': name}

    @app.post('/api/logout')
    def logout(request: Request):
        # (the account in use goes; the next one signed in here, if any, takes over)
        auth.end_session(db, request.cookies.get(auth.COOKIE))
        rest = [(t, u) for t, u in accounts_of(request)[1:] if u]
        return set_accounts(JSONResponse({'ok': True, 'next': rest[0][1]['username'] if rest else None}), request, [t for t, _ in rest])

    # The accounts signed in in this browser (the one in use first), and switching to another of them
    @app.get('/api/accounts')
    def accounts(request: Request):
        need_user(request)
        return {'max': auth.MAX_ACCOUNTS, 'accounts': [{**public(u), 'current': i == 0} for i, (_, u) in enumerate(accounts_of(request)) if u]}

    # Signing out of another of them (to make room, say: there are so many at most), the one in use staying
    # The accounts signed in here, for the sign-in page (no account in use needed): at the limit, it asks which
    # one to sign out of before signing in another
    @app.get('/api/accounts/here')
    def accounts_here(request: Request):
        return {'max': auth.MAX_ACCOUNTS, 'accounts': [public(u) for _, u in accounts_of(request) if u]}

    @app.post('/api/accounts/logout')
    async def logout_account(request: Request):
        uid = (await body(request)).get('id')
        found = accounts_of(request)
        tok = next((t for t, u in found if u and u['id'] == uid), None)
        if not tok:
            raise HTTPException(404, 'that account is not signed in here')
        auth.end_session(db, tok)
        return set_accounts(JSONResponse({'ok': True}), request, [t for t, u in found if u and t != tok])

    @app.post('/api/accounts/switch')
    async def switch_account(request: Request):
        need_user(request)
        uid = (await body(request)).get('id')
        found = accounts_of(request)
        pick = next((t for t, u in found[1:] if u and u['id'] == uid), None)
        if not pick:
            raise HTTPException(404, 'that account is not signed in here')
        return set_accounts(JSONResponse({'ok': True}), request, [pick] + [t for t, u in found if u and t != pick])

    @app.get('/api/me')
    def me(request: Request):
        # (the account in use gone, another signed in here takes over: as the dashboard's extension asks)
        if not user_of(request) and (rest := takeover(request)):
            u = auth.session_user(db, rest[0])
            return set_accounts(JSONResponse({**public(u), 'switched': True}), request, rest)
        return public(need_user(request))

    @app.post('/api/me/password')
    async def change_password(request: Request):
        u = need_user(request)
        data = await body(request)
        if not auth.check_password(str(data.get('current', '')), u['password']):
            raise HTTPException(403, 'the current password is wrong')
        if not auth.valid_password(data.get('new', '')):
            raise HTTPException(400, 'the new password is too short')
        db.run('update users set password = ? where id = ?', auth.hash_password(data['new']), u['id'])
        # (signed out everywhere else)
        db.run('delete from sessions where user_id = ? and token != ?', u['id'], auth.token_hash(request.cookies.get(auth.COOKIE, '')))
        return {'ok': True}

    # Deleting your own account: confirmed by typing the phrase the page shows (its words, checked there); the
    # last admin can't go
    @app.delete('/api/me')
    async def delete_me(request: Request):
        u = need_user(request)
        data = await body(request)
        if data.get('confirm') is not True:
            raise HTTPException(400, 'not confirmed')
        if u['admin'] and admins() == 1:
            raise HTTPException(409, 'the last admin stays')
        rest = [(t, x) for t, x in accounts_of(request)[1:] if x]
        db.run('delete from users where id = ?', u['id'])
        # (signed out of it; another account signed in here takes over)
        return set_accounts(JSONResponse({'ok': True, 'next': rest[0][1]['username'] if rest else None}), request, [t for t, _ in rest])

    @app.put('/api/me/name')
    async def set_name(request: Request):
        u = need_user(request)
        db.run('update users set name = ? where id = ?', clean_name((await body(request)).get('name')), u['id'])
        return public(db.one('select * from users where id = ?', u['id']))

    # A profile photo: a small image (the page makes it 256 px square) as a data: URL; shown to who's signed in
    AVATAR = re.compile(r'^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$')

    @app.put('/api/me/avatar')
    async def set_avatar(request: Request):
        u = need_user(request)
        image = str((await body(request)).get('image', ''))
        if len(image) > 60000 or not AVATAR.match(image):
            raise HTTPException(400, 'not an image')
        db.run('update users set avatar = ?, avatar_at = ? where id = ?', image, time.time(), u['id'])
        return public(db.one('select * from users where id = ?', u['id']))

    @app.delete('/api/me/avatar')
    def remove_avatar(request: Request):
        u = need_user(request)
        db.run('update users set avatar = null, avatar_at = null where id = ?', u['id'])
        return public(db.one('select * from users where id = ?', u['id']))

    @app.get('/api/users/{uid}/avatar')
    def avatar(uid: int, request: Request):
        if not any(u for _, u in accounts_of(request)):  # (any account signed in here: the sign-in page shows them)
            raise HTTPException(401, 'not signed in')
        row = db.one('select avatar from users where id = ?', uid)
        if not row or not row['avatar']:
            raise HTTPException(404)
        head, data = row['avatar'].split(',', 1)
        import base64
        # (its address changes with it: kept a long while)
        return Response(base64.b64decode(data), media_type=head[5:].split(';')[0], headers={'Cache-Control': 'private, max-age=31536000, immutable'})

    # Where this account is signed in: each sign-in (device), from where, since when, last used; one can be
    # signed out of from here (this one: by signing out)
    @app.get('/api/me/sessions')
    def my_sessions(request: Request):
        u = need_user(request)
        mine = auth.token_hash(request.cookies.get(auth.COOKIE, ''))
        rows = db.q('select * from sessions where user_id = ? and expires_at > ? order by coalesce(last_seen, created_at) desc', u['id'], time.time())
        return [{'id': r['token'][:16], 'current': r['token'] == mine, 'agent': r['agent'] or '', 'ip': r['ip'] or '',
                 'created_at': r['created_at'], 'last_seen': r['last_seen'] or r['created_at']} for r in rows]

    @app.delete('/api/me/sessions/{sid}')
    def end_my_session(sid: str, request: Request):
        u = need_user(request)
        mine = auth.token_hash(request.cookies.get(auth.COOKIE, ''))
        if len(sid) != 16 or mine.startswith(sid):
            raise HTTPException(400, 'not that one')
        db.run('delete from sessions where user_id = ? and substr(token, 1, 16) = ?', u['id'], sid)
        return {'ok': True}

    @app.post('/api/me/logout-others')
    def logout_others(request: Request):
        u = need_user(request)
        db.run('delete from sessions where user_id = ? and token != ?', u['id'], auth.token_hash(request.cookies.get(auth.COOKIE, '')))
        return {'ok': True}

    # ---------- the API: the admin page ----------

    def admins() -> int:
        return db.one('select count(*) n from users where admin = 1 and disabled = 0')['n']

    @app.get('/api/admin/users')
    def users(request: Request):
        need_admin(request)
        return [public(u) for u in db.q('select * from users order by created_at')]

    @app.post('/api/admin/users')
    async def add_user(request: Request):
        need_admin(request)
        data = await body(request)
        name, pw = data.get('username', ''), data.get('password', '')
        if not auth.valid_username(name) or not auth.valid_password(pw):
            raise HTTPException(400, 'bad username or password')
        if db.one('select 1 from users where username = ?', name):
            raise HTTPException(409, 'that username is taken')
        uid = db.run('insert into users (username, password, admin, created_at, name) values (?, ?, ?, ?, ?)',
                     name, auth.hash_password(pw), 1 if data.get('admin') else 0, time.time(), clean_name(data.get('name')))
        return public(db.one('select * from users where id = ?', uid))

    @app.patch('/api/admin/users/{uid}')
    async def edit_user(uid: int, request: Request):
        me_ = need_admin(request)
        data = await body(request)
        u = db.one('select * from users where id = ?', uid)
        if not u:
            raise HTTPException(404)
        last_admin = u['admin'] and not u['disabled'] and admins() == 1
        if 'admin' in data:
            if not data['admin'] and last_admin:
                raise HTTPException(409, 'the last admin stays an admin')
            db.run('update users set admin = ? where id = ?', 1 if data['admin'] else 0, uid)
        if 'disabled' in data:
            if data['disabled'] and (last_admin or uid == me_['id']):
                raise HTTPException(409, "you can't turn off yourself or the last admin")
            db.run('update users set disabled = ? where id = ?', 1 if data['disabled'] else 0, uid)
            if data['disabled']:
                db.run('delete from sessions where user_id = ?', uid)
        if 'password' in data:
            # (your own: on your account page, with the current one; here it would sign you out at once)
            if uid == me_['id']:
                raise HTTPException(409, 'change your own password on your account page')
            if not auth.valid_password(data['password']):
                raise HTTPException(400, 'the password is too short')
            db.run('update users set password = ? where id = ?', auth.hash_password(data['password']), uid)
            db.run('delete from sessions where user_id = ?', uid)
        return public(db.one('select * from users where id = ?', uid))

    @app.delete('/api/admin/users/{uid}')
    def delete_user(uid: int, request: Request):
        me_ = need_admin(request)
        u = db.one('select * from users where id = ?', uid)
        if not u:
            raise HTTPException(404)
        if uid == me_['id'] or (u['admin'] and admins() == 1):
            raise HTTPException(409, "you can't delete yourself or the last admin")
        db.run('delete from users where id = ?', uid)
        return {'ok': True}

    @app.get('/api/admin/settings')
    def get_settings(request: Request):
        need_admin(request)
        return {'signup': db.setting('signup'), **{k: int(db.setting(k)) for k in NUMBERS}}

    @app.put('/api/admin/settings')
    async def put_settings(request: Request):
        need_admin(request)
        data = await body(request)
        if 'signup' in data:
            if data['signup'] not in ('closed', 'invite', 'open'):
                raise HTTPException(400, 'signup: closed, invite or open')
            db.set_setting('signup', data['signup'])
        for key, (lo, hi) in NUMBERS.items():
            if key in data:
                try:
                    n = int(data[key])
                except (TypeError, ValueError):
                    raise HTTPException(400, f'{key}: a number')
                if not lo <= n <= hi:
                    raise HTTPException(400, f'{key}: {lo} to {hi}')
                db.set_setting(key, n)
        return get_settings(request)

    # Signing everyone out (but you): after a leak, or to make a changed setting count for everyone
    @app.post('/api/admin/logout-all')
    def logout_all(request: Request):
        need_admin(request)
        db.run('delete from sessions where token != ?', auth.token_hash(request.cookies.get(auth.COOKIE, '')))
        return {'ok': True}

    @app.get('/api/admin/invites')
    def invites(request: Request):
        need_admin(request)
        rows = db.q('''select i.*, u.username used_by_name from invites i left join users u on u.id = i.used_by
                       order by i.created_at desc''')
        return [{'code': r['code'], 'created_at': r['created_at'], 'expires_at': r['expires_at'],
                 'used_by': r['used_by_name'], 'used_at': r['used_at']} for r in rows]

    @app.post('/api/admin/invites')
    async def add_invite(request: Request):
        u = need_admin(request)
        data = await body(request)
        import secrets
        code = secrets.token_urlsafe(12)
        days = data.get('days')
        expires = time.time() + float(days) * 86400 if days else None
        db.run('insert into invites (code, created_by, created_at, expires_at) values (?, ?, ?, ?)', code, u['id'], time.time(), expires)
        return {'code': code, 'expires_at': expires}

    @app.delete('/api/admin/invites/{code}')
    def delete_invite(code: str, request: Request):
        need_admin(request)
        db.run('delete from invites where code = ?', code)
        return {'ok': True}

    @app.get('/api/admin/info')
    def info(request: Request):
        need_admin(request)
        folder = config.dashboard_dir
        return {
            'version': __version__,
            'data_dir': str(config.data_dir),
            'db_bytes': config.db_path.stat().st_size if config.db_path.exists() else 0,
            'db_path': str(config.db_path),
            'here': allowed(request, config.setup_from),  # (on the server's own computer: see /api/admin/database)
            'dashboard': {'source': 'github' if config.dashboard == 'auto' else 'folder', 'folder': str(folder),
                          'present': dashboard.present(folder), 'version': dashboard.version(folder)},
            'users': db.one('select count(*) n from users')['n'],
            # (set as it starts: see config.py)
            'setup_from': list(config.setup_from), 'admin_from': list(config.admin_from), 'trusted_proxies': list(config.trusted_proxies),
            'sessions': db.one('select count(*) n from sessions where expires_at > ?', time.time())['n'],
        }

    # Moving the database: only on the server's own computer (the addresses setup is allowed from), the path
    # being one there. A folder: tabcat.db in it; else a file. Nothing may be there already.
    @app.post('/api/admin/database')
    async def move_database(request: Request):
        need_admin(request)
        if not allowed(request, config.setup_from):
            raise HTTPException(403, 'only on the server computer')
        raw = str((await body(request)).get('path', '')).strip()
        try:
            dest = Path(raw).expanduser()
            if not raw or not dest.is_absolute():
                raise ValueError
            if dest.is_dir() or not dest.suffix:
                dest = dest / 'tabcat.db'
            dest = dest.resolve()
        except (ValueError, OSError):
            raise HTTPException(400, 'not a usable path')
        if dest == config.db_path.resolve():
            raise HTTPException(400, 'that is where it is')
        if dest.exists():
            raise HTTPException(409, 'there is a file there already')
        try:
            db.move_to(dest)
        except OSError as e:
            raise HTTPException(400, f'not a usable path: {e.strerror or e}')
        config.database = str(dest)
        from .config import save_setting
        save_setting(config.data_dir, 'database', str(dest))
        return {'db_path': str(dest)}

    # The operating system's Save dialog, shown on the server's computer, to pick where the database goes (the
    # page can't get a path from the browser's): the path chosen, None if cancelled; 501 with no dialog there
    @app.post('/api/admin/database/pick')
    async def pick_database(request: Request):
        need_admin(request)
        if not allowed(request, config.setup_from):
            raise HTTPException(403, 'only on the server computer')
        title = str((await body(request)).get('title', ''))[:100] or 'tabcat'
        import asyncio
        from . import dialogs
        got = await asyncio.to_thread(dialogs.save_file, title, config.db_path)
        if got is False:
            raise HTTPException(501, 'no file dialog on the server computer')
        return {'path': got}

    @app.post('/api/admin/dashboard/update')
    def update_dashboard(request: Request):
        need_admin(request)
        if config.dashboard != 'auto':
            raise HTTPException(409, 'the dashboard comes from a folder (see the config)')
        try:
            return dashboard.update(config.dashboard_dir)
        except Exception as e:
            raise HTTPException(502, f'could not get the dashboard: {e}')

    @app.get('/api/admin/backup')
    def backup(request: Request):
        need_admin(request)
        tmp = Path(tempfile.mkdtemp()) / f'tabcat-{time.strftime("%Y%m%d-%H%M%S")}.db'
        db.backup_to(tmp)
        return FileResponse(tmp, filename=tmp.name, media_type='application/octet-stream')

    @app.api_route('/api/{rest:path}', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
    def api_missing(rest: str):
        raise HTTPException(404, 'no such API')

    # ---------- the dashboard ----------

    @app.get('/{path:path}')
    def files(path: str, request: Request):
        folder = config.dashboard_dir
        if path in ('', 'index.html'):
            if no_users():
                return RedirectResponse('/setup')
            if not user_of(request):
                # (the account in use gone: another signed in here takes over, the dashboard saying so)
                if rest := takeover(request):
                    return set_accounts(RedirectResponse('/?switched=1'), request, rest)
                return RedirectResponse('/login')
            if not dashboard.present(folder):
                return page('nodashboard.html')
            return FileResponse(folder / 'index.html', headers=NO_STORE)
        f = (folder / path).resolve()
        if folder.resolve() not in f.parents or not f.is_file():
            # (a path without an extension, like /privacy: its .html)
            alt = f.with_suffix('.html')
            if folder.resolve() in alt.parents and alt.is_file() and not Path(path).suffix:
                f = alt
            else:
                raise HTTPException(404)
        media = mimetypes.guess_type(f.name)[0]
        if f.name.endswith('.webmanifest'):
            media = 'application/manifest+json'
        return FileResponse(f, media_type=media, headers={'Cache-Control': 'no-cache'})

    return app


def from_env() -> FastAPI:
    """The app as --reload starts it (in a process of its own: the settings come through the environment)."""
    from . import config
    return create_app(config.load())
