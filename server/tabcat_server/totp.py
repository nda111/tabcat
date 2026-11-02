"""Two-step sign-in with an authenticator app (TOTP, RFC 6238: the 6-digit codes of Google Authenticator,
1Password, Authy and the rest), and one-time recovery codes for when the phone is gone. Optional: an account
uses it only once its owner turns it on."""
import base64
import hashlib
import hmac
import io
import secrets
import struct
import time
from urllib.parse import quote

STEP, DIGITS, WINDOW = 30, 6, 1  # (a code lasts 30 s; the one before and after count too, for clocks a little off)


def new_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip('=')


def _code(secret: str, counter: int) -> str:
    key = base64.b32decode(secret + '=' * (-len(secret) % 8))
    mac = hmac.new(key, struct.pack('>Q', counter), hashlib.sha1).digest()
    off = mac[-1] & 0x0F
    n = struct.unpack('>I', mac[off:off + 4])[0] & 0x7FFFFFFF
    return str(n % 10 ** DIGITS).zfill(DIGITS)


def check(secret: str, code: str, last_step: int = 0) -> int:
    """The time step the code is for (to remember: each used once), or 0 when it isn't right (or was used)."""
    code = ''.join(c for c in str(code) if c.isdigit())
    if len(code) != DIGITS or not secret:
        return 0
    now = int(time.time()) // STEP
    for step in range(now - WINDOW, now + WINDOW + 1):
        if step > last_step and hmac.compare_digest(_code(secret, step), code):
            return step
    return 0


def uri(secret: str, account: str, issuer: str) -> str:
    """What the app reads from the QR code: the secret, and the names it shows the codes under."""
    label = quote(f'{issuer}:{account}')
    return f'otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&digits={DIGITS}&period={STEP}'


def qr_svg(text: str) -> str:
    """The QR code as SVG: black on white, in either theme (what cameras read best)."""
    import segno
    out = io.BytesIO()
    segno.make(text, error='m').save(out, kind='svg', scale=5, border=3, dark='#000', light='#fff', xmldecl=False, svgns=True, omitsize=True)  # (no fixed size: it fills its box)
    return out.getvalue().decode()


# Recovery codes: ten, each good once, shown once; kept only as hashes
def new_recovery() -> list[str]:
    abc = 'abcdefghjkmnpqrstuvwxyz23456789'
    return ['-'.join(''.join(secrets.choice(abc) for _ in range(4)) for _ in range(3)) for _ in range(10)]


def hash_code(code: str) -> str:
    return hashlib.sha256(''.join(c for c in code.lower() if c.isalnum()).encode()).hexdigest()
