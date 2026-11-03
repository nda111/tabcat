# The extension updated (or reloaded by hand) while the dashboard isn't looked at: it loads again at once all the
# same, from the extension itself (a page in the background would find out only later, its timers slowed or the
# tab frozen). Not one with a dialog open (an edit under way): that one waits to be done. And the page, told
# itself, counts a field merely left focused as no edit while it isn't looked at.
from harness import *

# (the page's own reload, on being told it's cut off, held back: only the extension's reload is left)
DEAF = "window.addEventListener('message', (e) => { if (e.data?.event === 'disconnected') e.stopImmediatePropagation(); }, true)"

def reload_ext(ctx):
    for w in reversed(ctx.service_workers):
        try: w.evaluate('chrome.runtime.reload()'); return
        except Exception: pass

errors = []
serve()
with sync_playwright() as p:
    ctx, sw = launch(p, developer_mode=True)
    d = dashboard(ctx, errors)
    other = ctx.new_page(); other.goto(URL + 'privacy.html'); other.bring_to_front()
    time.sleep(.3)
    active = sw.evaluate("chrome.tabs.query({}).then(ts => ts.filter(t => t.active).map(t => t.url))")
    check(all('privacy' in u for u in active), f'the dashboard behind another tab ({active})')

    d.evaluate(DEAF); d.evaluate('window.__old = true')
    reload_ext(ctx); time.sleep(3)
    check(d.evaluate('!window.__old') and d.locator('.ws-item').count() > 0, 'updated, not looked at: the extension loads it again, and it links up')

    # a dialog open: left alone
    d.wait_for_selector('.ws-item'); d.evaluate("document.querySelector('#btn-settings').click()"); time.sleep(.5)
    d.evaluate(DEAF); d.evaluate('window.__old = true')
    reload_ext(ctx); time.sleep(3)
    check(d.evaluate('window.__old === true') and d.evaluate("!!document.querySelector('dialog[open]')"), 'a dialog open in it: not loaded again under the edit')
    d.evaluate("document.querySelector('dialog[open]').close()"); time.sleep(.3)
    d.reload(); d.wait_for_selector('.ws-item', timeout=15000)

    # the page's own way: a field left focused, not looked at, is no edit
    d.evaluate("document.querySelector('#search, input[type=search], input')?.focus()"); time.sleep(.2)
    hidden = d.evaluate('document.hidden')
    focused = d.evaluate("document.activeElement?.tagName")
    d.evaluate("window.__old = true")
    sw2 = None
    reload_ext(ctx); time.sleep(3)
    check(d.evaluate('!window.__old'), f'a field left focused, not looked at: loaded again (hidden: {hidden}, focused: {focused})')

    check(not errors, f'no page errors {errors}')
    ctx.close()
done()
