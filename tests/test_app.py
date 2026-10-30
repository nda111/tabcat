# The dashboard as an installable app: Chrome finds it installable, and the page offers the install
# (sidebar, until hidden; Settings) only when Chrome says it can; the dashboard has a default shortcut.
from harness import *
import json

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = ctx.new_page(); d.set_viewport_size({'width': 1300, 'height': 800}); d.on('pageerror', lambda e: errors.append(str(e)))
    d.add_init_script("addEventListener('beforeinstallprompt', () => { window.__offered = true; })")
    d.goto(URL); d.wait_for_selector('.ws-item', timeout=15000); time.sleep(.5)
    cdp = ctx.new_cdp_session(d)
    errs = cdp.send('Page.getInstallabilityErrors')['installabilityErrors']
    check(errs == [], f'Chrome finds the dashboard installable {errs}')
    m = json.loads(d.evaluate("fetch('manifest.webmanifest').then(r=>r.text())"))
    check(m['display'] == 'standalone' and {'192x192', '512x512'} <= {i['sizes'] for i in m['icons']}, 'manifest: own window, app icons')
    shown = lambda sel: d.evaluate(f"!document.querySelector('{sel}').hidden")
    offered = bool(d.evaluate('window.__offered'))
    check(shown('#btn-install') == offered and shown('#install-row') == offered, f"the install offer shows exactly when Chrome makes one (Chrome offered: {offered})")
    # Chrome's offer (a stand-in: the real event can't be made by a page)
    d.evaluate("(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => { window.__prompted = (window.__prompted || 0) + 1; }; dispatchEvent(e); })()")
    check(shown('#btn-install') and shown('#install-row'), 'offered: in the sidebar and in Settings')
    d.click('#btn-install .label'); time.sleep(.3)
    check(d.evaluate('window.__prompted') == 1, "the sidebar button opens Chrome's install prompt")
    d.evaluate("(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => { window.__prompted++; }; dispatchEvent(e); })()")
    d.hover('#btn-install'); d.click('#install-dismiss'); time.sleep(.3)
    check(not shown('#btn-install') and shown('#install-row') and d.evaluate('window.__prompted') == 1, 'its × hides it (no prompt); Settings still offers it')
    d.reload(); d.wait_for_selector('.ws-item'); time.sleep(.5)
    d.evaluate("(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => {}; dispatchEvent(e); })()")
    check(not shown('#btn-install'), 'and stays hidden after a reload')
    d.evaluate("dispatchEvent(new Event('appinstalled'))"); time.sleep(.3)
    check(not shown('#install-row') and 'tabcat' in d.inner_text('#toast'), 'installed: the offer goes, a toast says so')
    # (Chrome doesn't give an extension one of its own shortcuts, such as Ctrl+Shift+C, by default)
    keys = sw.evaluate("chrome.commands.getAll().then(cs=>cs.find(c=>c.name==='open-dashboard').shortcut)")
    check(keys == 'Ctrl+Shift+X', f'the dashboard shortcut is Ctrl+Shift+X out of the box ({keys!r})')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
