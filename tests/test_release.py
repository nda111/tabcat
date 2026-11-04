# The release files (tools/release.py): the extension's two zips hold every file it refers to (the manifest's, the
# pages' scripts and styles, the modules' imports) and none of the repository's others (the server, the tests); the
# store's has no localhost pages; each, unzipped, loads in the browser, its pages without errors. The server's wheel
# holds its pages.
import glob, json, os, re, subprocess, sys, tempfile, zipfile
from harness import *
from harness import ROOT

out = tempfile.mkdtemp(prefix='tabcat-release-')
subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'release.py'), 'extension', '--worktree', '--out', out], check=True, capture_output=True)
version = json.load(open(os.path.join(ROOT, 'manifest.json')))['version']
hand, store = (os.path.join(out, f'tabcat-extension-{version}{s}.zip') for s in ('', '-store'))
check(os.path.exists(hand) and os.path.exists(store), f'named for the extension and its version ({os.listdir(out)})')

def refs(files):
    """Every file the extension refers to, from what's in it."""
    m = json.loads(files['manifest.json'])
    want = {m['background']['service_worker'], m['action']['default_popup'], *m['icons'].values(), *m['action'].get('default_icon', {}).values()}
    for e in m.get('content_scripts', []): want.update(e['js'])
    for e in m.get('web_accessible_resources', []): want.update(r for r in e['resources'] if '*' not in r)
    want.add(f"_locales/{m['default_locale']}/messages.json")
    for name, data in files.items():
        text = data.decode('utf-8', 'ignore')
        base = os.path.dirname(name)
        if name.endswith('.html'):
            want.update(os.path.normpath(os.path.join(base, r)) for r in re.findall(r'(?:src|href)="([^":#?]+)"', text))
        if name.endswith('.js'):
            want.update(os.path.normpath(os.path.join(base, r)) for r in re.findall(r"(?:from|import)\s*\(?\s*'(\.{1,2}/[^']+)'", text))
        if name.endswith('.css'):
            want.update(os.path.normpath(os.path.join(base, r)) for r in re.findall(r"url\(['\"]?([^'\")#:]+)['\"]?\)", text))
    return want

for path, prefix in ((hand, 'tabcat/'), (store, '')):
    z = zipfile.ZipFile(path)
    names = z.namelist()
    check(all(n.startswith(prefix) for n in names), f'{os.path.basename(path)}: under {prefix or "the top"}')
    files = {n[len(prefix):]: z.read(n) for n in names}
    missing = sorted(r for r in refs(files) if r not in files)
    check(not missing, f'{os.path.basename(path)}: every file it refers to ({missing})')
    stray = sorted(n for n in files if n.split('/')[0] in ('server', 'tests', 'tools', 'docs', 'store', 'web', '.github') or n.startswith('icons/source'))
    check(not stray, f'{os.path.basename(path)}: nothing else ({stray[:5]})')
m = json.loads(zipfile.ZipFile(store).read('manifest.json'))
check(not any('localhost' in x or '127.0.0.1' in x for e in m['content_scripts'] + m.get('web_accessible_resources', []) for x in e['matches']), "the store's: no localhost pages")
check('localhost' in json.dumps(json.loads(zipfile.ZipFile(hand).read('tabcat/manifest.json'))['content_scripts']), "by hand: localhost pages kept (for a dashboard served here)")

with sync_playwright() as p:
    for path, prefix in ((hand, 'tabcat'), (store, '')):
        ext = tempfile.mkdtemp(prefix='tabcat-unzipped-')
        zipfile.ZipFile(path).extractall(ext)
        ext = os.path.join(ext, prefix)
        ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), channel='chromium', headless=True,
            args=[f'--disable-extensions-except={ext}', f'--load-extension={ext}'])
        sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
        base = sw.url.rsplit('/', 1)[0]
        check(sw.evaluate('chrome.runtime.getManifest().version') == version, f'{os.path.basename(path)}: loads')
        for page in ('popup.html', 'connect.html', 'allow.html?origin=http%3A%2F%2Flocalhost%3A1'):
            errors, failed = [], []
            pg = ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.on('requestfailed', lambda r: failed.append(r.url))
            pg.on('response', lambda r: r.status >= 400 and failed.append(r.url))
            pg.goto(f'{base}/{page}'); pg.wait_for_load_state('networkidle'); time.sleep(.3)
            check(not errors and not failed and pg.evaluate("document.body.innerText.trim().length > 0"), f'{os.path.basename(path)}: {page.split("?")[0]} shows, no errors {errors} {failed}')
            pg.close()
        ctx.close()

wheel_out = tempfile.mkdtemp(prefix='tabcat-wheel-')
py = os.environ.get('TABCAT_SERVER_PYTHON', sys.executable)
subprocess.run([py, os.path.join(ROOT, 'tools', 'release.py'), 'server', '--worktree', '--out', wheel_out], check=True, capture_output=True)
server_version = re.search(r'version = "([^"]+)"', open(os.path.join(ROOT, 'server', 'pyproject.toml')).read())[1]
wheel = os.path.join(wheel_out, f'tabcat_server-{server_version}-py3-none-any.whl')
pages = os.listdir(os.path.join(ROOT, 'server', 'tabcat_server', 'pages'))
check(os.path.exists(wheel) and all(f'tabcat_server/pages/{n}' in zipfile.ZipFile(wheel).namelist() for n in pages), f"the server's wheel, by its version, with its pages ({os.listdir(wheel_out)})")
done()
