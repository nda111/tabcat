"""The server: the dashboard at /, its sign-in pages, the admin page at /admin, and the API under /api.

The dashboard's own files are public (they are on GitHub anyway; the extension looks at its manifest to know
a tabcat server answers), but the page itself opens only signed in: else the sign-in page (or, with no
account yet, the page that makes the first one, an admin)."""
import mimetypes
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response

from . import __version__, auth, dashboard
from .db import DB

PAGES = Path(__file__).parent / 'pages'
NO_STORE = {'Cache-Control': 'no-store'}


def create_app(config) -> FastAPI:
    db = DB(config.db_path)
    throttle = auth.Throttle()
    app = FastAPI(title='tabcat server', version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.db, app.state.config = db, config

    if config.dashboard == 'auto' and not dashboard.present(config.dashboard_dir):
        try:
            dashboard.update(config.dashboard_dir)
        except Exception as e:  # (no internet: the admin page can try again)
            print(f'tabcat-server: could not get the dashboard: {e}')

    # ---------- who is asking ----------

    def user_of(request: Request):
        return auth.session_user(db, request.cookies.get(auth.COOKIE))

    def need_user(request: Request):
        u = user_of(request)
        if not u:
            raise HTTPException(401, 'not signed in')
        return u

    def need_admin(request: Request):
        u = need_user(request)
        if not u['admin']:
            raise HTTPException(403, 'admins only')
        return u

    def no_users() -> bool:
        return db.one('select count(*) n from users')['n'] == 0

    def public(u) -> dict:
        return {'id': u['id'], 'username': u['username'], 'admin': bool(u['admin']), 'disabled': bool(u['disabled']),
                'created_at': u['created_at'], 'last_seen': u['last_seen']}

    def sign_in(request: Request, user_id: int) -> Response:
        token = auth.new_session(db, user_id, request.headers.get('user-agent', ''))
        r = JSONResponse({'ok': True})
        secure = request.url.scheme == 'https' or request.headers.get('x-forwarded-proto') == 'https'
        r.set_cookie(auth.COOKIE, token, httponly=True, samesite='lax', secure=secure,
                     max_age=int(float(db.setting('session_days') or 30) * 86400), path='/')
        return r

    async def body(request: Request) -> dict:
        # (JSON only: a form posted from another site can't send it, nor the cookie's SameSite=Lax POST)
        if request.headers.get('content-type', '').split(';')[0] != 'application/json':
            raise HTTPException(415, 'JSON expected')
        try:
            data = await request.json()
        except Exception:
            raise HTTPException(400, 'bad JSON')
        return data if isinstance(data, dict) else {}

    def client(request: Request) -> str:
        return request.headers.get('x-forwarded-for', '').split(',')[0].strip() or (request.client.host if request.client else '?')

    # ---------- pages ----------

    def page(name: str) -> FileResponse:
        return FileResponse(PAGES / name, headers=NO_STORE)

    @app.get('/login')
    def login_page(request: Request):
        if no_users():
            return RedirectResponse('/setup')
        return page('login.html')

    @app.get('/setup')
    def setup_page():
        return page('setup.html') if no_users() else RedirectResponse('/login')

    @app.get('/account')
    def account_page(request: Request):
        return page('account.html') if user_of(request) else RedirectResponse('/login')

    @app.get('/admin')
    def admin_page(request: Request):
        u = user_of(request)
        if not u:
            return RedirectResponse('/login?next=/admin')
        return page('admin.html') if u['admin'] else RedirectResponse('/')

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

    @app.post('/api/setup')
    async def setup(request: Request):
        data = await body(request)
        if not no_users():
            raise HTTPException(409, 'there are accounts already')
        name, pw = data.get('username', ''), data.get('password', '')
        if not auth.valid_username(name) or not auth.valid_password(pw):
            raise HTTPException(400, 'bad username or password')
        uid = db.run('insert into users (username, password, admin, created_at) values (?, ?, 1, ?)', name, auth.hash_password(pw), time.time())
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
        if mode == 'invite' or (mode == 'closed' and code):
            invite = db.one('select * from invites where code = ? and used_by is null and (expires_at is null or expires_at > ?)', code, time.time())
            if not invite:
                raise HTTPException(403, 'this invitation is not valid')
        elif mode != 'open':
            raise HTTPException(403, 'sign-up is closed')
        if not auth.valid_username(name) or not auth.valid_password(pw):
            raise HTTPException(400, 'bad username or password')
        if db.one('select 1 from users where username = ?', name):
            raise HTTPException(409, 'that username is taken')
        uid = db.run('insert into users (username, password, created_at) values (?, ?, ?)', name, auth.hash_password(pw), time.time())
        if invite:
            db.run('update invites set used_by = ?, used_at = ? where code = ?', uid, time.time(), code)
        return sign_in(request, uid)

    @app.post('/api/logout')
    def logout(request: Request):
        auth.end_session(db, request.cookies.get(auth.COOKIE))
        r = JSONResponse({'ok': True})
        r.delete_cookie(auth.COOKIE, path='/')
        return r

    @app.get('/api/me')
    def me(request: Request):
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
        uid = db.run('insert into users (username, password, admin, created_at) values (?, ?, ?, ?)',
                     name, auth.hash_password(pw), 1 if data.get('admin') else 0, time.time())
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
        return {'signup': db.setting('signup'), 'session_days': int(db.setting('session_days'))}

    @app.put('/api/admin/settings')
    async def put_settings(request: Request):
        need_admin(request)
        data = await body(request)
        if 'signup' in data:
            if data['signup'] not in ('closed', 'invite', 'open'):
                raise HTTPException(400, 'signup: closed, invite or open')
            db.set_setting('signup', data['signup'])
        if 'session_days' in data:
            days = int(data['session_days'])
            if not 1 <= days <= 365:
                raise HTTPException(400, 'session_days: 1 to 365')
            db.set_setting('session_days', days)
        return get_settings(request)

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
            'dashboard': {'source': 'github' if config.dashboard == 'auto' else 'folder', 'folder': str(folder),
                          'present': dashboard.present(folder), 'version': dashboard.version(folder)},
            'users': db.one('select count(*) n from users')['n'],
        }

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
