# Install app: offered in the sidebar while Chrome can install the dashboard; its × hides it, and
# Settings (beside its own Install app) can show it in the sidebar again, or hide it, on this device.
from harness import *

serve()
errors = []
with sync_playwright() as p:
    ctx, sw = launch(p)
    d = dashboard(ctx, errors)
    d.evaluate("dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: async () => {} }))"); time.sleep(.6)
    shown = lambda: d.is_visible('#btn-install')
    check(shown(), 'Chrome can install it: the sidebar offers Install app')
    d.hover('#btn-install'); d.click('#install-dismiss'); time.sleep(.6)
    check(not shown(), 'its × hides it')
    d.click('#btn-settings'); time.sleep(.5)
    check(d.is_visible('#install-side-row') and not d.is_checked('#install-side'), 'Settings has it, unticked')
    d.click('#install-side'); time.sleep(.6)
    check(shown() and d.evaluate("localStorage.getItem('tabcat:installHidden')") is None, 'ticked, the sidebar shows it again')
    d.click('#install-side'); time.sleep(.6)
    check(not shown(), 'unticked, it goes again')
    d.reload(); d.wait_for_selector('.ws-item'); time.sleep(.5)
    d.evaluate("dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: async () => {} }))"); time.sleep(.6)
    check(not shown(), 'remembered after a reload')
    check(sw.evaluate("chrome.storage.local.get('tabcat:settings').then(r => 'installSide' in (r['tabcat:settings'] || {}))") is False, "not in the extension's settings (it's this device's)")
    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
