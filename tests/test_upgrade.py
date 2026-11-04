# Updating from 1.0.x: the real 1.0.4 (from its git tag) used for a while, then replaced by this version in the same
# folder and profile, as the Chrome Web Store or a hand update does. Everything kept: the groups, Recently deleted,
# the settings (the look, the language...), the tab groups' links; the dashboard shows it, nothing sent anywhere
# (no server), and the browser's data is still what a server account starts from when connecting later.
import io, json, os, shutil, subprocess, tarfile, tempfile
from harness import *
from harness import extension_copy, ROOT

OLD = 'v1.0.4'

def old_extension():
    dst = tempfile.mkdtemp(prefix='tabcat-old-')
    tar = None
    for git in ('git', '/mnt/c/Program Files/Git/cmd/git.exe'):
        try:
            tar = subprocess.run([git, '-C', ROOT, 'archive', '--format=tar', OLD], capture_output=True, check=True).stdout
            break
        except (OSError, subprocess.CalledProcessError):
            pass
    assert tar, f'no git to take {OLD} from'
    tarfile.open(fileobj=io.BytesIO(tar)).extractall(dst, filter='data')
    return dst

def start(p, ext, prof):
    ctx = p.chromium.launch_persistent_context(prof, channel='chromium', headless=True, bypass_csp=True,
        args=[f'--disable-extensions-except={ext}', f'--load-extension={ext}'])
    sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
    return ctx, sw

errors = []
serve()
ext, prof = old_extension(), tempfile.mkdtemp(prefix='tabcat-prof-')
with sync_playwright() as p:
    # 1.0.4, used: a workspace of groups, one deleted (in Recently deleted), the look and the language set
    ctx, sw = start(p, ext, prof)
    check(sw.evaluate('chrome.runtime.getManifest().version') == '1.0.4', 'the old version runs first')
    until(lambda: sw.evaluate("chrome.storage.local.get('tabcat').then(r => !!r.tabcat)"))
    ws = workspace('kept', [group('reading', [link('a', 'https://example.com/a'), link('b', 'https://example.com/b')]), group('later', [link('c', 'https://example.com/c')], column=1)])
    gone = group('gone', [link('d', 'https://example.com/d')])
    sw.evaluate("""([ws, gone]) => chrome.storage.local.get(['tabcat', 'tabcat:settings']).then(r => chrome.storage.local.set({
        tabcat: { ...r.tabcat, workspaces: [...r.tabcat.workspaces, ws] },
        'tabcat:settings': { ...(r['tabcat:settings'] || {}), theme: 'dark', accent: 'teal', language: 'ko', closeOnSave: false, autoSuspendMinutes: 30 },
        'tabcat:trash': [{ id: 't1', node: gone, parentId: ws.categories[0].id, index: 2, deletedAt: Date.now(), trail: [{ id: ws.id, type: 'workspace', name: ws.name, symbol: '' }] }],
        'tabcat:tabGroupLinks': { reading: 7 },
    }))""", [ws, gone])
    before = sw.evaluate("chrome.storage.local.get(null)")
    ctx.close()

    # this version in its place (the same folder: the same extension, its data where it was)
    new = extension_copy()
    for name in os.listdir(ext):
        path = os.path.join(ext, name)
        shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)
    shutil.copytree(new, ext, dirs_exist_ok=True)

    ctx, sw = start(p, ext, prof)
    version = sw.evaluate('chrome.runtime.getManifest().version')
    check(version == json.load(open(os.path.join(ROOT, 'manifest.json')))['version'], f'updated in place ({version})')
    sw.evaluate(f"chrome.storage.local.set({{ 'tabcat:allowedOrigins': ['http://localhost:{PORT}'] }})")
    time.sleep(1)
    after = sw.evaluate("chrome.storage.local.get(null)")
    check(after['tabcat'] == before['tabcat'], 'the groups as they were')
    check(after['tabcat:trash'] == before['tabcat:trash'], 'Recently deleted as it was')
    check(after['tabcat:tabGroupLinks'] == before['tabcat:tabGroupLinks'], "the tab groups' links as they were")
    s = after['tabcat:settings']
    check({k: s.get(k) for k in ('theme', 'accent', 'language', 'closeOnSave', 'autoSuspendMinutes')}
          == {'theme': 'dark', 'accent': 'teal', 'language': 'ko', 'closeOnSave': False, 'autoSuspendMinutes': 30}, f'the settings as set ({s})')
    check(not s.get('server') and not after.get('tabcat:sync'), 'no server: nothing to sync, nothing sent')

    d = ctx.new_page(); d.set_viewport_size({'width': 1300, 'height': 800})
    d.on('pageerror', lambda e: errors.append(str(e)))
    d.add_init_script("try { localStorage.setItem('tabcat:tourOffered', '1'); } catch {}")
    d.goto(URL)
    d.wait_for_selector('.ws-item', timeout=15000)
    d.click('.ws-item:has(.name:text-is("kept"))')
    check(until(lambda: 'reading' in d.inner_text('#board')), 'the dashboard shows the groups')
    check(d.evaluate("document.documentElement.lang") == 'ko' and d.evaluate("document.documentElement.dataset.theme") == 'dark', 'in the language and theme set')
    board = d.inner_text('#board')
    check('later' in board and 'gone' not in board, 'all of them, the deleted one not among them')
    check(not errors, f'no page errors {errors}')
    ctx.close()
shutil.rmtree(ext, True); shutil.rmtree(prof, True)
done()
