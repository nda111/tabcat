"""The server: the dashboard at /, its sign-in pages, the admin page at /admin, and the API under /api.

The dashboard's own files are public (they are on GitHub anyway; the extension looks at its manifest to know
a tabcat server answers), but the page itself opens only signed in: else the sign-in page (or, with no
account yet, the page that makes the first one, an admin)."""
import asyncio
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

from . import __version__, auth, dashboard, hangul, tailscale, totp, updates
from .db import DB

PAGES = Path(__file__).parent / 'pages'
MAX_BODY = 64 * 1024          # (the API's bodies: names, passwords, settings)
MAX_SYNC_BODY = 8 * 1024 * 1024  # (sync's: a whole copy of someone's tabcat at most)
DEVICE_TABS_DAYS = 30           # (a browser's open tabs, unheard from this long: let go)
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
        drop_tabs(request.cookies.get(auth.COOKIE))
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
        drop_tabs(tok)
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
        drop_tabs(found[0][0])  # (this browser is the other account's now: no longer among the one before's)
        return set_accounts(JSONResponse({'ok': True}), request, [pick] + [t for t, u in found if u and t != pick])

    @app.get('/api/me')
    def me(request: Request):
        # (the account in use gone, another signed in here takes over: as the dashboard's extension asks)
        if not user_of(request) and (rest := takeover(request)):
            u = auth.session_user(db, rest[0])
            return set_accounts(JSONResponse({**public(u), 'switched': True}), request, rest)
        u = need_user(request)
        # (the server's only admin: their account can't be deleted, which its page says in place of the button)
        only = bool(u['admin']) and db.one('select count(*) n from users where admin = 1 and disabled = 0')['n'] <= 1
        return {**public(u), 'only_admin': only}

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
        app.state.tidy_shares()  # (its shares: another owner, or gone)
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
        app.state.tidy_shares()
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
        # (most changes are made in handlers on worker threads: a queue of the event loop's, put to from there, wouldn't
        # wake the stream waiting on it, which then heard only when something else woke the loop, up to 20 seconds on.
        # From another thread, handed to the loop to put.)
        try:
            here = asyncio.get_running_loop()
        except RuntimeError:
            here = None
        for uid in uids:
            for q in list(listeners.get(uid, ())):
                put = lambda q=q, item=(kind, data, uid): q.full() or q.put_nowait(item)  # (full: far behind anyway)
                loop = getattr(q, 'loop', None)
                try:
                    if loop is not None and loop is not here: loop.call_soon_threadsafe(put)
                    else: put()
                except Exception:
                    pass  # (the loop closed: the stream's gone)

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
            # (an account changed, its name, photo, 2FA...: whoever lists it, its shares' members and mail, told too)
            if path.startswith('/api/me') or path.startswith('/api/admin/users'):
                for uid in uids:
                    notify(related(uid), 'shares')
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
        q.loop = asyncio.get_running_loop()  # (for notify, from other threads)
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
                        # (this sign-in ended meanwhile, signed out of from another device say: told at once,
                        # 'gone', for its pages to show the sign-in, rather than at the next look 20 seconds on)
                        if not auth.session_user(db, request.cookies.get(auth.COOKIE), touch=False):
                            yield line('gone')
                            break
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

    # Each browser's open windows and tabs, for the account's others to see (the open tabs panel, one part a device):
    # sent as they change (the latest only, nothing kept of before), told live to the account's pages ('tabs'). A
    # browser not heard from in DEVICE_TABS_DAYS is let go; one can be named, or hidden (until shown again, or it signs in again).
    def clean_tabs(windows) -> list:
        text = lambda v, n: str(v or '')[:n]
        out = []
        for w in (windows if isinstance(windows, list) else [])[:50]:
            if not isinstance(w, dict):
                continue
            tabs = []
            for t in (w.get('tabs') if isinstance(w.get('tabs'), list) else [])[:500]:
                if not isinstance(t, dict) or not text(t.get('url'), 4000):
                    continue
                icon = text(t.get('icon'), 1000)
                tabs.append({'url': text(t.get('url'), 4000), 'title': text(t.get('title'), 300), 'icon': icon if re.match(r'^https?://', icon) else '',
                             'pinned': bool(t.get('pinned')), 'active': bool(t.get('active')), 'group': t.get('group') if isinstance(t.get('group'), int) else -1})
            groups = [{'id': g.get('id'), 'title': text(g.get('title'), 100), 'color': text(g.get('color'), 20)}
                      for g in (w.get('groups') if isinstance(w.get('groups'), list) else [])[:100] if isinstance(g, dict) and isinstance(g.get('id'), int)]
            if tabs:
                out.append({'focused': bool(w.get('focused')), 'tabs': tabs, 'groups': groups})
        return out

    def drop_tabs(token):
        """A browser signed out of an account (or gone over to another): out of that account's open tabs panel at once
        (its tabs aren't the account's to see any more)."""
        if not token:
            return
        h = auth.token_hash(token)[:16]
        users = [r['user_id'] for r in db.q('select user_id from device_tabs where session = ?', h)]
        if users:
            db.run('delete from device_tabs where session = ?', h)
            notify(users, 'tabs')

    @app.put('/api/sync/tabs')
    async def put_device_tabs(request: Request):
        """This browser's tabs, the latest. Hidden from the list since it signed in: shown again once it signs in again
        (still kept meanwhile, for the list of them to show it again)."""
        u = sync_user(request)
        data = await body(request)
        device = str(data.get('device', ''))[:64]
        if not device:
            raise HTTPException(400, 'which browser?')
        db.run("""insert into device_tabs (user_id, device, name, at, body, session) values (?, ?, ?, ?, ?, ?) on conflict(user_id, device) do update set
                  name = excluded.name, at = excluded.at, body = excluded.body, session = excluded.session,
                  forgotten = case when device_tabs.forgotten is not null and device_tabs.forgotten < ? then null else device_tabs.forgotten end""",
               u['id'], device, str(data.get('name', ''))[:60], time.time(), json.dumps({'windows': clean_tabs(data.get('windows'))}, separators=(',', ':')),
               auth.token_hash(request.cookies.get(auth.COOKIE, ''))[:16], u['session_created'] or 0)
        # (the same browser, signed in to another account before: no longer that one's)
        before = [r['user_id'] for r in db.q('select user_id from device_tabs where device = ? and user_id != ?', device, u['id'])]
        if before:
            db.run('delete from device_tabs where device = ? and user_id != ?', device, u['id'])
            notify(before, 'tabs')
        notify([u['id']], 'tabs')
        return {'ok': True}

    @app.get('/api/sync/tabs')
    def get_device_tabs(request: Request):
        """The account's browsers and what each has open, in the order the user put them (the rest as they came;
        `name`: its own, or the one given; `hidden`: kept out of the open tabs panel, shown in its list of them to be
        shown again; `session`: its sign-in while it lasts, for the list of sign-ins to end)."""
        u = need_user(request)
        db.run('delete from device_tabs where at < ?', time.time() - DEVICE_TABS_DAYS * 86400)
        rows = db.q('''select d.device, d.name, d.label, d.at, d.body, d.forgotten, d.session,
                              exists(select 1 from sessions s where s.user_id = d.user_id and substr(s.token, 1, 16) = d.session and s.expires_at > ?) signed_in
                       from device_tabs d where d.user_id = ? order by coalesce(d.position, 1e18), d.rowid''', time.time(), u['id'])
        # (only browsers still signed in to the account: one signed out, its sign-in run out or ended from the account
        # page, no longer shows what it has open)
        return {'devices': [{'device': r['device'], 'name': r['label'] or r['name'], 'own': r['name'], 'at': r['at'], 'hidden': r['forgotten'] is not None,
                             'session': r['session'], **json.loads(r['body'])} for r in rows if r['signed_in']]}

    @app.put('/api/sync/tabs/order')
    async def order_devices(request: Request):
        """The account's browsers in the order given (the rest after them, as they were), for all of them to show."""
        u = need_user(request)
        ids = [str(x)[:64] for x in ((await body(request)).get('devices') or [])][:200]
        with db.lock:
            for i, device in enumerate(ids):
                db.run('update device_tabs set position = ? where user_id = ? and device = ?', i, u['id'], device)
        notify([u['id']], 'tabs')
        return {'ok': True}

    @app.put('/api/sync/tabs/{device}/name')
    async def name_device(device: str, request: Request):
        """A name for one of the account's browsers (empty: its own again), for all of them to show."""
        u = need_user(request)
        label = ' '.join(str((await body(request)).get('name') or '').split())[:30]
        db.run('update device_tabs set label = ? where user_id = ? and device = ?', label, u['id'], device[:64])
        notify([u['id']], 'tabs')
        return {'ok': True}

    @app.put('/api/sync/tabs/{device}/hidden')
    async def hide_device(device: str, request: Request):
        """Kept out of the open tabs panel (or shown again): for all of the account's browsers; one hidden is shown
        again by itself once it signs in again."""
        u = need_user(request)
        hidden = (await body(request)).get('hidden') is True
        db.run('update device_tabs set forgotten = ? where user_id = ? and device = ?', time.time() if hidden else None, u['id'], device[:64])
        notify([u['id']], 'tabs')
        return {'ok': True}

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
            notify(related(u['id']), 'shares')
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

    # ---------- shared workspaces: one workspace, kept in step between accounts ----------
    # A workspace shared is data of its own (not in any account's): its changes numbered and handed on as an
    # account's are (see sync above), to its members' browsers, which show it among their workspaces (each keeps
    # only where it goes in its list). Its owner (one), managers and editors change it; viewers only see it. Managers
    # also change what the others may do (not the owner's, and never making anyone the owner). The owner asks
    # others to join by mail (an invite, answered: accepted or declined, the answer mailed back), changes what
    # each may do, hands the ownership on, or lets someone go; anyone may leave but the owner (who hands it on
    # first, or deletes it: gone for everyone).
    ROLES = ('owner', 'manager', 'editor', 'viewer')
    EDITS = ('owner', 'manager', 'editor')  # (may change it)
    RANK = "case m.role when 'owner' then 0 when 'manager' then 1 when 'editor' then 2 else 3 end"
    MAIL_KEEP_DAYS = 30  # (mail put away: kept this long, for undoing)

    def share_role(sid, uid):
        r = db.one('select role from share_members where share_id = ? and user_id = ?', sid, uid)
        return r['role'] if r else None

    def need_share(request: Request, sid: str, roles=ROLES, user=None):
        u = user or need_user(request)
        role = share_role(sid, u['id'])
        if not role:
            raise HTTPException(404, 'no such shared workspace')
        if role not in roles:
            raise HTTPException(403, 'not allowed for ' + role + 's')
        return u, role

    def share_users(sid) -> list:
        return [r['user_id'] for r in db.q('select user_id from share_members where share_id = ?', sid)]

    def share_head(sid) -> int:
        r = db.one('select max(seq) n from share_ops where share_id = ?', sid)
        snap = db.one('select seq from share_snapshots where share_id = ?', sid)
        return max(r['n'] or 0, snap['seq'] if snap else 0)

    def related(uid) -> set:
        """Whoever sees this account in a list of their own: its shares' members, and those it has mail with."""
        out = {r['user_id'] for r in db.q('select m2.user_id from share_members m1 join share_members m2 on m1.share_id = m2.share_id where m1.user_id = ?', uid)}
        out |= {r['u'] for r in db.q('select from_id u from mail where to_id = ? and deleted is null union select to_id u from mail where from_id = ? and deleted is null', uid, uid) if r['u']}
        out.discard(uid)
        return out

    def person(u) -> dict:
        """Someone as another account sees them: who, not what (no admin, last seen...)."""
        if not u:
            return None
        return {'id': u['id'], 'username': u['username'], 'name': u['name'] or '', 'twofa': bool(u['totp_secret']), 'accent': accent_of(u['id']),
                'avatar': f"/api/users/{u['id']}/avatar?v={int(u['avatar_at'] or 0)}" if u['avatar'] else None}

    def end_share(sid, by=None):
        """Gone for everyone: its invites still unanswered with it (answered mail stays, by name); deleted by its
        owner (`by`), the others told by mail."""
        uids = share_users(sid)
        if by:
            for x in uids:
                if x != by['id']:
                    tell(x, by, 'removed', sid)
        invited = [r['to_id'] for r in db.q("select to_id from mail where share_id = ? and kind = 'invite' and answer is null", sid)]
        db.run("delete from mail where share_id = ? and kind = 'invite' and answer is null", sid)
        db.run('delete from shares where id = ?', sid)
        notify(uids, 'shares')
        notify(invited, 'mail')

    def tidy_shares():
        """After an account goes: its shares without an owner get one (an editor first, the longest there), those
        with no one left go."""
        for r in db.q('select s.id from shares s where not exists (select 1 from share_members m where m.share_id = s.id)'):
            end_share(r['id'])
        for r in db.q("select s.id from shares s where not exists (select 1 from share_members m where m.share_id = s.id and m.role = 'owner')"):
            heir = db.one("select user_id from share_members m where share_id = ? order by " + RANK + ", at limit 1", r['id'])
            if heir:
                db.run("update share_members set role = 'owner' where share_id = ? and user_id = ?", r['id'], heir['user_id'])
                notify(share_users(r['id']), 'shares')
        db.run("delete from mail where kind = 'invite' and answer is null and from_id is null")

    app.state.tidy_shares = tidy_shares

    # (the browsers' side: which shares, and each one's data, as sync does an account's)
    @app.get('/api/sync/shares')
    def my_shares(request: Request):
        u = sync_user(request)
        rows = db.q('select s.id, s.root, m.role from share_members m join shares s on s.id = m.share_id where m.user_id = ? order by m.at', u['id'])
        return {'shares': [{'id': r['id'], 'root': r['root'], 'role': r['role'], 'head': share_head(r['id'])} for r in rows]}

    @app.post('/api/sync/shares')
    async def new_share(request: Request):
        """One of the account's workspaces, to share: from now on data of its own, a copy of it as it is (`body`:
        {workspaces: [it]}), its owner the account. Asked again for the same workspace (an answer lost): the same."""
        u = sync_user(request)
        data = await body(request)
        root = str(data.get('root') or '')[:64]
        doc = data.get('body')
        if not root or not isinstance(doc, dict) or not isinstance(doc.get('workspaces'), list) or len(doc['workspaces']) != 1 \
                or not isinstance(doc['workspaces'][0], dict) or doc['workspaces'][0].get('id') != root:
            raise HTTPException(400, 'bad workspace')
        with db.lock:
            had = db.one('select s.id from shares s join share_members m on m.share_id = s.id where s.root = ? and m.user_id = ?', root, u['id'])
            if had:
                return {'id': had['id'], 'created': False}
            sid = secrets.token_hex(12)
            now = time.time()
            w = doc['workspaces'][0]
            db.run('insert into shares (id, root, created_at, name, symbol) values (?, ?, ?, ?, ?)', sid, root, now, str(w.get('name') or '')[:100], str(w.get('symbol') or '')[:40])
            db.run("insert into share_members (share_id, user_id, role, at) values (?, ?, 'owner', ?)", sid, u['id'], now)
            db.run('insert into share_snapshots (share_id, seq, at, body) values (?, 0, ?, ?)', sid, now, json.dumps(doc, separators=(',', ':')))
        notify([u['id']], 'shares')
        return {'id': sid, 'created': True}

    def track_name(sid, body):
        """The workspace renamed (or its symbol changed) in a change: kept, for mail about it to name it."""
        root = db.one('select root from shares where id = ?', sid)['root']
        for op in (body.get('ops') if isinstance(body, dict) and isinstance(body.get('ops'), list) else []):
            f = op.get('f') if isinstance(op, dict) and op.get('id') == root and op.get('o') in ('set', 'add') else None
            if isinstance(f, dict):
                if isinstance(f.get('name'), str):
                    db.run('update shares set name = ? where id = ?', f['name'][:100], sid)
                if isinstance(f.get('symbol'), str):
                    db.run('update shares set symbol = ? where id = ?', f['symbol'][:40], sid)

    def tell(to_id, frm, kind, sid):
        """Mail about a share (someone let go of it, or leaving it), naming it as it is now."""
        sh = db.one('select name, symbol from shares where id = ?', sid)
        db.run('insert into mail (to_id, from_id, from_name, kind, share_id, ws_name, ws_symbol, at) values (?, ?, ?, ?, ?, ?, ?, ?)',
               to_id, frm['id'], frm['username'], kind, sid, sh['name'] if sh else '', sh['symbol'] if sh else '', time.time())
        notify([to_id], 'mail')

    def share_ops_after(sid, after, limit=1000):
        rows = db.q('select seq, op_id, device, user_id, body from share_ops where share_id = ? and seq > ? order by seq limit ?', sid, after, limit)
        return [{'seq': r['seq'], 'id': r['op_id'], 'device': r['device'], 'user': r['user_id'], 'body': json.loads(r['body'])} for r in rows]

    @app.get('/api/sync/shares/{sid}/state')
    def share_state(sid: str, request: Request):
        u = sync_user(request)
        need_share(request, sid, user=u)
        snap = db.one('select seq, body, at from share_snapshots where share_id = ?', sid)
        after = snap['seq'] if snap else 0
        return {'snapshot': {'seq': snap['seq'], 'at': snap['at'], 'body': json.loads(snap['body'])} if snap else None,
                'ops': share_ops_after(sid, after, 100000), 'head': share_head(sid)}

    @app.get('/api/sync/shares/{sid}/ops')
    def share_since(sid: str, request: Request, after: int = 0):
        u = sync_user(request)
        need_share(request, sid, user=u)
        oldest = db.one('select min(seq) n from share_ops where share_id = ?', sid)['n']
        snap = db.one('select seq from share_snapshots where share_id = ?', sid)
        if snap and after < snap['seq'] and (oldest is None or after < oldest - 1):
            return {'reload': True, 'head': share_head(sid)}
        ops = share_ops_after(sid, after)
        return {'ops': ops, 'head': share_head(sid), 'more': len(ops) == 1000}

    @app.post('/api/sync/shares/{sid}/ops')
    async def share_push(sid: str, request: Request):
        """Changes to it, from an owner's or editor's browser (a viewer's: refused, 403), as an account's are."""
        u = sync_user(request)
        need_share(request, sid, EDITS, user=u)
        data = await body(request)
        device = str(data.get('device', ''))[:64]
        ops = data.get('ops') if isinstance(data.get('ops'), list) else []
        acked = []
        with db.lock:
            seq = share_head(sid)
            for o in ops[:2000]:
                oid = str((o or {}).get('id', ''))[:64]
                if not oid or 'body' not in o:
                    continue
                had = db.one('select seq from share_ops where share_id = ? and op_id = ?', sid, oid)
                if had:
                    acked.append({'id': oid, 'seq': had['seq']})
                    continue
                seq += 1
                db.run('insert into share_ops (share_id, seq, op_id, user_id, device, at, body) values (?, ?, ?, ?, ?, ?, ?)',
                       sid, seq, oid, u['id'], device, time.time(), json.dumps(o['body'], separators=(',', ':')))
                acked.append({'id': oid, 'seq': seq})
                track_name(sid, o['body'])
        notify(share_users(sid), 'shares')
        return {'acked': acked, 'head': share_head(sid)}

    @app.put('/api/sync/shares/{sid}/snapshot')
    async def share_snapshot(sid: str, request: Request):
        u = sync_user(request)
        need_share(request, sid, EDITS, user=u)
        data = await body(request)
        seq = data.get('seq')
        if not isinstance(seq, int) or seq < 0 or seq > share_head(sid) or not isinstance(data.get('body'), dict):
            raise HTTPException(400, 'bad snapshot')
        with db.lock:
            have = db.one('select seq from share_snapshots where share_id = ?', sid)
            if have and seq < have['seq']:
                raise HTTPException(409, 'an older copy than kept')
            db.run('insert into share_snapshots (share_id, seq, at, body) values (?, ?, ?, ?) on conflict(share_id) do update set seq = excluded.seq, at = excluded.at, body = excluded.body',
                   sid, seq, time.time(), json.dumps(data['body'], separators=(',', ':')))
            db.run('delete from share_ops where share_id = ? and seq <= ?', sid, seq - SYNC_KEEP_OPS)
        return {'ok': True, 'seq': seq}

    @app.delete('/api/sync/shares/{sid}')
    def drop_share(sid: str, request: Request):
        """The owner: deleted, for everyone. Anyone else: leaving it."""
        u = sync_user(request)
        _, role = need_share(request, sid, user=u)
        if role == 'owner':
            end_share(sid, u)
        else:
            db.run('delete from share_members where share_id = ? and user_id = ?', sid, u['id'])
            notify(share_users(sid) + [u['id']], 'shares')
            owner_left_mail(sid, u)
        return {'ok': True}

    def owner_left_mail(sid, who):
        o = db.one("select user_id from share_members where share_id = ? and role = 'owner'", sid)
        if o:
            tell(o['user_id'], who, 'left', sid)

    # (the dashboard's side: who's in it and as what, asking others, the mailbox)
    def share_info(sid, uid) -> dict:
        members = db.q('select u.*, m.role, m.at joined from share_members m join users u on u.id = m.user_id where m.share_id = ? '
                       'order by ' + RANK + ', m.at', sid)
        invites = db.q("select u.*, m.id mail_id, m.role mail_role, m.at mail_at from mail m join users u on u.id = m.to_id where m.share_id = ? and m.kind = 'invite' and m.answer is null order by m.at", sid)
        return {'id': sid, 'root': db.one('select root from shares where id = ?', sid)['root'], 'role': share_role(sid, uid),
                'members': [{**person(r), 'role': r['role'], 'me': r['id'] == uid} for r in members],
                'invites': [{'mail': r['mail_id'], 'role': r['mail_role'], 'at': r['mail_at'], 'user': person(r)} for r in invites]}

    @app.get('/api/shares')
    def list_shares(request: Request):
        """The account's shares: each one's workspace (root), what the account may do, and how many are in it."""
        u = need_user(request)
        rows = db.q('select s.id, s.root, m.role, (select count(*) from share_members x where x.share_id = s.id) n, '
                    "(select count(*) from mail x where x.share_id = s.id and x.kind = 'invite' and x.answer is null) asked "
                    'from share_members m join shares s on s.id = m.share_id where m.user_id = ? order by m.at', u['id'])
        return {'shares': [{'id': r['id'], 'root': r['root'], 'role': r['role'], 'members': r['n'], 'invited': r['asked']} for r in rows]}

    @app.get('/api/shares/{sid}')
    def get_share(sid: str, request: Request):
        u, _ = need_share(request, sid)
        return share_info(sid, u['id'])

    @app.post('/api/shares/{sid}/invites')
    async def invite(sid: str, request: Request):
        """The owner asks someone (by username) to join, as a manager, an editor or a viewer: mailed to them."""
        u, _ = need_share(request, sid, ('owner',))
        data = await body(request)
        role = data.get('role')
        if role not in ('manager', 'editor', 'viewer'):
            raise HTTPException(400, 'as what?')
        to = db.one('select * from users where username = ? and disabled = 0', str(data.get('username') or '').strip())
        if not to:
            raise HTTPException(404, 'no such account')
        if to['id'] == u['id']:
            raise HTTPException(409, 'that is you')
        if share_role(sid, to['id']):
            raise HTTPException(409, 'already in it')
        if db.one("select 1 from mail where share_id = ? and to_id = ? and kind = 'invite' and answer is null", sid, to['id']):
            raise HTTPException(409, 'already asked')
        db.run("insert into mail (to_id, from_id, from_name, kind, share_id, ws_name, ws_symbol, role, at) values (?, ?, ?, 'invite', ?, ?, ?, ?, ?)",
               to['id'], u['id'], u['username'], sid, str(data.get('name') or '')[:100], str(data.get('symbol') or '')[:40], role, time.time())
        notify([to['id']], 'mail')
        notify(share_users(sid), 'shares')
        return share_info(sid, u['id'])

    @app.delete('/api/shares/{sid}/invites/{mid}')
    def cancel_invite(sid: str, mid: int, request: Request):
        """The owner takes an invite back, unanswered: gone from their mailbox too."""
        u, _ = need_share(request, sid, ('owner',))
        r = db.one("select to_id from mail where id = ? and share_id = ? and kind = 'invite' and answer is null", mid, sid)
        if not r:
            raise HTTPException(404, 'no such invite')
        db.run('delete from mail where id = ?', mid)
        notify([r['to_id']], 'mail')
        notify(share_users(sid), 'shares')
        return share_info(sid, u['id'])

    @app.put('/api/shares/{sid}/members/{uid}')
    async def set_role(sid: str, uid: int, request: Request):
        """The owner changes what someone may do; making them the owner hands it on (the owner an editor then). A
        manager changes what anyone but the owner may do (their own too, down to an editor or a viewer), never making
        anyone the owner."""
        u, mine = need_share(request, sid, ('owner', 'manager'))
        role = (await body(request)).get('role')
        if role not in ROLES:
            raise HTTPException(400, 'as what?')
        theirs = share_role(sid, uid)
        if not theirs:
            raise HTTPException(404, 'not in it')
        if mine == 'owner' and uid == u['id']:
            raise HTTPException(409, 'hand it on to someone else')
        if mine == 'manager' and (role == 'owner' or theirs == 'owner'):
            raise HTTPException(403, 'owners only')
        with db.lock:
            if role == 'owner':
                db.run("update share_members set role = 'editor' where share_id = ? and user_id = ?", sid, u['id'])
            db.run('update share_members set role = ? where share_id = ? and user_id = ?', role, sid, uid)
        notify(share_users(sid), 'shares')
        return share_info(sid, u['id'])

    @app.delete('/api/shares/{sid}/members/{uid}')
    def remove_member(sid: str, uid: int, request: Request):
        """The owner lets someone go (or anyone else leaves: themselves)."""
        u, role = need_share(request, sid)
        if uid == u['id']:
            if role == 'owner':
                raise HTTPException(409, 'hand it on first')
        elif role != 'owner':
            raise HTTPException(403, 'owners only')
        if not share_role(sid, uid):
            raise HTTPException(404, 'not in it')
        others = share_users(sid)
        db.run('delete from share_members where share_id = ? and user_id = ?', sid, uid)
        notify(others, 'shares')
        if uid == u['id']:
            owner_left_mail(sid, u)
            return {'ok': True}
        tell(uid, u, 'removed', sid)
        return share_info(sid, u['id'])

    @app.post('/api/shares/{sid}/end')
    def stop_sharing(sid: str, request: Request):
        """The owner stops sharing it with everyone: all let go (each told by mail), invites taken back; the owner's
        workspace stays as it is, theirs alone."""
        u, _ = need_share(request, sid, ('owner',))
        others = [x for x in share_users(sid) if x != u['id']]
        invited = [r['to_id'] for r in db.q("select to_id from mail where share_id = ? and kind = 'invite' and answer is null", sid)]
        with db.lock:
            db.run("delete from mail where share_id = ? and kind = 'invite' and answer is null", sid)
            db.run('delete from share_members where share_id = ? and user_id != ?', sid, u['id'])
        for x in others:
            tell(x, u, 'removed', sid)
        notify(others + invited + [u['id']], 'shares')
        notify(invited, 'mail')
        return share_info(sid, u['id'])

    @app.get('/api/users/search')
    def find_users(request: Request, q: str = ''):
        """Accounts to invite: those whose username or name has `q` in it, letter by letter for Korean (see hangul.py;
        the start first), not oneself."""
        u = need_user(request)
        q = hangul.letters(q.strip()[:60])
        if not q:
            return {'users': []}
        rows = [r for r in db.q('select * from users where id != ? and disabled = 0', u['id'])
                if q in hangul.letters(r['username']) or q in hangul.letters(r['name'] or '')]
        rows.sort(key=lambda r: (not hangul.letters(r['username']).startswith(q), r['username'].lower()))
        return {'users': [person(r) for r in rows[:30]]}

    def mail_item(r) -> dict:
        frm = db.one('select * from users where id = ?', r['from_id']) if r['from_id'] else None
        name, symbol = r['ws_name'], r['ws_symbol']
        if not name and r['share_id']:  # (mail from before shares kept their names: named by the share, or other mail about it)
            o = db.one("select name, symbol from shares where id = ? and name != ''", r['share_id']) \
                or db.one("select ws_name name, ws_symbol symbol from mail where share_id = ? and ws_name != '' order by abs(at - ?) limit 1", r['share_id'], r['at'])
            if o:
                name, symbol = o['name'], o['symbol']
        return {'id': r['id'], 'kind': r['kind'], 'from': person(frm) or {'id': None, 'username': r['from_name'], 'name': '', 'avatar': None, 'accent': 'purple', 'twofa': False},
                'share': r['share_id'], 'workspace': {'name': name, 'symbol': symbol}, 'role': r['role'],
                'answer': r['answer'], 'at': r['at'], 'answered_at': r['answered_at'], 'seen': r['seen']}

    @app.get('/api/mail')
    def mailbox(request: Request):
        """The account's mail, newest first (`asking`, for the badge: mail not read yet, and invites not answered yet)."""
        u = need_user(request)
        db.run('delete from mail where deleted is not null and deleted < ?', time.time() - MAIL_KEEP_DAYS * 86400)
        rows = db.q('select * from mail where to_id = ? and deleted is null order by at desc, id desc limit 500', u['id'])
        return {'mail': [mail_item(r) for r in rows], 'asking': sum(1 for r in rows if r['seen'] is None or (r['kind'] == 'invite' and r['answer'] is None))}

    @app.post('/api/mail/seen')
    async def saw_mail(request: Request):
        """Mail read: the Mailbox open with it in."""
        u = need_user(request)
        ids = [int(x) for x in ((await body(request)).get('ids') or [])[:500] if isinstance(x, int)]
        n = 0
        with db.lock:
            for mid in ids:
                if db.one('select 1 from mail where id = ? and to_id = ? and seen is null', mid, u['id']):
                    db.run('update mail set seen = ? where id = ?', time.time(), mid)
                    n += 1
        if n:
            notify([u['id']], 'mail')
        return {'ok': True}

    @app.post('/api/mail/{mid}/answer')
    async def answer(mid: int, request: Request):
        """An invite, accepted (in the share from now on, as asked) or declined: either way the answer's mailed back."""
        u = need_user(request)
        accept = (await body(request)).get('accept') is True
        with db.lock:
            r = db.one("select * from mail where id = ? and to_id = ? and kind = 'invite' and deleted is null", mid, u['id'])
            if not r:
                raise HTTPException(404, 'no such invite')
            if r['answer']:
                raise HTTPException(409, 'answered already')
            alive = r['share_id'] and db.one('select 1 from shares where id = ?', r['share_id'])
            if accept and not alive:
                raise HTTPException(410, 'the shared workspace is gone')
            now = time.time()
            db.run('update mail set answer = ?, answered_at = ? where id = ?', 'accepted' if accept else 'declined', now, mid)
            if accept and not share_role(r['share_id'], u['id']):
                db.run('insert into share_members (share_id, user_id, role, at) values (?, ?, ?, ?)', r['share_id'], u['id'], r['role'] or 'viewer', now)
            if r['from_id']:
                db.run("insert into mail (to_id, from_id, from_name, kind, share_id, ws_name, ws_symbol, role, answer, invite_id, at) values (?, ?, ?, 'reply', ?, ?, ?, ?, ?, ?, ?)",
                       r['from_id'], u['id'], u['username'], r['share_id'], r['ws_name'], r['ws_symbol'], r['role'], 'accepted' if accept else 'declined', mid, now)
        notify([u['id']] + ([r['from_id']] if r['from_id'] else []), 'mail')
        if alive:
            notify(share_users(r['share_id']) + [u['id']], 'shares')
        return mail_item(db.one('select * from mail where id = ?', mid))

    @app.post('/api/mail/delete')
    async def delete_mail(request: Request):
        """Mail put away (kept a while, to be undone: see /api/mail/restore); an invite only once answered."""
        u = need_user(request)
        ids = [int(x) for x in ((await body(request)).get('ids') or [])[:500] if isinstance(x, int)]
        done = []
        with db.lock:
            for mid in ids:
                r = db.one('select kind, answer from mail where id = ? and to_id = ? and deleted is null', mid, u['id'])
                if r and (r['kind'] != 'invite' or r['answer']):
                    db.run('update mail set deleted = ? where id = ?', time.time(), mid)
                    done.append(mid)
        if done:
            notify([u['id']], 'mail')
        return {'ids': done}

    @app.post('/api/mail/restore')
    async def restore_mail(request: Request):
        u = need_user(request)
        ids = [int(x) for x in ((await body(request)).get('ids') or [])[:500] if isinstance(x, int)]
        done = []
        with db.lock:
            for mid in ids:
                if db.one('select 1 from mail where id = ? and to_id = ? and deleted is not null', mid, u['id']):
                    db.run('update mail set deleted = null where id = ?', mid)
                    done.append(mid)
        if done:
            notify([u['id']], 'mail')
        return {'ids': done}

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
