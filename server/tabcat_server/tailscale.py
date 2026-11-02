"""Tailscale on the server's computer, for the admin page: whether it's there and signed in, this computer's name
and addresses on the tailnet, and serving this server at its HTTPS address (tailscale serve), on and off. Through
the tailscale command (Windows' from WSL too). None of it with TABCAT_NO_TAILSCALE (tests)."""
import json
import os
import shutil
import subprocess
from pathlib import Path

WINDOWS_CLI = [r'C:\Program Files\Tailscale\tailscale.exe', '/mnt/c/Program Files/Tailscale/tailscale.exe']


def cli() -> str | None:
    if os.environ.get('TABCAT_NO_TAILSCALE'):
        return None
    for name in ('tailscale', 'tailscale.exe'):
        if found := shutil.which(name):
            return found
    return next((p for p in WINDOWS_CLI if Path(p).exists()), None)


def _run(*args, timeout=8) -> subprocess.CompletedProcess:
    return subprocess.run([cli(), *args], capture_output=True, text=True, encoding='utf-8', timeout=timeout)


def status(port: int) -> dict:
    """{installed, state ('Running', 'NeedsLogin', 'Stopped', …), name, ips, url, serving (this port at the URL)}"""
    exe = cli()
    if not exe:
        return {'installed': False}
    out = {'installed': True, 'state': None, 'name': None, 'ips': [], 'url': None, 'serving': False, 'https': False}
    try:
        st = json.loads(_run('status', '--json').stdout or '{}')
        out['state'] = st.get('BackendState')
        me = st.get('Self') or {}
        dns = (me.get('DNSName') or '').rstrip('.')
        out['name'] = dns or me.get('HostName')
        out['ips'] = me.get('TailscaleIPs') or []
        # (HTTPS certificates allowed for the tailnet, in its admin console: then it lists the names they're for)
        out['https'] = bool(st.get('CertDomains'))
        if dns:
            out['url'] = f'https://{dns}'
            serve = json.loads(_run('serve', 'status', '--json').stdout or '{}')
            for handlers in (serve.get('Web') or {}).values():
                for h in (handlers.get('Handlers') or {}).values():
                    proxy = h.get('Proxy') or ''
                    if proxy.rstrip('/').endswith(f':{port}'):
                        out['serving'] = True
    except (OSError, subprocess.SubprocessError, ValueError):
        pass
    return out


ADMIN_DNS = 'https://login.tailscale.com/admin/dns'


class NeedsEnabling(Exception):
    """The tailnet doesn't allow it yet (HTTPS certificates, or serving, off in its admin console): where to turn it on."""
    def __init__(self, url):
        super().__init__(url)
        self.url = url


def serve(on: bool, port: int):
    """Serve this server at the computer's HTTPS address on the tailnet (in the background, kept), or stop.
    Not allowed by the tailnet yet: NeedsEnabling, with the page to allow it (tailscale itself would sit
    waiting for that, link printed)."""
    import re
    if on and not status(port).get('https'):
        raise NeedsEnabling(ADMIN_DNS)
    try:
        r = _run('serve', '--bg', f'http://127.0.0.1:{port}', timeout=20) if on else _run('serve', '--https=443', 'off', timeout=20)
    except subprocess.TimeoutExpired as e:
        text = (e.stdout or b'').decode(errors='ignore') if isinstance(e.stdout, bytes) else (e.stdout or '')
        link = re.search(r'https://login\.tailscale\.com/\S+', text)
        raise NeedsEnabling(link.group(0) if link else ADMIN_DNS)
    text = (r.stderr or '') + (r.stdout or '')
    if link := re.search(r'https://login\.tailscale\.com/\S+', text):
        raise NeedsEnabling(link.group(0))
    if r.returncode:
        raise RuntimeError(text.strip().splitlines()[-1] if text.strip() else 'tailscale failed')
