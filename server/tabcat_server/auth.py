"""Passwords (scrypt, from the standard library) and sessions (a random token in an HttpOnly cookie; the
database keeps only its hash, so a copy of it can't sign anyone in)."""
import base64
import hashlib
import hmac
import secrets
import time

N, R, P = 2 ** 14, 8, 1
COOKIE = 'tabcat_session'


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(password.encode(), salt=salt, n=N, r=R, p=P, dklen=32)
    return f'scrypt${N}${R}${P}${base64.b64encode(salt).decode()}${base64.b64encode(key).decode()}'


def check_password(password: str, stored: str) -> bool:
    try:
        _, n, r, p, salt, key = stored.split('$')
        got = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(got, base64.b64decode(key))
    except Exception:
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_session(db, user_id: int, agent: str = '') -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    db.run('insert into sessions (token, user_id, created_at, expires_at, agent) values (?, ?, ?, ?, ?)',
           token_hash(token), user_id, now, now + session_seconds(db), agent[:200])
    return token


# How long a sign-in lasts: 'session_days' (the admin page's); 0: not kept, the cookie goes as the browser
# closes (and on the server after a day, should the browser keep it, restoring its tabs)
def session_seconds(db) -> float:
    days = float(db.setting('session_days') or 0)
    return (days or 1) * 86400


def session_user(db, token):
    if not token:
        return None
    row = db.one('''select u.* from sessions s join users u on u.id = s.user_id
                    where s.token = ? and s.expires_at > ? and u.disabled = 0''', token_hash(token), time.time())
    if row:
        db.run('update users set last_seen = ? where id = ?', time.time(), row['id'])
    return row


def end_session(db, token):
    if token:
        db.run('delete from sessions where token = ?', token_hash(token))


# A name: letters, digits, . _ - (2–32); a password: 8 characters or more
def valid_username(name: str) -> bool:
    return isinstance(name, str) and 2 <= len(name) <= 32 and all(c.isalnum() or c in '._-' for c in name)


def valid_password(password: str) -> bool:
    return isinstance(password, str) and 8 <= len(password) <= 256


# Too many wrong passwords from one address: it waits a while (in memory: forgotten on restart). How many,
# and how long: the admin page's 'login_tries' and 'login_lock_minutes', asked each time (see `limits`).
class Throttle:
    def __init__(self, limits=lambda: (8, 600)):
        self.limits, self.seen = limits, {}

    def blocked(self, key) -> bool:
        tries, window = self.limits()
        now = time.time()
        recent = [t for t in self.seen.get(key, []) if now - t < window]
        self.seen[key] = recent
        return len(recent) >= tries

    def failed(self, key):
        self.seen.setdefault(key, []).append(time.time())

    def clear(self, key):
        self.seen.pop(key, None)
