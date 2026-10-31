# Closing a window or picked tabs from Open tabs can be undone (they open again); importing data shows the
# new workspaces arriving and can be undone; Reset settings also puts the page's layout back (panels,
# their widths, folded windows, Install app); importing settings moves everything that changed.
import json, os, tempfile
from harness import *

WS = "chrome.storage.local.get('tabcat').then(r=>r.tabcat.workspaces.map(w=>w.name))"
URLS = "chrome.tabs.query({}).then(ts=>ts.map(t=>t.url||t.pendingUrl).filter(u=>u.includes('?demo=')).sort())"

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    # another window with two tabs, closed from the panel: Undo opens them again in a new window
    sw.evaluate("chrome.windows.create({url: ['about:blank?demo=a', 'about:blank?demo=b'], focused: false})"); time.sleep(1.5)
    other = d.locator('#windows .win').nth(1)
    other.locator('.win-head').hover(); time.sleep(.2)
    other.locator('.win-head .icon-btn').last.click(); time.sleep(.4)
    d.click('#confirm-ok'); time.sleep(1.2)
    check(sw.evaluate(URLS) == [], 'the window closed')
    check(d.locator('#toast .toast-item button').count() > 0, 'a toast offers Undo')
    d.locator('#toast .toast-item button').last.click(); time.sleep(1.5)
    check(sw.evaluate(URLS) == ['about:blank?demo=a', 'about:blank?demo=b'] and sw.evaluate("chrome.windows.getAll().then(w=>w.length)") == 2,
          f'Undo opens its tabs again, in a window of their own ({sw.evaluate(URLS)})')

    # importing data: Settings closes, the new workspace springs into the sidebar and is shown; Undo removes it
    before = sw.evaluate(WS)
    f = os.path.join(tempfile.mkdtemp(), 'import.json')
    with open(f, 'w') as fh: json.dump({'app': 'tabcat', 'workspaces': [workspace('Imported', [group('G', [link('x')])])]}, fh)
    d.click('#btn-settings'); time.sleep(.4)
    d.set_input_files('#import-file', f); time.sleep(.6)
    d.evaluate("window.__sprung = false; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.matches?.('.ws-item') && n.title === 'Imported') requestAnimationFrame(() => { window.__sprung = n.getAnimations().length > 0; }); }))).observe(document.querySelector('#ws-list'), { childList: true })")
    d.click('#picker-ok'); time.sleep(1.5)
    check(sw.evaluate(WS) == before + ['Imported'] and not d.evaluate("document.querySelector('#settings').open"), 'imported; Settings closed')
    check(d.evaluate('__sprung') and d.evaluate("document.querySelector('#ws-head h1').textContent").endswith('Imported'), 'the new workspace springs in and is shown')
    d.locator('#toast .toast-item button').last.click(); time.sleep(1.5)
    check(sw.evaluate(WS) == before, 'Undo takes it away')

    # Reset settings: the panels open again at their default widths, folded windows unfold, Install app comes back
    d.evaluate("localStorage.setItem('tabcat:installHidden', '1')")
    d.click('#ws-toggle'); time.sleep(.6); d.click('#tabs-toggle'); time.sleep(.6)
    wid = sw.evaluate("chrome.windows.getAll().then(ws=>ws.map(w=>w.id))")
    d.evaluate("(ids) => { const ui = JSON.parse(localStorage.getItem('tabcat:ui')); ui.wsWidth = 300; ui.winCollapsed = ids; localStorage.setItem('tabcat:ui', JSON.stringify(ui)); }", wid)
    d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1)
    check(d.evaluate("document.body.classList.contains('ws-collapsed') && document.body.classList.contains('tabs-collapsed')"), 'set up: both panels collapsed')
    d.click('#btn-settings'); time.sleep(.4); d.click('#btn-reset-settings'); time.sleep(.3); d.click('#confirm-ok'); time.sleep(1.5)
    ui = d.evaluate("JSON.parse(localStorage.getItem('tabcat:ui'))")
    check(not ui['wsCollapsed'] and not ui['tabsCollapsed'] and ui['wsWidth'] is None and not ui.get('winCollapsed'), f'Reset settings puts the panels and windows back {ui}')
    check(d.evaluate("!document.body.classList.contains('ws-collapsed') && !document.body.classList.contains('tabs-collapsed')"), 'both panels open')
    check(d.evaluate("localStorage.getItem('tabcat:installHidden')") is None, 'Install app is offered again')

    # importing settings: the board takes the new column count at once, the language too
    f2 = os.path.join(tempfile.mkdtemp(), 'settings.json')
    with open(f2, 'w') as fh: json.dump({'app': 'tabcat', 'kind': 'settings', 'settings': {'columns': 3, 'language': 'ko'}}, fh)
    d.set_input_files('#import-settings-file', f2); time.sleep(1.5)
    check(d.evaluate("document.querySelector('#board').dataset.cols") == '3' and d.evaluate("document.documentElement.lang") == 'ko', 'imported settings: columns and language follow at once')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
