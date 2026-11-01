# A shortcut Chrome left unset (another extension had its keys): the dashboard says so once, with a
# button to set it, and Settings shows it for as long as it lasts. Set, nothing is said.
import json, os
import harness
from harness import *

with open(os.path.join(harness.ROOT, 'manifest.json')) as f: commands = json.load(f)['commands']
unset = {**commands, 'open-dashboard': {k: v for k, v in commands['open-dashboard'].items() if k != 'suggested_key'}}

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p, manifest={'commands': unset})
    d = dashboard(ctx, errors); time.sleep(1)
    toasts = d.locator('#toast .toast-item')
    check(toasts.count() == 1 and 'Ctrl+Shift+X' in toasts.first.inner_text(), 'unset: a toast says so')
    toasts.first.locator('button').click(); time.sleep(1)
    check(sw.evaluate("chrome.tabs.query({}).then(ts=>ts.some(t=>(t.url||t.pendingUrl).startsWith('chrome://extensions/shortcuts')))"), 'its button opens chrome://extensions/shortcuts')
    d.bring_to_front(); d.reload(); d.wait_for_selector('.ws-item'); time.sleep(1.2)
    check(d.locator('#toast .toast-item').count() == 0, 'only once')
    d.click('#btn-settings'); time.sleep(.4)
    check(d.locator('#shortcut-missing').is_visible(), 'Settings still shows it')
    ctx.close()

    ctx, sw = launch(p)
    d = dashboard(ctx, errors); time.sleep(1)
    check(d.locator('#toast .toast-item').count() == 0, 'set: nothing said')
    d.click('#btn-settings'); time.sleep(.4)
    check(not d.locator('#shortcut-missing').is_visible(), 'nor in Settings')
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
