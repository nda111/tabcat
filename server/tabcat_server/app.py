"""The server: the dashboard at /, its sign-in pages, the admin page at /admin, and the API under /api.

The dashboard's own files are public (they are on GitHub anyway; the extension looks at its manifest to know
a tabcat server answers), but the page itself opens only signed in: else the sign-in page (or, with no
account yet, the page that makes the first one, an admin)."""
import ipaddress
import os
import json
import re
import secrets
import mimetypes
import tempfile
import time
from collections import deque
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response, StreamingResponse

from . import __version__, auth, dashboard, tailscale, totp, updates
from .db import DB

PAGES = Path(__file__).parent / 'pages'
MAX_BODY = 64 * 1024          # (the API's bodies: names, passwords, settings)
MAX_SYNC_BODY = 8 * 1024 * 1024  # (sync's: a whole copy of someone's tabcat at most)
SYNC_KEEP_OPS = 5000             # (changes kept past the latest copy, for browsers a little behind)
API_PER_MINUTE = 240          # (per address)
NO_STORE = {'Cache-Control': 'no-store'}
# the admin page's number settings and their ranges (session_days 0: not staying signed in)
NUMBERS = {'session_days': (0, 365), 'login_tries': (3, 50), 'login_lock_minutes': (1, 1440), 'log_days': (7, 365)}


def create_app(config) -> FastAPI:
    db = DB(config.db_path)
    db.purge_sessions()  # (ended sign-ins go: on starting, and on each new one, see sign_in)
    db.purge_events()    # (the security record's old entries too)
    if not os.environ.get('TABCAT_NO_UPDATES'):  # (tests: no looking things up on GitHub)
        updates.keep_up(db, config, dashboard)
    tickets: dict[str, tuple] = {}  # (two-step sign-ins half done: ticket -> (user id, until when); see login)
    throttle = auth.Throttle(lambda: (int(db.setting('login_tries')), int(db.setting('login_lock_minutes')) * 60))
    app = FastAPI(title='tabcat server', version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.db, app.state.config = db, config
    # Answers gzipped when worth it (over 1 KB) and the browser says it takes them (every browser does): JSON and the
    # dashboard's files shrink to a fifth or less, for a millisecond's work
    from starlette.middleware.gzip import GZipMiddleware
    app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=6)

    if config.dashboard == 'auto' and not dashboard.present(config.dashboard_dir):
        try:
            dashboard.update(config.dashboard_dir)
        except Exception as e:  # (no internet: the admin page can try again)
            print(f'tabcat-server: could not get the dashboard: {e}')

    # ---------- who is asking ----------

    def user_of(request: Request):
        u = auth.session_user(db, request.cookies.get(auth.COOKIE), ip=client(request))
        if u:
            touched(request).add(u['id'])  # (live: see notify)
        return u

    def touched(request: Request) -> set:
        """The accounts a request has to do with (whoever asks, whoever signs in or is changed), whose open pages
        are told once it's done (see notify)."""
        if not hasattr(request.state, 'touched'):
            request.state.touched = set()
        return request.state.touched

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

    # ---------- the security record ----------
    # What happened to whom, from where: signing in (and failing), changes to an account, an admin's doings. What
    # tabcat holds for anyone (links, groups) is never in it. Kept log_days days (the admin page's).
    def log(kind, request=None, user=None, username=None, actor=None, detail='', tried=None):
        db.run('insert into events (at, user_id, username, kind, ip, agent, actor, detail, tried) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
               time.time(), user['id'] if user else None, user['username'] if user else username, kind,
               client(request) if request else None, (request.headers.get('user-agent', '') if request else '')[:200],
               actor['username'] if actor else None, str(detail)[:200], tried[:60] if tried else None)

    def event(r) -> dict:
        return {'id': r['id'], 'at': r['at'], 'user_id': r['user_id'], 'username': r['username'], 'kind': r['kind'],
                'ip': r['ip'] or '', 'agent': r['agent'] or '', 'actor': r['actor'], 'detail': r['detail'] or '', 'tried': r['tried']}

    def clean_name(v) -> str:
        """A name to go by: up to auth.NAME_MAX characters (as many as show whole), spaces tidied; empty: none."""
        name = ' '.join(str(v or '').split())
        if len(name) > auth.NAME_MAX:
            raise HTTPException(400, 'the name is too long')
        return name

    def no_users() -> bool:
        return db.one('select count(*) n from users')['n'] == 0

    def public(u) -> dict:
        return {'id': u['id'], 'space': u['space'], 'username': u['username'], 'name': u['name'] or '', 'admin': bool(u['admin']), 'disabled': bool(u['disabled']),
                'avatar': f"/api/users/{u['id']}/avatar?v={int(u['avatar_at'] or 0)}" if u['avatar'] else None,
                'twofa': bool(u['totp_secret']), 'accent': accent_of(u['id']),
                'created_at': u['created_at'], 'last_seen': u['last_seen']}

    # An account's accent colour (its look, in its synced data: the latest change of it, or the copy's), for its
    # letter in a circle where it has no photo. (Read from the copy once a copy: kept until the next.)
    accents: dict[int, tuple] = {}

    def accent_of(uid) -> str:
        for r in db.q('select body from sync_ops where user_id = ? and body like ? order by seq desc limit 20', uid, '%"o":"look"%'):
            try:
                for op in reversed(json.loads(r['body']).get('ops') or []):
                    if isinstance(op, dict) and op.get('o') == 'look' and isinstance((op.get('f') or {}).get('accent'), str):
                        return op['f']['accent'][:20]
            except (ValueError, AttributeError):
                pass
        snap = db.one('select seq, body from sync_snapshots where user_id = ?', uid)
        if not snap:
            return 'purple'
        if accents.get(uid, (None,))[0] != snap['seq']:
            try:
                a = (json.loads(snap['body']).get('look') or {}).get('accent')
            except (ValueError, AttributeError):
                a = None
            accents[uid] = (snap['seq'], a if isinstance(a, str) else 'purple')
        return accents[uid][1][:20]

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

    def set_accounts(r: Response, request: Request, tokens: list, keep: bool | None = None):
        """Cookies for these tokens, the first in use (none: signed out). `keep`: as signing in asked ("stay signed
        in"); left out, as the cookies were."""
        secure = request.url.scheme == 'https' or request.headers.get('x-forwarded-proto') == 'https'
        if keep is None:
            keep = request.cookies.get(auth.KEEP) != '0'
        # (staying signed in off, here or for the whole server: cookies for as long as the browser's open)
        persist = keep and int(db.setting('session_days')) > 0
        opts = dict(httponly=True, samesite='lax', secure=secure, max_age=int(auth.session_seconds(db)) if persist else None, path='/')
        r.set_cookie(auth.KEEP, '1' if keep else '0', **opts)
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

    def sign_in(request: Request, user_id: int, keep: bool = True) -> Response:
        db.purge_sessions()
        db.purge_events()
        found = accounts_of(request)
        # (signed in again here: this browser's old sign-in for the account ends, not left over as another device)
        for t, u in found:
            if u and u['id'] == user_id:
                auth.end_session(db, t)
        touched(request).add(user_id)
        token = auth.new_session(db, user_id, request.headers.get('user-agent', ''), client(request), keep)
        # (the accounts already here stay; the oldest go past the limit)
        rest = [(t, u) for t, u in found if u and u['id'] != user_id]
        for t, _ in rest[auth.MAX_ACCOUNTS - 1:]:
            auth.end_session(db, t)
        return set_accounts(JSONResponse({'ok': True}), request, [token] + [t for t, _ in rest[:auth.MAX_ACCOUNTS - 1]], keep)

    def limit_for(path: str) -> int:
        return MAX_SYNC_BODY if path.startswith('/api/sync/') else MAX_BODY

    async def body(request: Request) -> dict:
        # (JSON only: a form posted from another site can't send it, nor the cookie's SameSite=Lax POST;
        # and small: read only up to MAX_BODY (sync: MAX_SYNC_BODY), however it's sent)
        if request.headers.get('content-type', '').split(';')[0] != 'application/json':
            raise HTTPException(415, 'JSON expected')
        limit = limit_for(request.url.path)
        raw = bytearray()
        async for chunk in request.stream():
            raw += chunk
            if len(raw) > limit:
                raise HTTPException(413, 'too large')
        # (sent gzipped, as the extension does with what's big: unpacked, but never past the limit, however small
        # it came: a "zip bomb" stops there)
        if request.headers.get('content-encoding', '').strip().lower() == 'gzip':
            import zlib
            unzip = zlib.decompressobj(16 + zlib.MAX_WBITS)
            try:
                out = unzip.decompress(bytes(raw), limit + 1)
            except zlib.error:
                raise HTTPException(400, 'bad gzip')
            if len(out) > limit or unzip.unconsumed_tail:
                raise HTTPException(413, 'too large')
            raw = out
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
    held: dict[str, tuple] = {}  # (an address held off: how many since last kept in the record, and when)

    @app.middleware('http')
    async def guard(request: Request, call_next):
        if request.url.path.startswith('/api/'):
            if int(request.headers.get('content-length') or 0) > limit_for(request.url.path):
                return JSONResponse({'detail': 'too large'}, 413)
            now, who = time.time(), client(request)
            q = hits.setdefault(who, deque())
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= API_PER_MINUTE:
                # (kept in the security record: the first time, then at most once a minute, with how many since)
                n, last = held.get(who, (0, 0))
                n += 1
                if now - last > 60:
                    log('rate_limited', request, detail=f'n:{n}')
                    held[who] = (0, now)
                else:
                    held[who] = (n, last)
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
        return {'tabcat': True, 'version': __version__, 'signup': db.setting('signup'), 'setup': no_users(),
                'keep': int(db.setting('session_days')) > 0}  # (staying signed in possible: the sign-in page offers it)

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
        log('setup', request, user=db.one('select * from users where id = ?', uid))
        return sign_in(request, uid)

    @app.post('/api/login')
    async def login(request: Request):
        data = await body(request)
        who = client(request)
        tried = str(data.get('username', ''))[:40]
        if throttle.blocked(who):
            log('login_locked', request, user=db.one('select * from users where username = ?', tried), tried=tried)
            raise HTTPException(429, 'too many tries: wait a few minutes')
        u = db.one('select * from users where username = ?', tried)
        if not u or not auth.check_password(str(data.get('password', '')), u['password']):
            throttle.failed(who)
            # (the username tried kept apart from the account: no account at all, the account stays empty)
            log('login_fail', request, user=u, tried=tried, detail='' if u else 'unknown')
            raise HTTPException(401, 'wrong username or password')
        if u['disabled']:
            log('login_refused', request, user=u, detail='suspended')
            raise HTTPException(403, 'this account is turned off')
        throttle.clear(who)
        keep = data.get('keep', True) is not False  # ("stay signed in": ticked unless said otherwise)
        # (two-step sign-in on: not yet; a ticket for a few minutes, to come back with a code)
        if u['totp_secret']:
            now = time.time()
            for k in [k for k, (_, exp, _k) in tickets.items() if exp < now]:
                tickets.pop(k, None)
            ticket = secrets.token_urlsafe(24)
            tickets[ticket] = (u['id'], now + 300, keep)
            return {'need': 'code', 'ticket': ticket}
        log('login_ok', request, user=u)
        return sign_in(request, u['id'], keep)

    # The second step: the authenticator app's code, or one of the recovery codes (each good once)
    @app.post('/api/login/code')
    async def login_code(request: Request):
        data = await body(request)
        who = client(request)
        if throttle.blocked(who):
            raise HTTPException(429, 'too many tries: wait a few minutes')
        uid, exp, keep = tickets.get(str(data.get('ticket', '')), (None, 0, True))
        if not uid or exp < time.time():
            raise HTTPException(401, 'start again: the sign-in took too long')
        u = db.one('select * from users where id = ? and disabled = 0', uid)
        if not u or not u['totp_secret']:
            raise HTTPException(401, 'start again: the sign-in took too long')
        code = str(data.get('code', ''))
        step = totp.check(u['totp_secret'], code, u['totp_step'] or 0)
        if step:
            db.run('update users set totp_step = ? where id = ?', step, uid)
        else:
            hashes = json.loads(u['recovery'] or '[]')
            h = totp.hash_code(code)
            if h not in hashes:
                throttle.failed(who)
                log('twofa_fail', request, user=u)
                raise HTTPException(401, 'wrong code')
            hashes.remove(h)
            db.run('update users set recovery = ? where id = ?', json.dumps(hashes), uid)
            log('recovery_used', request, user=u, detail=f'left:{len(hashes)}')
        tickets.pop(str(data.get('ticket')), None)
        throttle.clear(who)
        log('login_ok', request, user=u, detail='2fa')
        return sign_in(request, uid, keep)

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
        log('signup', request, user=db.one('select * from users where id = ?', uid), detail='invite' if invite else '')
        # (not signed in: the sign-in page takes it from here, the new username filled in)
        return {'ok': True, 'username': name}

    @app.post('/api/logout')
    def logout(request: Request):
        # (the account in use goes; the next one signed in here, if any, takes over)
        if gone := user_of(request):
            log('logout', request, user=gone)
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
        log('logout', request, user=next(u for t, u in found if t == tok))
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
        who = client(request)
        if throttle.blocked(who):
            raise HTTPException(429, 'too many tries: wait a few minutes')
        if not auth.check_password(str(data.get('current', '')), u['password']):
            throttle.failed(who)
            log('password_wrong', request, user=u)
            raise HTTPException(403, 'the current password is wrong')
        if not auth.valid_password(data.get('new', '')):
            raise HTTPException(400, 'the new password is too short')
        db.run('update users set password = ? where id = ?', auth.hash_password(data['new']), u['id'])
        log('password_changed', request, user=u)
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
        log('account_deleted', request, user=u)
        db.run('delete from users where id = ?', u['id'])
        # (signed out of it; another account signed in here takes over)
        return set_accounts(JSONResponse({'ok': True, 'next': rest[0][1]['username'] if rest else None}), request, [t for t, _ in rest])

    # ---------- two-step sign-in (optional: each account turns it on, or not) ----------
    @app.post('/api/me/2fa/start')
    def twofa_start(request: Request):
        u = need_user(request)
        secret = totp.new_secret()
        db.run('update users set totp_pending = ? where id = ?', secret, u['id'])
        issuer = f'tabcat ({request.url.hostname})'
        link = totp.uri(secret, u['username'], issuer)
        return {'secret': secret, 'uri': link, 'qr': totp.qr_svg(link)}

    @app.post('/api/me/2fa/confirm')
    async def twofa_confirm(request: Request):
        u = need_user(request)
        step = totp.check(u['totp_pending'], (await body(request)).get('code', ''))
        if not u['totp_pending'] or not step:
            raise HTTPException(400, 'wrong code')
        codes = totp.new_recovery()
        db.run('update users set totp_secret = totp_pending, totp_pending = null, totp_step = ?, recovery = ? where id = ?',
               step, json.dumps([totp.hash_code(c) for c in codes]), u['id'])
        log('twofa_on', request, user=u)
        return {'recovery': codes}

    async def with_password(request: Request):
        u = need_user(request)
        who = client(request)
        if throttle.blocked(who):
            raise HTTPException(429, 'too many tries: wait a few minutes')
        if not auth.check_password(str((await body(request)).get('password', '')), u['password']):
            throttle.failed(who)  # (as a failed sign-in: else a borrowed session could guess it fast)
            log('password_wrong', request, user=u)
            raise HTTPException(403, 'the current password is wrong')
        return u

    @app.post('/api/me/2fa/off')
    async def twofa_off(request: Request):
        u = await with_password(request)
        db.run('update users set totp_secret = null, totp_pending = null, totp_step = null, recovery = null where id = ?', u['id'])
        log('twofa_off', request, user=u)
        return {'ok': True}

    @app.post('/api/me/2fa/recovery')
    async def twofa_recovery(request: Request):
        u = await with_password(request)
        if not u['totp_secret']:
            raise HTTPException(409, 'two-step sign-in is off')
        codes = totp.new_recovery()
        db.run('update users set recovery = ? where id = ?', json.dumps([totp.hash_code(c) for c in codes]), u['id'])
        log('recovery_new', request, user=u)
        return {'recovery': codes}

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
        gone = db.one('select agent, ip from sessions where user_id = ? and substr(token, 1, 16) = ?', u['id'], sid)
        db.run('delete from sessions where user_id = ? and substr(token, 1, 16) = ?', u['id'], sid)
        if gone:
            log('session_ended', request, user=u, detail=f"{gone['ip'] or ''} {gone['agent'] or ''}".strip())
        return {'ok': True}

    @app.post('/api/me/logout-others')
    def logout_others(request: Request):
        u = need_user(request)
        db.run('delete from sessions where user_id = ? and token != ?', u['id'], auth.token_hash(request.cookies.get(auth.COOKIE, '')))
        log('logout_others', request, user=u)
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
        me_ = need_admin(request)
        data = await body(request)
        name, pw = data.get('username', ''), data.get('password', '')
        if not auth.valid_username(name) or not auth.valid_password(pw):
            raise HTTPException(400, 'bad username or password')
        if db.one('select 1 from users where username = ?', name):
            raise HTTPException(409, 'that username is taken')
        uid = db.run('insert into users (username, password, admin, created_at, name) values (?, ?, ?, ?, ?)',
                     name, auth.hash_password(pw), 1 if data.get('admin') else 0, time.time(), clean_name(data.get('name')))
        made = db.one('select * from users where id = ?', uid)
        log('user_added', request, user=made, actor=me_, detail='admin' if made['admin'] else '')
        return public(made)

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
            if bool(data['admin']) != bool(u['admin']):
                log('role_changed', request, user=u, actor=me_, detail='admin' if data['admin'] else 'user')
        if 'disabled' in data:
            if data['disabled'] and (last_admin or uid == me_['id']):
                raise HTTPException(409, "you can't turn off yourself or the last admin")
            db.run('update users set disabled = ? where id = ?', 1 if data['disabled'] else 0, uid)
            if bool(data['disabled']) != bool(u['disabled']):
                log('suspended' if data['disabled'] else 'unsuspended', request, user=u, actor=me_)
            if data['disabled']:
                db.run('delete from sessions where user_id = ?', uid)
        if data.get('twofa') is False:  # (locked out of it, phone gone and codes lost: an admin turns it off)
            db.run('update users set totp_secret = null, totp_pending = null, totp_step = null, recovery = null where id = ?', uid)
            if u['totp_secret']:
                log('twofa_reset', request, user=u, actor=me_)
        if 'password' in data:
            # (your own: on your account page, with the current one; here it would sign you out at once)
            if uid == me_['id']:
                raise HTTPException(409, 'change your own password on your account page')
            if not auth.valid_password(data['password']):
                raise HTTPException(400, 'the password is too short')
            db.run('update users set password = ? where id = ?', auth.hash_password(data['password']), uid)
            db.run('delete from sessions where user_id = ?', uid)
            log('password_reset', request, user=u, actor=me_)
        return public(db.one('select * from users where id = ?', uid))

    @app.delete('/api/admin/users/{uid}')
    def delete_user(uid: int, request: Request):
        me_ = need_admin(request)
        u = db.one('select * from users where id = ?', uid)
        if not u:
            raise HTTPException(404)
        if uid == me_['id'] or (u['admin'] and admins() == 1):
            raise HTTPException(409, "you can't delete yourself or the last admin")
        log('user_deleted', request, user=u, actor=me_)
        db.run('delete from users where id = ?', uid)
        return {'ok': True}

    @app.get('/api/admin/settings')
    def get_settings(request: Request):
        need_admin(request)
        return {'signup': db.setting('signup'), 'dashboard_auto': db.setting('dashboard_auto') == '1', **{k: int(db.setting(k)) for k in NUMBERS}}

    @app.put('/api/admin/settings')
    async def put_settings(request: Request):
        me_ = need_admin(request)
        data = await body(request)
        before = {k: db.setting(k) for k in ['signup', 'dashboard_auto', *NUMBERS]}
        if 'signup' in data:
            if data['signup'] not in ('closed', 'invite', 'open'):
                raise HTTPException(400, 'signup: closed, invite or open')
            db.set_setting('signup', data['signup'])
        if 'dashboard_auto' in data:
            db.set_setting('dashboard_auto', '1' if data['dashboard_auto'] else '0')
        for key, (lo, hi) in NUMBERS.items():
            if key in data:
                try:
                    n = int(data[key])
                except (TypeError, ValueError):
                    raise HTTPException(400, f'{key}: a number')
                if not lo <= n <= hi:
                    raise HTTPException(400, f'{key}: {lo} to {hi}')
                db.set_setting(key, n)
        changed = [f'{k}={db.setting(k)}' for k, v in before.items() if db.setting(k) != v]
        if changed:
            log('settings_changed', request, actor=me_, detail=', '.join(changed))
        return get_settings(request)

    # Signing everyone out (but you): after a leak, or to make a changed setting count for everyone
    @app.post('/api/admin/logout-all')
    def logout_all(request: Request):
        me_ = need_admin(request)
        db.run('delete from sessions where token != ?', auth.token_hash(request.cookies.get(auth.COOKIE, '')))
        log('logout_all', request, actor=me_)
        request.state.everyone = True
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
        log('invite_created', request, actor=u, detail=f'days:{days}' if days else '')
        return {'code': code, 'expires_at': expires}

    @app.delete('/api/admin/invites/{code}')
    def delete_invite(code: str, request: Request):
        me_ = need_admin(request)
        db.run('delete from invites where code = ?', code)
        log('invite_deleted', request, actor=me_)
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
            'release': {'latest': (tag := updates.known_release()), 'newer': updates.newer(tag), 'install': updates.install_kind()},
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
        log('db_moved', request, actor=user_of(request), detail=str(dest))
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

    # Updating the server itself to the newest release: on its own computer, installed with pip; then it starts
    # again (the page waits for it). Docker and a working copy: their own way (the page says how).
    @app.post('/api/admin/server/update')
    async def update_server(request: Request):
        need_admin(request)
        if not allowed(request, config.setup_from):
            raise HTTPException(403, 'only on the server computer')
        tag = updates.latest_release(max_age=0)
        if not updates.newer(tag):
            raise HTTPException(409, 'this is the newest already')
        if updates.install_kind() != 'pip':
            raise HTTPException(409, 'update it as it was installed')
        import asyncio
        try:
            await asyncio.to_thread(updates.upgrade, tag)
        except Exception as e:
            raise HTTPException(502, f'could not update: {e}')
        log('server_updated', request, actor=user_of(request), detail=tag)
        updates.restart()
        return {'ok': True, 'version': tag}

    # Tailscale on the server's computer: its state, and serving this server at its HTTPS address (on its own
    # computer only: that changes the computer's settings)
    @app.get('/api/admin/tailscale')
    async def tailscale_status(request: Request):
        need_admin(request)
        import asyncio
        return {**(await asyncio.to_thread(tailscale.status, config.port)), 'here': allowed(request, config.setup_from)}

    @app.post('/api/admin/tailscale/serve')
    async def tailscale_serve(request: Request):
        need_admin(request)
        if not allowed(request, config.setup_from):
            raise HTTPException(403, 'only on the server computer')
        on = bool((await body(request)).get('on'))
        import asyncio
        try:
            await asyncio.to_thread(tailscale.serve, on, config.port)
        except tailscale.NeedsEnabling as e:  # (the tailnet's HTTPS or serving off: where to turn it on)
            return JSONResponse({'detail': 'turn on HTTPS for the tailnet', 'enable': e.url}, 409)
        except Exception as e:
            raise HTTPException(502, f'tailscale: {e}')
        log('tailscale_serve', request, actor=user_of(request), detail='on' if on else 'off')
        return await asyncio.to_thread(tailscale.status, config.port)

    # The security record: for the admin page (everyone's, or one account's; older pages after `before`), and each
    # account's own on its account page
    @app.get('/api/admin/events')
    def admin_events(request: Request, user: int | None = None, before: int | None = None, limit: int = 50, offset: int = 0):
        """Newest first: `limit` of them, after `offset` (a page of them) or older than `before` (going on from
        one); `total`: how many there are (for the account, or everyone)."""
        need_admin(request)
        q, args = ' from events where 1 = 1', []
        if user is not None:
            q += ' and user_id = ?'; args.append(user)
        total = db.one('select count(*) n' + q, *args)['n']
        if before:
            q += ' and id < ?'; args.append(before)
        rows = db.q('select *' + q + ' order by id desc limit ? offset ?', *args, min(max(limit, 1), 200), max(offset, 0))
        day = time.time() - 86400
        fails = db.q("select ip, count(*) n from events where kind in ('login_fail', 'twofa_fail', 'login_locked', 'password_wrong', 'rate_limited') and at > ? group by ip order by n desc limit 5", day)
        # (each one's account as it is now: its name and whether an admin, for the record's own columns)
        ids = sorted({r['user_id'] for r in rows if r['user_id'] is not None})
        who = {u['id']: dict(u) for u in db.q(f"select id, name, admin from users where id in ({','.join('?' * len(ids))})", *ids)} if ids else {}
        out = [{**event(r), 'name': (who.get(r['user_id']) or {}).get('name') or '', 'admin': bool((who.get(r['user_id']) or {}).get('admin')) if r['user_id'] in who else None} for r in rows]
        return {'events': out, 'total': total, 'failures_24h': [{'ip': r['ip'], 'count': r['n']} for r in fails]}

    @app.get('/api/me/events')
    def my_events(request: Request, limit: int = 20, offset: int = 0):
        """Newest first: `limit` of them, after `offset` (a page of them); `total`: how many there are."""
        u = need_user(request)
        total = db.one('select count(*) n from events where user_id = ?', u['id'])['n']
        rows = db.q('select * from events where user_id = ? order by id desc limit ? offset ?', u['id'], min(max(limit, 1), 100), max(offset, 0))
        return {'events': [event(r) for r in rows], 'total': total}

    # ---------- live: open pages told at once when what they show changes ----------
    # Server-sent events, one connection a page: `head` (the account's latest sync change, for the dashboard's
    # extension to take), `me` (the account itself: its name, photo, 2FA, devices, record: for its account page
    # and the dashboard's Account dialog) and, to admins, `admin` (accounts, invites, settings, the record).
    # After any change through the API (not sync's own), the accounts it had to do with hear `me`, and admins
    # `admin`. Each listener a queue; at most so many an account.
    listeners: dict[int, set] = {}
    LISTENERS = 20

    def notify(uids, kind, data=None):
        for uid in uids:
            for q in list(listeners.get(uid, ())):
                try:
                    q.put_nowait((kind, data, uid))
                except Exception:
                    pass  # (full: far behind anyway)

    def notify_admins():
        admins = {r['id'] for r in db.q('select id from users where admin = 1')}
        notify([uid for uid in listeners if uid in admins], 'admin')

    @app.middleware('http')
    async def live(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        if request.method in ('POST', 'PUT', 'PATCH', 'DELETE') and path.startswith('/api/') and not path.startswith('/api/sync/'):
            uids = set(getattr(request.state, 'touched', ()))
            if m := re.match(r'^/api/admin/users/(\d+)', path):
                uids.add(int(m.group(1)))
            if getattr(request.state, 'everyone', False):
                uids = set(listeners)
            notify(uids, 'me')
            notify_admins()
        return response

    async def live_events(request: Request):
        """The stream: `head` at once (and whenever it moves on), `me` and `admin` as they come; a comment now and
        then, so nothing on the way closes it for being quiet. Closed after a few minutes, or once signed out
        (the browser connects again by itself; signed out, it's refused, and the page finds out)."""
        import asyncio
        u = need_user(request)
        mine = listeners.setdefault(u['id'], set())
        if len(mine) >= LISTENERS:
            raise HTTPException(429, 'too many listening')
        q = asyncio.Queue(maxsize=50)
        # (and the browser's other accounts, signed in beside it: one of them changed, `accounts`, for the list of them)
        uids = [u['id']] + [o['id'] for _, o in accounts_of(request)[1:] if o]
        for uid in uids:
            listeners.setdefault(uid, set()).add(q)

        def line(kind, data=None):
            return f'event: {kind}\ndata: {json.dumps(data if data is not None else {})}\n\n'

        async def stream():
            try:
                yield 'retry: 3000\n' + line('head', {'head': sync_head(u['id'])})
                end = time.time() + 300
                while time.time() < end:
                    try:
                        items = [await asyncio.wait_for(q.get(), 20)]
                        while not q.empty():
                            items.append(q.get_nowait())
                        # (several at once: each kind once, the latest)
                        latest = {}
                        for kind, data, uid in items:
                            if uid != u['id']:
                                if kind != 'me':
                                    continue  # (another's sync, or admin: not this one's)
                                kind = 'accounts'
                            latest[kind] = data
                        for kind, data in latest.items():
                            if kind == 'admin' and not db.one('select admin from users where id = ?', u['id'])['admin']:
                                continue
                            yield line(kind, {'head': data} if kind == 'head' else None)
                    except asyncio.TimeoutError:
                        if await request.is_disconnected() or not user_of(request):
                            break
                        yield ': still here\n\n'
            finally:
                for uid in uids:
                    listeners.get(uid, set()).discard(q)

        return StreamingResponse(stream(), media_type='text/event-stream', headers={**NO_STORE, 'X-Accel-Buffering': 'no'})

    app.get('/api/live')(live_events)
    app.get('/api/sync/events')(live_events)  # (as the dashboard first asked for it)

    # ---------- sync: each account's tabcat data, kept here, passed between its browsers ----------
    # The server keeps what the browsers send in the order it came (numbered: seq) and hands it on; it doesn't
    # read it (the extension applies changes, the same way in every browser, in this order). A change is
    # known by its id: sent twice (an answer lost on the way), it's kept once. Now and then a browser sends a
    # whole copy (a snapshot) up to a number; changes long before it are let go.
    def sync_head(uid) -> int:
        r = db.one('select max(seq) n from sync_ops where user_id = ?', uid)
        snap = db.one('select seq from sync_snapshots where user_id = ?', uid)
        return max(r['n'] or 0, snap['seq'] if snap else 0)

    def sync_user(request: Request):
        """The account signed in, which must be the one the browser keeps the data for (X-Tabcat-Account: its
        key): another signed in meanwhile (in the server's pages), and nothing of one goes into the other."""
        u = need_user(request)
        want = request.headers.get('x-tabcat-account')
        if want is not None and want != str(u['space'] or u['id']):
            raise HTTPException(409, 'another account is signed in')
        return u

    def sync_ops_after(uid, after, limit=1000):
        rows = db.q('select seq, op_id, device, body from sync_ops where user_id = ? and seq > ? order by seq limit ?', uid, after, limit)
        return [{'seq': r['seq'], 'id': r['op_id'], 'device': r['device'], 'body': json.loads(r['body'])} for r in rows]

    @app.get('/api/sync/state')
    def sync_state(request: Request):
        """Everything to start from: the latest copy (none yet: null) and the changes after it."""
        u = sync_user(request)
        snap = db.one('select seq, body, at from sync_snapshots where user_id = ?', u['id'])
        after = snap['seq'] if snap else 0
        return {'snapshot': {'seq': snap['seq'], 'at': snap['at'], 'body': json.loads(snap['body'])} if snap else None,
                'ops': sync_ops_after(u['id'], after, 100000), 'head': sync_head(u['id'])}

    @app.get('/api/sync/ops')
    def sync_since(request: Request, after: int = 0):
        """The changes after a number (`more`: there are yet more after these). Too far behind, before the
        oldest kept: `reload`, start again from the copy."""
        u = sync_user(request)
        oldest = db.one('select min(seq) n from sync_ops where user_id = ?', u['id'])['n']
        snap = db.one('select seq from sync_snapshots where user_id = ?', u['id'])
        if snap and after < snap['seq'] and (oldest is None or after < oldest - 1):
            return {'reload': True, 'head': sync_head(u['id'])}
        ops = sync_ops_after(u['id'], after)
        return {'ops': ops, 'head': sync_head(u['id']), 'more': len(ops) == 1000}

    @app.post('/api/sync/ops')
    async def sync_push(request: Request):
        """Changes from a browser, in its order: each kept once (its id), numbered after the rest. What came
        back: the numbers each got (a change kept before: its number then)."""
        u = sync_user(request)
        data = await body(request)
        device = str(data.get('device', ''))[:64]
        ops = data.get('ops') if isinstance(data.get('ops'), list) else []
        acked = []
        with db.lock:
            seq = sync_head(u['id'])
            for o in ops[:2000]:
                oid = str((o or {}).get('id', ''))[:64]
                if not oid or 'body' not in o:
                    continue
                had = db.one('select seq from sync_ops where user_id = ? and op_id = ?', u['id'], oid)
                if had:
                    acked.append({'id': oid, 'seq': had['seq']})
                    continue
                seq += 1
                db.run('insert into sync_ops (user_id, seq, op_id, device, at, body) values (?, ?, ?, ?, ?, ?)',
                       u['id'], seq, oid, device, time.time(), json.dumps(o['body'], separators=(',', ':')))
                acked.append({'id': oid, 'seq': seq})
        notify([u['id']], 'head', sync_head(u['id']))
        # (the look changed: its colour, where the account is shown)
        if any('"o":"look"' in json.dumps((o or {}).get('body'), separators=(',', ':')) for o in ops[:2000]):
            notify([u['id']], 'me')
            notify_admins()
        return {'acked': acked, 'head': sync_head(u['id'])}

    @app.put('/api/sync/snapshot')
    async def sync_snapshot(request: Request):
        """A whole copy, as it stands after change number `seq` (the first, with nothing kept yet: seq 0, the
        browser's own data to start from). An older one than kept: refused. Changes long before it go."""
        u = sync_user(request)
        data = await body(request)
        seq = data.get('seq')
        if not isinstance(seq, int) or seq < 0 or seq > sync_head(u['id']) or not isinstance(data.get('body'), dict):
            raise HTTPException(400, 'bad snapshot')
        with db.lock:
            have = db.one('select seq from sync_snapshots where user_id = ?', u['id'])
            if have and seq < have['seq']:
                raise HTTPException(409, 'an older copy than kept')
            # (a browser's own data to start from, `first`: only while there's nothing here yet; two browsers
            # starting the same account at once, the other one takes this one's)
            if data.get('first') and (have or sync_head(u['id'])):
                raise HTTPException(409, 'there is data here already')
            db.run('insert into sync_snapshots (user_id, seq, at, body) values (?, ?, ?, ?) on conflict(user_id) do update set seq = excluded.seq, at = excluded.at, body = excluded.body',
                   u['id'], seq, time.time(), json.dumps(data['body'], separators=(',', ':')))
            db.run('delete from sync_ops where user_id = ? and seq <= ?', u['id'], seq - SYNC_KEEP_OPS)
        if data.get('first'):
            notify([u['id']], 'head', sync_head(u['id']))
        return {'ok': True, 'seq': seq}

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
