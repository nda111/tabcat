# Shared setup for the browser tests: the dashboard served on :8765, Chromium with the extension
# loaded (from a clean copy of the repo), a fresh profile each run, and PASS / FAIL reporting.
import atexit, functools, http.server, os, shutil, sys, tempfile, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.environ.get('TABCAT_WEB', os.path.join(ROOT, 'web'))  # the `pages` worktree
PORT = 8765
URL = f'http://localhost:{PORT}/'

failures = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg, flush=True)
    if not cond: failures.append(msg)
def done():
    print(f'{len(failures)} failed' if failures else 'all passed', flush=True)
    sys.exit(1 if failures else 0)

def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=WEB)
    srv = http.server.ThreadingHTTPServer(('localhost', PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    atexit.register(srv.shutdown)

def extension_copy():
    # the extension without the dashboard worktree, the tests or the logo's source files
    dst = tempfile.mkdtemp(prefix='tabcat-ext-')
    shutil.copytree(ROOT, dst, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('web', 'tests', '.git', 'icon.af*', 'icon.jpg'))
    atexit.register(shutil.rmtree, dst, True)
    return dst

def profile():
    d = tempfile.mkdtemp(prefix='tabcat-prof-')
    atexit.register(shutil.rmtree, d, True)
    return d

def launch(p, **kw):
    """Chromium with the extension; returns (context, service worker)."""
    ext = extension_copy()
    ctx = p.chromium.launch_persistent_context(profile(), channel='chromium', headless=True,
        args=[f'--disable-extensions-except={ext}', f'--load-extension={ext}'], **kw)
    sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
    return ctx, sw

def dashboard(ctx, errors, size=(1300, 800)):
    d = ctx.new_page()
    d.set_viewport_size({'width': size[0], 'height': size[1]})
    d.on('pageerror', lambda e: errors.append(str(e)))
    d.goto(URL)
    d.wait_for_selector('.ws-item', timeout=15000)
    return d

def seed(sw, d, ws):
    """Replaces workspace `ws` (by id) in the stored data and opens it on the dashboard."""
    sw.evaluate("(w)=>chrome.storage.local.get('tabcat').then(r=>{const s=r.tabcat; s.workspaces=s.workspaces.filter(x=>x.id!==w.id); s.workspaces.push(w); return chrome.storage.local.set({tabcat:s})})", ws)
    time.sleep(.8)
    d.click(f'.ws-item[title="{ws["name"]}"]')
    time.sleep(1.2)
    d.mouse.move(5, d.viewport_size['height'] - 10)

def settings(sw, **kv):
    sw.evaluate("(kv)=>chrome.storage.local.get('tabcat:settings').then(r=>chrome.storage.local.set({'tabcat:settings':{...(r['tabcat:settings']||{}),...kv}}))", kv)
    time.sleep(.8)

link = lambda i, url=None: {'id': i, 'type': 'link', 'url': url or f'about:blank#{i}', 'name': i, 'icon': '', 'description': '', 'createdAt': 1}
folder = lambda i, items, symbol='': {'id': i, 'type': 'folder', 'name': i, 'symbol': symbol, 'collapsed': False, 'items': items}
def group(i, items, column=0, **kw):
    return {'id': i, 'type': 'group', 'name': i, 'symbol': '', 'color': '', 'note': '', 'collapsed': False, 'column': column, 'items': items, **kw}
def workspace(i, groups):
    return {'id': i, 'type': 'workspace', 'name': i, 'symbol': '', 'description': '',
            'categories': [{'id': i + '-c', 'type': 'category', 'name': 'C', 'groups': groups}]}

__all__ = ['sync_playwright', 'check', 'done', 'serve', 'launch', 'dashboard', 'seed', 'settings',
           'link', 'folder', 'group', 'workspace', 'URL', 'time']
