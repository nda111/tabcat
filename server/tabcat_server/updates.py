"""Keeping up to date: the dashboard (from GitHub, checked once a day, updated by itself when the admin page lets
it) and the server itself (a newer release on GitHub said on the admin page; installed and started again from
there, when it was installed with pip; Docker and a working copy update their own way)."""
import json
import os
import sys
import threading
import time
import urllib.request
from pathlib import Path

from . import __version__

REPO = 'nda111/tabcat'
HEADERS = {'User-Agent': 'tabcat-server', 'Accept': 'application/vnd.github+json'}
_cache = {'release': None, 'checked': 0}


def _get(url: str):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=20) as r:
        return json.loads(r.read())


def latest_dashboard_commit() -> str | None:
    """The pages branch's newest commit (what the dashboard download would bring)."""
    return _get(f'https://api.github.com/repos/{REPO}/commits/pages').get('sha')


# The extension and the server are released from one repository, each with tags of its own: server-v1.0.0 for the
# server, extension-v1.1.0 (or, from before, v1.0.4) for the extension. The extension's are GitHub's "latest" (what
# the README and the install notes link to): the server's are published without being made so, and found here by
# their tags among the newest releases.
TAG = 'server-v'


def newest_tag(releases, prefix: str) -> str | None:
    """Of a list of GitHub releases, the newest published one tagged with that prefix."""
    tags = [r.get('tag_name') or '' for r in releases if not r.get('draft') and not r.get('prerelease')]
    tags = [t for t in tags if t.startswith(prefix) and t[len(prefix):][:1].isdigit()]
    return max(tags, key=_parts, default=None)


def latest_release(max_age=6 * 3600) -> str | None:
    """The newest server release's tag (server-v1.2.0), looked up at most every few hours."""
    if time.time() - _cache['checked'] > max_age:
        try:
            _cache['release'] = newest_tag(_get(f'https://api.github.com/repos/{REPO}/releases?per_page=50'), TAG)
        except Exception:
            pass  # (offline: as it was)
        _cache['checked'] = time.time()
    return _cache['release']


def shown(tag: str | None) -> str | None:
    """A release's tag as said to people: server-v1.2.0 -> v1.2.0."""
    return tag and 'v' + tag.split('-v')[-1].lstrip('v')


def known_release() -> str | None:
    """The newest release as last looked up (in the background: see keep_up), without waiting on GitHub."""
    return _cache['release']


def _parts(v: str):
    out = []
    for p in v.split('-v')[-1].lstrip('v').split('.')[:3]:
        digits = ''.join(c for c in p if c.isdigit())
        out.append(int(digits or 0))
    return tuple(out + [0] * (3 - len(out)))


def newer(tag: str | None) -> bool:
    """Is that release newer than this server? (1.1.0.dev0 counts as before 1.1.0)"""
    if not tag:
        return False
    mine, theirs = _parts(__version__), _parts(tag)
    return theirs > mine or (theirs == mine and 'dev' in __version__)


def install_kind() -> str:
    """How this server was installed: 'docker', 'checkout' (a working copy, pip -e) or 'pip'."""
    if Path('/.dockerenv').exists():
        return 'docker'
    here = Path(__file__).resolve()
    if 'site-packages' not in here.parts and 'dist-packages' not in here.parts:
        return 'checkout'
    return 'pip'


def upgrade(tag: str):
    """Install that release with this server's own Python (pip, from GitHub)."""
    import subprocess
    spec = f'tabcat-server @ git+https://github.com/{REPO}@{tag}#subdirectory=server'
    r = subprocess.run([sys.executable, '-m', 'pip', 'install', '--upgrade', spec], capture_output=True, text=True, timeout=900)
    if r.returncode:
        raise RuntimeError((r.stderr or r.stdout).strip().splitlines()[-1] if (r.stderr or r.stdout).strip() else 'pip failed')


def restart(delay=1.0):
    """Start again as it was started (in a moment: the answer that said so goes out first)."""
    def go():
        time.sleep(delay)
        os.execv(sys.executable, getattr(sys, 'orig_argv', [sys.executable] + sys.argv))
    threading.Thread(target=go, daemon=True).start()


def keep_up(db, config, dashboard):
    """Once a day: the newest release looked up; the dashboard updated, when it's from GitHub and the admin page
    lets it update by itself."""
    def loop():
        time.sleep(5)  # (not while starting)
        while True:
            latest_release(max_age=0)
            try:
                if config.dashboard == 'auto' and db.setting('dashboard_auto') == '1':
                    have = (dashboard.version(config.dashboard_dir) or {}).get('commit')
                    sha = latest_dashboard_commit()
                    if sha and sha != have:
                        dashboard.update(config.dashboard_dir)
            except Exception as e:
                print(f'tabcat-server: could not update the dashboard: {e}')
            time.sleep(24 * 3600)
    threading.Thread(target=loop, daemon=True).start()
